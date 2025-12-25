import { useSyncExternalStore } from "react";
import type { Song } from "./api";
import { getCoverArtUrl, getStreamUrl, scrobble } from "./api";

export interface PlayerState {
	currentTrack: Song | null;
	queue: Song[];
	queueIndex: number;
	isPlaying: boolean;
	volume: number;
	currentTime: number;
	duration: number;
	isLoading: boolean;
}

const initialState: PlayerState = {
	currentTrack: null,
	queue: [],
	queueIndex: -1,
	isPlaying: false,
	volume: 1,
	currentTime: 0,
	duration: 0,
	isLoading: false,
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
		});

		audio.addEventListener("pause", () => {
			updateState({ isPlaying: false });
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

// Player actions
export async function playSong(
	song: Song,
	queue?: Song[],
	startIndex?: number,
) {
	const audioEl = getAudio();

	// Reset scrobble state for new song
	scrobbledTrackId = null;

	updateState({
		currentTrack: song,
		queue: queue ?? [song],
		queueIndex: startIndex ?? 0,
		isLoading: true,
	});

	try {
		const streamUrl = await getStreamUrl(song.id);
		audioEl.src = streamUrl;
		await audioEl.play();

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
	const { queue, queueIndex } = playerState;
	if (queue.length === 0) return;

	const nextIndex = queueIndex + 1;
	if (nextIndex < queue.length) {
		await playSong(queue[nextIndex], queue, nextIndex);
	} else {
		// End of queue
		updateState({ isPlaying: false });
		getAudio().pause();
	}
}

export async function playPrevious() {
	const { queue, queueIndex, currentTime } = playerState;
	if (queue.length === 0) return;

	// If more than 3 seconds in, restart current track
	if (currentTime > 3) {
		seek(0);
		return;
	}

	const prevIndex = queueIndex - 1;
	if (prevIndex >= 0) {
		await playSong(queue[prevIndex], queue, prevIndex);
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
}

export function addToQueue(songs: Song[]) {
	updateState({
		queue: [...playerState.queue, ...songs],
	});
}

export function clearQueue() {
	const audioEl = getAudio();
	audioEl.pause();
	audioEl.src = "";
	updateState({ ...initialState });
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
		clearQueue,
	};
}
