import { useSyncExternalStore } from "react";
import type { Song } from "./api";
import {
	getCoverArtUrl,
	getPlayQueue,
	getStreamUrl,
	savePlayQueue,
	scrobble,
} from "./api";
import {
	type AudioBackend,
	type AudioBackendEvents,
	Html5AudioBackend,
	MpvAudioBackend,
} from "./audio-backend";
import { getSettings } from "./settings";

// ============================================================================
// Audio Backend Management
// ============================================================================

let currentBackend: AudioBackend | null = null;
let currentBackendType: "html5" | "mpv" = "html5";
let mprisCleanupFns: Array<() => void> = [];

// Send MPRIS metadata update
function updateMprisMetadata(song: Song, coverUrl?: string) {
	const api = window.electronAPI?.mpv;
	if (!api || window.electronAPI?.platform !== "linux") return;

	api.setMetadata({
		title: song.title,
		artist: song.artist,
		album: song.album,
		artUrl: coverUrl,
		trackId: song.id,
		length: song.duration,
	});
}

// Send MPRIS playback status update
function updateMprisPlaybackStatus(isPlaying: boolean) {
	const api = window.electronAPI?.mpv;
	if (!api || window.electronAPI?.platform !== "linux") return;

	api.setPlaybackStatus(isPlaying ? "Playing" : "Paused");
}

// Send MPRIS position update
function updateMprisPosition(time: number) {
	const api = window.electronAPI?.mpv;
	if (!api || window.electronAPI?.platform !== "linux") return;

	api.setMprisPosition(time);
}

// Send MPRIS volume update
function updateMprisVolume(volume: number) {
	const api = window.electronAPI?.mpv;
	if (!api || window.electronAPI?.platform !== "linux") return;

	api.updateVolume(Math.round(volume * 100));
}

// Set up MPRIS control listeners for Next/Previous (handled at player level)
// Also sets up play/pause/stop/seek listeners for HTML5 backend
function setupMprisControlListeners() {
	const mpv = window.electronAPI?.mpv;
	if (!mpv || window.electronAPI?.platform !== "linux") return;

	// Clean up any existing listeners
	for (const cleanup of mprisCleanupFns) {
		cleanup();
	}
	mprisCleanupFns = [];

	// Next/Previous - always needed at player level (requires queue access)
	if (mpv.onMprisNext) {
		const cleanup = mpv.onMprisNext(() => {
			playNext();
		});
		mprisCleanupFns.push(cleanup);
	}

	if (mpv.onMprisPrevious) {
		const cleanup = mpv.onMprisPrevious(() => {
			playPrevious();
		});
		mprisCleanupFns.push(cleanup);
	}

	// For HTML5 backend, we also need to handle play/pause/stop/seek at player level
	// (MPV backend handles these in audio-backend.ts)
	if (currentBackendType === "html5") {
		if (mpv.onMprisPlayPause) {
			const cleanup = mpv.onMprisPlayPause(() => {
				togglePlayPause();
			});
			mprisCleanupFns.push(cleanup);
		}

		if (mpv.onMprisPlay) {
			const cleanup = mpv.onMprisPlay(() => {
				play();
			});
			mprisCleanupFns.push(cleanup);
		}

		if (mpv.onMprisPause) {
			const cleanup = mpv.onMprisPause(() => {
				pause();
			});
			mprisCleanupFns.push(cleanup);
		}

		if (mpv.onMprisStop) {
			const cleanup = mpv.onMprisStop(() => {
				const backend = getAudioBackend();
				backend.stop();
				updateState({ isPlaying: false, currentTime: 0 });
			});
			mprisCleanupFns.push(cleanup);
		}

		if (mpv.onMprisSeek) {
			const cleanup = mpv.onMprisSeek((offset: number) => {
				// Seek is relative offset in seconds
				const newTime = playerState.currentTime + offset;
				seek(Math.max(0, newTime));
			});
			mprisCleanupFns.push(cleanup);
		}

		if (mpv.onMprisSetPosition) {
			const cleanup = mpv.onMprisSetPosition((position: number) => {
				seek(position);
			});
			mprisCleanupFns.push(cleanup);
		}

		if (mpv.onMprisVolume) {
			const cleanup = mpv.onMprisVolume((volume: number) => {
				// Volume is 0-100, convert to 0-1
				setVolume(volume / 100);
			});
			mprisCleanupFns.push(cleanup);
		}
	}
}

