import { useSyncExternalStore } from "react";
import type { Song } from "./api";
import {
	getCoverArtUrl,
	getPlayQueue,
	getStreamUrl,
	savePlayQueue,
	scrobble,
} from "./api";

// Media Session API support
if ("mediaSession" in navigator) {
	navigator.mediaSession.setActionHandler("play", () => {
		play();
	});
	navigator.mediaSession.setActionHandler("pause", () => {
		pause();
	});
	navigator.mediaSession.setActionHandler("previoustrack", () => {
		playPrevious();
	});
	navigator.mediaSession.setActionHandler("nexttrack", () => {
		playNext();
	});
	navigator.mediaSession.setActionHandler("seekto", (details) => {
		if (details.seekTime !== undefined) {
			seek(details.seekTime);
		}
	});
}

function updateMediaSession(song: Song) {
	if ("mediaSession" in navigator) {
		getTrackCoverUrl(song.coverArt, 300).then((coverUrl) => {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: song.title,
				artist: song.artist,
				album: song.album,
				artwork: coverUrl
					? [
							{
								src: coverUrl,
								sizes: "300x300",
								type: "image/jpeg",
							},
						]
					: [],
			});
		});
	}
}

function updateMediaSessionState(isPlaying: boolean) {
	if ("mediaSession" in navigator) {
		navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
	}
}

export type RepeatMode = "off" | "all" | "one";

export interface PlayerState {
	currentTrack: Song | null;
	queue: Song[];
	originalQueue: Song[]; // Original queue order before shuffle
	queueIndex: number;
	isPlaying: boolean;
	volume: number;
	currentTime: number;
	duration: number;
	isLoading: boolean;
	shuffle: boolean;
	repeat: RepeatMode;
}

// ============================================================================
// Volume Persistence
// ============================================================================

const VOLUME_STORAGE_KEY = "subsonic_player_volume";

function getSavedVolume(): number {
	try {
		const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
		if (saved) {
			const volume = parseFloat(saved);
			if (!Number.isNaN(volume) && volume >= 0 && volume <= 1) {
				return volume;
			}
		}
	} catch (err) {
		console.warn("Failed to read volume from localStorage:", err);
	}
	return 1;
}

function saveVolumeToStorage(volume: number) {
	try {
		localStorage.setItem(VOLUME_STORAGE_KEY, volume.toString());
	} catch (err) {
		console.warn("Failed to save volume to localStorage:", err);
	}
}

const initialState: PlayerState = {
	currentTrack: null,
	queue: [],
	originalQueue: [],
	queueIndex: -1,
	isPlaying: false,
	volume: getSavedVolume(),
	currentTime: 0,
	duration: 0,
	isLoading: false,
	shuffle: false,
	repeat: "off",
};

let playerState: PlayerState = { ...initialState };
let audio: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();

// Track scrobbling state - we only scrobble once per song play
let scrobbledTrackId: string | null = null;
let nowPlayingReported: string | null = null;

function emitChange() {
	for (const listener of listeners) {
		listener();
	}
}

function updateState(updates: Partial<PlayerState>) {
	playerState = { ...playerState, ...updates };
	emitChange();
}

// Initialize audio element
function getAudio(): HTMLAudioElement {
	if (!audio) {
		audio = new Audio();
		audio.volume = playerState.volume;

		audio.addEventListener("timeupdate", () => {
			updateState({ currentTime: audio?.currentTime ?? 0 });

			// Update media session position
			if ("mediaSession" in navigator) {
				const currentTime = audio?.currentTime ?? 0;
				const duration = audio?.duration ?? 0;
				if (duration > 0) {
					navigator.mediaSession.setPositionState({
						duration,
						playbackRate: audio?.playbackRate ?? 1,
						position: currentTime,
					});
				}
			}

			// Check if we should scrobble (submission)
			// Scrobble after 4 minutes or 50% of the song, whichever comes first
			const currentTrack = playerState.currentTrack;
			const currentTime = audio?.currentTime ?? 0;
			const duration = audio?.duration ?? 0;

			if (
				currentTrack &&
				currentTrack.id !== scrobbledTrackId &&
				duration > 0
			) {
				const scrobbleThreshold = Math.min(240, duration * 0.5); // 4 min or 50%
				if (currentTime >= scrobbleThreshold) {
					scrobbledTrackId = currentTrack.id;
					scrobble(currentTrack.id, { submission: true }).catch((err) => {
						console.error("Failed to scrobble:", err);
					});
				}
			}
		});

		audio.addEventListener("durationchange", () => {
			updateState({ duration: audio?.duration ?? 0 });
		});

		audio.addEventListener("ended", () => {
			playNext();
		});

		audio.addEventListener("playing", () => {
			updateState({ isPlaying: true, isLoading: false });
			updateMediaSessionState(true);
		});

		audio.addEventListener("pause", () => {
			updateState({ isPlaying: false });
			updateMediaSessionState(false);
		});

		audio.addEventListener("waiting", () => {
			updateState({ isLoading: true });
		});

		audio.addEventListener("canplay", () => {
			updateState({ isLoading: false });
		});

		audio.addEventListener("error", () => {
			console.error("Audio error:", audio?.error);
			updateState({ isLoading: false, isPlaying: false });
		});
	}
	return audio;
}

