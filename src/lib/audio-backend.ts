// ============================================================================
// Audio Backend Interface
// ============================================================================

export interface AudioBackendEvents {
	onTimeUpdate: (time: number, duration: number) => void;
	onEnded: () => void;
	onAutoNext: () => void;
	onPlaying: () => void;
	onPaused: () => void;
	onLoading: () => void;
	onCanPlay: () => void;
	onError: (error: Error) => void;
	onFallback: (shouldFallback: boolean) => void;
}

export interface AudioBackend {
	readonly name: string;

	// Lifecycle
	initialize(): Promise<boolean>;
	destroy(): void;

	// Playback controls
	play(url: string): Promise<void>;
	setQueue(current: string, next?: string, pause?: boolean): Promise<void>;
	setQueueNext(url?: string): Promise<void>;
	pause(): void;
	resume(): void;
	stop(): void;
	seek(time: number): void;
	setVolume(volume: number): void;

	// State getters
	getCurrentTime(): number;
	getDuration(): number;
	getVolume(): number;
	isPlaying(): boolean;

	// Event binding
	setEventHandlers(handlers: AudioBackendEvents): void;
}

// ============================================================================
// HTML5 Audio Backend
// ============================================================================

export class Html5AudioBackend implements AudioBackend {
	readonly name = "html5";
	private audio: HTMLAudioElement;
	private handlers: AudioBackendEvents | null = null;

	constructor() {
		this.audio = new Audio();
		this.setupEventListeners();
	}

	async initialize(): Promise<boolean> {
		// HTML5 Audio is always available
		return true;
	}

	private setupEventListeners() {
		this.audio.addEventListener("timeupdate", () => {
			this.handlers?.onTimeUpdate(
				this.audio.currentTime,
				this.audio.duration || 0,
			);
		});

		this.audio.addEventListener("durationchange", () => {
			this.handlers?.onTimeUpdate(
				this.audio.currentTime,
				this.audio.duration || 0,
			);
		});

		this.audio.addEventListener("ended", () => {
			this.handlers?.onEnded();
		});

		this.audio.addEventListener("playing", () => {
			this.handlers?.onPlaying();
		});

		this.audio.addEventListener("pause", () => {
			this.handlers?.onPaused();
		});

		this.audio.addEventListener("waiting", () => {
			this.handlers?.onLoading();
		});

		this.audio.addEventListener("canplay", () => {
			this.handlers?.onCanPlay();
		});

		this.audio.addEventListener("error", () => {
			this.handlers?.onError(
				new Error(this.audio.error?.message || "Audio error"),
			);
		});
	}

	async play(url: string): Promise<void> {
		this.audio.src = url;
		await this.audio.play();
	}

	async setQueue(
		current: string,
		_next?: string,
		pause?: boolean,
	): Promise<void> {
		// HTML5 doesn't support queue, just play the current track
		this.audio.src = current;
		if (!pause) {
			await this.audio.play();
		}
	}

	async setQueueNext(_url?: string): Promise<void> {
		// HTML5 doesn't support preloading next track
	}

	pause(): void {
		this.audio.pause();
	}

	resume(): void {
		this.audio.play();
	}

	stop(): void {
		this.audio.pause();
		this.audio.src = "";
	}

	seek(time: number): void {
		if (this.audio.src) {
			this.audio.currentTime = time;
		}
	}

	setVolume(volume: number): void {
		this.audio.volume = Math.max(0, Math.min(1, volume));
	}

	getCurrentTime(): number {
		return this.audio.currentTime;
	}

	getDuration(): number {
		return this.audio.duration || 0;
	}

	getVolume(): number {
		return this.audio.volume;
	}

	isPlaying(): boolean {
		return !this.audio.paused;
	}

	setEventHandlers(handlers: AudioBackendEvents): void {
		this.handlers = handlers;
	}

	destroy(): void {
		this.audio.pause();
		this.audio.src = "";
		this.handlers = null;
	}
}

// ============================================================================
// MPV Backend (Electron only)
// ============================================================================

export class MpvAudioBackend implements AudioBackend {
	readonly name = "mpv";
	private handlers: AudioBackendEvents | null = null;
	private currentTime = 0;
	private duration = 0;
	private volume = 1;
	private playing = false;
	private initialized = false;
	private cleanupFns: Array<() => void> = [];

	async initialize(): Promise<boolean> {
		const mpv = window.electronAPI?.mpv;
		if (!mpv) {
			console.warn("MPV API not available");
			return false;
		}

		try {
			// Initialize MPV instance
			const success = await mpv.initialize();
			if (!success) {
				console.warn("MPV initialization returned false");
				return false;
			}

			this.setupEventListeners();
			this.initialized = true;
			return true;
		} catch (error) {
			console.error("Failed to initialize MPV:", error);
			return false;
		}
	}