function getBackendEventHandlers(): AudioBackendEvents {
	return {
		onTimeUpdate: (time: number, duration: number) => {
			updateState({ currentTime: time, duration });

			// Update media session position
			if ("mediaSession" in navigator && duration > 0) {
				navigator.mediaSession.setPositionState({
					duration,
					playbackRate: 1,
					position: time,
				});
			}

			// Update MPRIS position (works for both HTML5 and MPV backends)
			updateMprisPosition(time);

			// Scrobble logic
			const currentTrack = playerState.currentTrack;
			if (
				currentTrack &&
				currentTrack.id !== scrobbledTrackId &&
				duration > 0
			) {
				const scrobbleThreshold = Math.min(240, duration * 0.5);
				if (time >= scrobbleThreshold) {
					scrobbledTrackId = currentTrack.id;
					scrobble(currentTrack.id, { submission: true }).catch((err) => {
						console.error("Failed to scrobble:", err);
					});
				}
			}
		},
		onEnded: () => {
			playNext();
		},
		onAutoNext: () => {
			// MPV auto-advanced to next track in its playlist
			// We need to advance our queue state to match
			handleAutoNext();
		},
		onPlaying: () => {
			updateState({ isPlaying: true, isLoading: false });
			updateMediaSessionState(true);
		},
		onPaused: () => {
			updateState({ isPlaying: false });
			updateMediaSessionState(false);
		},
		onLoading: () => {
			updateState({ isLoading: true });
		},
		onCanPlay: () => {
			updateState({ isLoading: false });
		},
		onError: (error: Error) => {
			console.error("Audio error:", error);
			updateState({ isLoading: false, isPlaying: false });
		},
		onFallback: (shouldFallback: boolean) => {
			// MPV failed, fall back to HTML5 audio
			if (shouldFallback && currentBackendType === "mpv") {
				console.warn("MPV failed, falling back to HTML5 audio");
				switchToHtml5Fallback();
			}
		},
	};
}

// Handle MPV auto-advancing to next track
async function handleAutoNext() {
	const { queue, queueIndex } = playerState;
	const nextIndex = queueIndex + 1;

	if (nextIndex < queue.length) {
		const nextTrack = queue[nextIndex];

		// Reset scrobble state for new song
		scrobbledTrackId = null;

		// Update state to reflect the new current track
		updateState({
			currentTrack: nextTrack,
			queueIndex: nextIndex,
			currentTime: 0,
			isLoading: false,
		});

		// Update media session
		updateMediaSession(nextTrack);

		// Report "now playing"
		if (nowPlayingReported !== nextTrack.id) {
			nowPlayingReported = nextTrack.id;
			scrobble(nextTrack.id, { submission: false }).catch((err) => {
				console.error("Failed to report now playing:", err);
			});
		}

		// Preload the next track after this one
		const followingIndex = nextIndex + 1;
		if (followingIndex < queue.length && currentBackend) {
			const followingTrack = queue[followingIndex];
			try {
				const followingUrl = await getStreamUrl(followingTrack.id);
				await currentBackend.setQueueNext(followingUrl);
			} catch (err) {
				console.error("Failed to preload next track:", err);
			}
		}

		// Tell MPV about the next URL (for its internal queue management)
		if (followingIndex < queue.length) {
			const followingTrack = queue[followingIndex];
			try {
				const url = await getStreamUrl(followingTrack.id);
				window.electronAPI?.mpv?.autoNext(url);
			} catch {
				window.electronAPI?.mpv?.autoNext();
			}
		} else {
			window.electronAPI?.mpv?.autoNext();
		}

		// Trigger queue sync
		debouncedSaveQueue();
	}
}

// Fall back to HTML5 audio when MPV fails
function switchToHtml5Fallback() {
	const wasPlaying = playerState.isPlaying;
	const currentTrack = playerState.currentTrack;
	const currentTime = playerState.currentTime;

	// Destroy current backend
	if (currentBackend) {
		currentBackend.destroy();
		currentBackend = null;
	}

	// Create HTML5 backend
	currentBackend = new Html5AudioBackend();
	currentBackendType = "html5";
	currentBackend.setVolume(playerState.volume);
	currentBackend.setEventHandlers(getBackendEventHandlers());

	// Resume playback if we had a track
	if (currentTrack && wasPlaying) {
		playSong(currentTrack, playerState.queue, playerState.queueIndex).then(
			() => {
				seek(currentTime);
			},
		);
	}
}

function getAudioBackend(): AudioBackend {
	const settings = getSettings();
	const desiredType = settings.audioBackend;

	// Check if we need to switch backends
	if (currentBackend && currentBackendType !== desiredType) {
		currentBackend.destroy();
		currentBackend = null;
	}

	if (!currentBackend) {
		// For MPV, check if it's available (Electron only)
		if (desiredType === "mpv" && window.electronAPI?.mpv) {
			currentBackend = new MpvAudioBackend();
			currentBackendType = "mpv";
		} else {
			currentBackend = new Html5AudioBackend();
			currentBackendType = "html5";
		}

		currentBackend.setVolume(playerState.volume);
		currentBackend.setEventHandlers(getBackendEventHandlers());

		// Set up MPRIS control listeners (works for both backends on Linux)
		setupMprisControlListeners();
	}

	return currentBackend;
}