// ============================================================================
// Play Queue Sync (cross-device) - declarations before use
// ============================================================================

// Debounce timer for saving queue
let saveQueueTimeout: ReturnType<typeof setTimeout> | null = null;
let queueSyncEnabled = false;

// Save current queue to server (debounced)
function debouncedSaveQueue() {
	if (!queueSyncEnabled) return;

	if (saveQueueTimeout) {
		clearTimeout(saveQueueTimeout);
	}

	saveQueueTimeout = setTimeout(() => {
		const { queue, currentTrack, currentTime } = playerState;
		if (queue.length === 0) return;

		const songIds = queue.map((s) => s.id);
		savePlayQueue({
			id: songIds,
			current: currentTrack?.id,
			position: Math.floor(currentTime * 1000), // Convert to milliseconds
		}).catch((err) => {
			console.error("Failed to save play queue:", err);
		});
	}, 2000); // Save after 2 seconds of inactivity
}

// Player actions
export async function playSong(
	song: Song,
	queue?: Song[],
	startIndex?: number,
) {
	const audioEl = getAudio();

	// Reset scrobble state for new song
	scrobbledTrackId = null;

	const newQueue = queue ?? [song];
	updateState({
		currentTrack: song,
		queue: newQueue,
		originalQueue:
			playerState.originalQueue.length > 0
				? playerState.originalQueue
				: newQueue,
		queueIndex: startIndex ?? 0,
		isLoading: true,
	});

	// Trigger queue sync
	debouncedSaveQueue();

	try {
		const streamUrl = await getStreamUrl(song.id);
		audioEl.src = streamUrl;
		await audioEl.play();

		// Update media session metadata
		updateMediaSession(song);

		// Report "now playing" if not already reported for this song
		if (nowPlayingReported !== song.id) {
			nowPlayingReported = song.id;
			scrobble(song.id, { submission: false }).catch((err) => {
				console.error("Failed to report now playing:", err);
			});
		}
	} catch (error) {
		console.error("Failed to play song:", error);
		updateState({ isLoading: false });
	}
}

export async function playAlbum(songs: Song[], startIndex = 0) {
	if (songs.length === 0) return;
	await playSong(songs[startIndex], songs, startIndex);
}

export function togglePlayPause() {
	const audioEl = getAudio();
	if (playerState.isPlaying) {
		audioEl.pause();
	} else if (audioEl.src) {
		audioEl.play();
	}
}

export function pause() {
	getAudio().pause();
}

export function play() {
	const audioEl = getAudio();
	if (audioEl.src) {
		audioEl.play();
	}
}

export async function playNext() {
	const { queue, queueIndex, repeat, currentTrack } = playerState;
	if (queue.length === 0) return;

	// Repeat one: replay current track
	if (repeat === "one" && currentTrack) {
		seek(0);
		getAudio().play();
		return;
	}

	const nextIndex = queueIndex + 1;
	if (nextIndex < queue.length) {
		await playSong(queue[nextIndex], queue, nextIndex);
	} else if (repeat === "all") {
		// Repeat all: go back to start
		await playSong(queue[0], queue, 0);
	} else {
		// End of queue
		updateState({ isPlaying: false });
		getAudio().pause();
	}
}

export async function playPrevious() {
	const { queue, queueIndex, currentTime, repeat } = playerState;
	if (queue.length === 0) return;

	// If more than 3 seconds in, restart current track
	if (currentTime > 3) {
		seek(0);
		return;
	}

	const prevIndex = queueIndex - 1;
	if (prevIndex >= 0) {
		await playSong(queue[prevIndex], queue, prevIndex);
	} else if (repeat === "all") {
		// Repeat all: go to last track
		await playSong(queue[queue.length - 1], queue, queue.length - 1);
	} else {
		// At start, just restart
		seek(0);
	}
}