	private setupEventListeners() {
		const mpv = window.electronAPI?.mpv;
		if (!mpv) return;

		// Subscribe to MPV events
		const cleanupTimeUpdate = mpv.onTimeUpdate(
			(data: { position: number; duration: number }) => {
				this.currentTime = data.position;
				this.duration = data.duration;
				this.handlers?.onTimeUpdate(data.position, data.duration);
			},
		);
		this.cleanupFns.push(cleanupTimeUpdate);

		const cleanupEnded = mpv.onEnded(() => {
			this.playing = false;
			this.handlers?.onEnded();
		});
		this.cleanupFns.push(cleanupEnded);

		const cleanupAutoNext = mpv.onAutoNext(() => {
			this.handlers?.onAutoNext();
		});
		this.cleanupFns.push(cleanupAutoNext);

		const cleanupError = mpv.onError((error: string) => {
			this.handlers?.onError(new Error(error));
		});
		this.cleanupFns.push(cleanupError);

		const cleanupStateChange = mpv.onStateChange(
			(state: { playing: boolean; loading: boolean }) => {
				this.playing = state.playing;
				if (state.loading) {
					this.handlers?.onLoading();
				} else if (state.playing) {
					this.handlers?.onPlaying();
				} else {
					this.handlers?.onPaused();
				}
			},
		);
		this.cleanupFns.push(cleanupStateChange);

		const cleanupFallback = mpv.onFallback((shouldFallback: boolean) => {
			this.handlers?.onFallback(shouldFallback);
		});
		this.cleanupFns.push(cleanupFallback);

		// MPRIS control event listeners
		if (mpv.onMprisPlayPause) {
			const cleanupMprisPlayPause = mpv.onMprisPlayPause(() => {
				if (this.playing) {
					this.pause();
				} else {
					this.resume();
				}
			});
			this.cleanupFns.push(cleanupMprisPlayPause);
		}

		if (mpv.onMprisPlay) {
			const cleanupMprisPlay = mpv.onMprisPlay(() => {
				this.resume();
			});
			this.cleanupFns.push(cleanupMprisPlay);
		}

		if (mpv.onMprisPause) {
			const cleanupMprisPause = mpv.onMprisPause(() => {
				this.pause();
			});
			this.cleanupFns.push(cleanupMprisPause);
		}

		if (mpv.onMprisStop) {
			const cleanupMprisStop = mpv.onMprisStop(() => {
				this.stop();
			});
			this.cleanupFns.push(cleanupMprisStop);
		}

		if (mpv.onMprisSeek) {
			const cleanupMprisSeek = mpv.onMprisSeek((offset: number) => {
				// Seek is relative offset in seconds
				const newTime = this.currentTime + offset;
				this.seek(Math.max(0, newTime));
			});
			this.cleanupFns.push(cleanupMprisSeek);
		}

		if (mpv.onMprisSetPosition) {
			const cleanupMprisSetPosition = mpv.onMprisSetPosition(
				(position: number) => {
					// SetPosition is absolute position in seconds
					this.seek(position);
				},
			);
			this.cleanupFns.push(cleanupMprisSetPosition);
		}

		if (mpv.onMprisVolume) {
			const cleanupMprisVolume = mpv.onMprisVolume((volume: number) => {
				// Volume is 0-100, convert to 0-1
				this.setVolume(volume / 100);
			});
			this.cleanupFns.push(cleanupMprisVolume);
		}

		// Note: onMprisNext and onMprisPrevious are handled at the player level
		// since they need access to the queue state
	}

	async play(url: string): Promise<void> {
		const mpv = window.electronAPI?.mpv;
		if (!mpv) throw new Error("MPV not available");

		if (!this.initialized) {
			const success = await this.initialize();
			if (!success) {
				throw new Error("Failed to initialize MPV");
			}
		}

		await mpv.play(url);
		this.playing = true;
		this.handlers?.onPlaying();
	}

	async setQueue(
		current: string,
		next?: string,
		pause?: boolean,
	): Promise<void> {
		const mpv = window.electronAPI?.mpv;
		if (!mpv) throw new Error("MPV not available");

		if (!this.initialized) {
			const success = await this.initialize();
			if (!success) {
				throw new Error("Failed to initialize MPV");
			}
		}

		await mpv.setQueue(current, next, pause);
		if (!pause) {
			this.playing = true;
			this.handlers?.onPlaying();
		}
	}

	async setQueueNext(url?: string): Promise<void> {
		const mpv = window.electronAPI?.mpv;
		if (!mpv) return;

		await mpv.setQueueNext(url);
	}

	pause(): void {
		const mpv = window.electronAPI?.mpv;
		if (!mpv) return;
		mpv.pause();
		this.playing = false;
	}

	resume(): void {
		const mpv = window.electronAPI?.mpv;
		if (!mpv) return;
		mpv.resume();
		this.playing = true;
	}

	stop(): void {
		const mpv = window.electronAPI?.mpv;
		if (!mpv) return;
		mpv.stop();
		this.playing = false;
		this.currentTime = 0;
		this.duration = 0;
	}

	seek(time: number): void {
		const mpv = window.electronAPI?.mpv;
		if (!mpv) return;
		mpv.seek(time);
		this.currentTime = time;
	}

	setVolume(volume: number): void {
		const mpv = window.electronAPI?.mpv;
		if (!mpv) return;
		this.volume = Math.max(0, Math.min(1, volume));
		// Convert 0-1 to 0-100 and use fire-and-forget (send, not invoke)
		mpv.volume(Math.round(this.volume * 100));
	}

	getCurrentTime(): number {
		return this.currentTime;
	}

	getDuration(): number {
		return this.duration;
	}

	getVolume(): number {
		return this.volume;
	}

	isPlaying(): boolean {
		return this.playing;
	}

	setEventHandlers(handlers: AudioBackendEvents): void {
		this.handlers = handlers;
	}

	destroy(): void {
		const mpv = window.electronAPI?.mpv;
		if (mpv) {
			mpv.stop();
			mpv.quit();
		}
		for (const cleanup of this.cleanupFns) {
			cleanup();
		}
		this.cleanupFns = [];
		this.handlers = null;
		this.initialized = false;
	}
}