// Export function to switch backends at runtime
export function switchAudioBackend(type: "html5" | "mpv"): void {
	if (currentBackend && currentBackendType !== type) {
		const wasPlaying = playerState.isPlaying;
		const currentTime = playerState.currentTime;
		const currentTrack = playerState.currentTrack;

		// Stop current backend
		currentBackend.stop();
		currentBackend.destroy();
		currentBackend = null;

		// Create new backend
		getAudioBackend();

		// Resume playback if we had a track
		if (currentTrack && wasPlaying) {
			playSong(currentTrack, playerState.queue, playerState.queueIndex).then(
				() => {
					seek(currentTime);
				},
			);
		}
	}
}

// Export current backend type for UI
export function getCurrentBackendType(): "html5" | "mpv" {
	return currentBackendType;
}

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
	// Get cover art URL first (needed for both Media Session and MPRIS)
	getTrackCoverUrl(song.coverArt, 300).then((coverUrl) => {
		// Update browser Media Session API (if available)
		if ("mediaSession" in navigator) {
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
		}

		// Update MPRIS metadata (works for both HTML5 and MPV backends)
		updateMprisMetadata(song, coverUrl || undefined);
	});
}

function updateMediaSessionState(isPlaying: boolean) {
	if ("mediaSession" in navigator) {
		navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
	}

	// Update MPRIS playback status (works for both HTML5 and MPV backends)
	updateMprisPlaybackStatus(isPlaying);
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
	const backend = getAudioBackend();

	// Reset scrobble state for new song
	scrobbledTrackId = null;

	const newQueue = queue ?? [song];
	const currentIndex = startIndex ?? 0;
	updateState({
		currentTrack: song,
		queue: newQueue,
		originalQueue:
			playerState.originalQueue.length > 0
				? playerState.originalQueue
				: newQueue,
		queueIndex: currentIndex,
		isLoading: true,
	});

	// Trigger queue sync
	debouncedSaveQueue();

	try {
		const streamUrl = await getStreamUrl(song.id);

		// For MPV backend, use setQueue with next track for gapless playback
		if (backend.name === "mpv" && currentIndex + 1 < newQueue.length) {
			const nextTrack = newQueue[currentIndex + 1];
			const nextUrl = await getStreamUrl(nextTrack.id);
			await backend.setQueue(streamUrl, nextUrl, false);
		} else {
			await backend.play(streamUrl);
		}

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
	const backend = getAudioBackend();
	if (playerState.isPlaying) {
		backend.pause();
		updateState({ isPlaying: false });
	} else if (playerState.currentTrack) {
		backend.resume();
		updateState({ isPlaying: true });
	}
}

export function pause() {
	getAudioBackend().pause();
	updateState({ isPlaying: false });
}

export function play() {
	if (playerState.currentTrack) {
		getAudioBackend().resume();
	}
}

export async function playNext() {
	const { queue, queueIndex, repeat, currentTrack } = playerState;
	if (queue.length === 0) return;

	// Repeat one: replay current track
	if (repeat === "one" && currentTrack) {
		seek(0);
		getAudioBackend().resume();
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
		getAudioBackend().pause();
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
	const backend = getAudioBackend();
	// Update state immediately for smooth UI
	updateState({ currentTime: time });
	backend.seek(time);
}

export function setVolume(volume: number) {
	const backend = getAudioBackend();
	const clampedVolume = Math.max(0, Math.min(1, volume));
	backend.setVolume(clampedVolume);
	updateState({ volume: clampedVolume });
	saveVolumeToStorage(clampedVolume);
	// Update MPRIS volume (works for both HTML5 and MPV backends)
	updateMprisVolume(clampedVolume);
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
	const backend = getAudioBackend();
	backend.stop();
	updateState({ ...initialState, volume: playerState.volume });
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

		// Prepare audio backend but don't play
		// For HTML5, we need to load the source
		const backend = getAudioBackend();
		if (backend.name === "html5") {
			const streamUrl = await getStreamUrl(songs[currentIndex].id);
			// For HTML5, we need to access the underlying audio element
			// This is a bit of a hack, but necessary for restoring position
			const html5Backend = backend as InstanceType<typeof Html5AudioBackend>;
			await html5Backend.play(streamUrl);
			html5Backend.pause();
			backend.seek(positionMs / 1000);
		}

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