export function seek(time: number) {
	const audioEl = getAudio();
	if (audioEl.src) {
		audioEl.currentTime = time;
	}
}

export function setVolume(volume: number) {
	const audioEl = getAudio();
	const clampedVolume = Math.max(0, Math.min(1, volume));
	audioEl.volume = clampedVolume;
	updateState({ volume: clampedVolume });
	saveVolumeToStorage(clampedVolume);
}

export function addToQueue(songs: Song[]) {
	updateState({
		queue: [...playerState.queue, ...songs],
		originalQueue: [...playerState.originalQueue, ...songs],
	});
}

export function playNextInQueue(song: Song) {
	const { queue, originalQueue, queueIndex } = playerState;
	// Insert the song right after the current track
	const newQueue = [
		...queue.slice(0, queueIndex + 1),
		song,
		...queue.slice(queueIndex + 1),
	];
	const newOriginalQueue = [
		...originalQueue.slice(0, queueIndex + 1),
		song,
		...originalQueue.slice(queueIndex + 1),
	];
	updateState({
		queue: newQueue,
		originalQueue: newOriginalQueue,
	});
}

export function clearQueue(): {
	previousQueue: Song[];
	previousOriginalQueue: Song[];
	previousQueueIndex: number;
} | null {
	const { queue, currentTrack, originalQueue, queueIndex } = playerState;

	// Store previous state for undo
	const previousState = {
		previousQueue: [...queue],
		previousOriginalQueue: [...originalQueue],
		previousQueueIndex: queueIndex,
	};

	// If there's a current track, keep only that song in the queue
	if (currentTrack && queue.length > 1) {
		updateState({
			queue: [currentTrack],
			originalQueue: [currentTrack],
			queueIndex: 0,
		});
		return previousState;
	}
	// Otherwise completely clear the queue
	const audioEl = getAudio();
	audioEl.pause();
	audioEl.src = "";
	updateState({ ...initialState });
	return previousState;
}

// Restore a previously saved queue state (for undo)
export function restoreQueueState(state: {
	previousQueue: Song[];
	previousOriginalQueue: Song[];
	previousQueueIndex: number;
}) {
	const { previousQueue, previousOriginalQueue, previousQueueIndex } = state;
	if (previousQueue.length === 0) return;

	updateState({
		queue: previousQueue,
		originalQueue: previousOriginalQueue,
		queueIndex: previousQueueIndex,
		currentTrack: previousQueue[previousQueueIndex],
	});
}

export function removeFromQueue(
	index: number,
): { song: Song; index: number } | null {
	const { queue, originalQueue, queueIndex, currentTrack } = playerState;

	// Don't allow removing the currently playing song
	if (index === queueIndex && currentTrack) {
		return null;
	}

	const removedSong = queue[index];

	// Remove from both queues
	const newQueue = queue.filter((_, i) => i !== index);
	const newOriginalQueue = originalQueue.filter((_, i) => i !== index);

	// Adjust queueIndex if needed
	let newQueueIndex = queueIndex;
	if (index < queueIndex) {
		newQueueIndex = queueIndex - 1;
	}

	updateState({
		queue: newQueue,
		originalQueue: newOriginalQueue,
		queueIndex: newQueueIndex,
	});

	return { song: removedSong, index };
}

// Re-insert a song at a specific index in the queue (for undo)
export function insertIntoQueue(song: Song, index: number) {
	const { queue, originalQueue, queueIndex } = playerState;

	const newQueue = [...queue.slice(0, index), song, ...queue.slice(index)];
	const newOriginalQueue = [
		...originalQueue.slice(0, index),
		song,
		...originalQueue.slice(index),
	];

	// Adjust queueIndex if needed
	let newQueueIndex = queueIndex;
	if (index <= queueIndex) {
		newQueueIndex = queueIndex + 1;
	}

	updateState({
		queue: newQueue,
		originalQueue: newOriginalQueue,
		queueIndex: newQueueIndex,
	});
}

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

export function toggleShuffle() {
	const { shuffle, queue, queueIndex, currentTrack, originalQueue } =
		playerState;

	if (!shuffle) {
		// Enable shuffle: save original queue and shuffle remaining songs
		const currentSong = currentTrack;
		const remainingSongs = queue.filter((_, i) => i !== queueIndex);
		const shuffledRemaining = shuffleArray(remainingSongs);

		// Put current song first, then shuffled remaining
		const newQueue = currentSong
			? [currentSong, ...shuffledRemaining]
			: shuffledRemaining;

		updateState({
			shuffle: true,
			originalQueue: originalQueue.length > 0 ? originalQueue : queue,
			queue: newQueue,
			queueIndex: 0,
		});
	} else {
		// Disable shuffle: restore original queue order
		const currentSong = currentTrack;
		const newIndex = currentSong
			? originalQueue.findIndex((s) => s.id === currentSong.id)
			: 0;

		updateState({
			shuffle: false,
			queue: originalQueue,
			queueIndex: newIndex >= 0 ? newIndex : 0,
		});
	}
}

export function toggleRepeat() {
	const { repeat } = playerState;
	const modes: RepeatMode[] = ["off", "all", "one"];
	const currentIndex = modes.indexOf(repeat);
	const nextMode = modes[(currentIndex + 1) % modes.length];
	updateState({ repeat: nextMode });
}

export function setRepeat(mode: RepeatMode) {
	updateState({ repeat: mode });
}

// Update the starred status of the current track (for optimistic UI updates)
export function updateCurrentTrackStarred(starred: boolean) {
	const { currentTrack, queue, queueIndex } = playerState;
	if (!currentTrack) return;

	const updatedTrack = {
		...currentTrack,
		starred: starred ? new Date().toISOString() : undefined,
	};

	// Update the track in the queue as well
	const updatedQueue = [...queue];
	if (queueIndex >= 0 && queueIndex < updatedQueue.length) {
		updatedQueue[queueIndex] = updatedTrack;
	}

	updateState({
		currentTrack: updatedTrack,
		queue: updatedQueue,
	});
}

// Save queue immediately (for page unload)
export function saveQueueNow(): Promise<void> {
	const { queue, currentTrack, currentTime } = playerState;
	if (queue.length === 0) return Promise.resolve();

	const songIds = queue.map((s) => s.id);
	return savePlayQueue({
		id: songIds,
		current: currentTrack?.id,
		position: Math.floor(currentTime * 1000),
	});
}

// Restore queue from server
export async function restoreQueue(): Promise<boolean> {
	try {
		const playQueue = await getPlayQueue();
		if (!playQueue?.entry || playQueue.entry.length === 0) {
			return false;
		}

		const songs = playQueue.entry;
		const currentId = playQueue.current;
		const positionMs = playQueue.position ?? 0;

		// Find the current song index
		let currentIndex = 0;
		if (currentId) {
			const idx = songs.findIndex((s) => s.id === currentId);
			if (idx >= 0) currentIndex = idx;
		}

		// Update state with restored queue (don't auto-play)
		updateState({
			queue: songs,
			originalQueue: songs,
			currentTrack: songs[currentIndex],
			queueIndex: currentIndex,
			currentTime: positionMs / 1000, // Convert from milliseconds
		});

		// Prepare audio element but don't play
		const audioEl = getAudio();
		const streamUrl = await getStreamUrl(songs[currentIndex].id);
		audioEl.src = streamUrl;
		audioEl.currentTime = positionMs / 1000;

		// Update media session
		updateMediaSession(songs[currentIndex]);

		return true;
	} catch (err) {
		console.error("Failed to restore play queue:", err);
		return false;
	}
}

// Enable queue sync - call this after user is authenticated
export function enableQueueSync() {
	if (queueSyncEnabled) return;
	queueSyncEnabled = true;

	// Save queue on page unload
	window.addEventListener("beforeunload", () => {
		if (playerState.queue.length > 0) {
			saveQueueNow();
		}
	});
}

// Check if queue sync is enabled
export function isQueueSyncEnabled(): boolean {
	return queueSyncEnabled;
}

// Cover art URL cache
const coverArtCache = new Map<string, string>();

export async function getTrackCoverUrl(
	coverArtId: string | undefined,
	size = 100,
): Promise<string | null> {
	if (!coverArtId) return null;

	const cacheKey = `${coverArtId}-${size}`;
	const cached = coverArtCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const url = await getCoverArtUrl(coverArtId, size);
	coverArtCache.set(cacheKey, url);
	return url;
}

// React hook
function subscribe(callback: () => void) {
	listeners.add(callback);
	return () => listeners.delete(callback);
}

function getSnapshot(): PlayerState {
	return playerState;
}

export function usePlayer() {
	const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	return {
		...state,
		playSong,
		playAlbum,
		togglePlayPause,
		play,
		pause,
		playNext,
		playPrevious,
		seek,
		setVolume,
		addToQueue,
		playNextInQueue,
		removeFromQueue,
		insertIntoQueue,
		clearQueue,
		restoreQueueState,
		toggleShuffle,
		toggleRepeat,
		setRepeat,
	};
}
