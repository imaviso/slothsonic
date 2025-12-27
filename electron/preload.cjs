const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
	platform: process.platform,
	isElectron: true,

	// MPV audio backend
	mpv: {
		// Availability and configuration
		isAvailable: (customPath) =>
			ipcRenderer.invoke("mpv:isAvailable", customPath),
		setPath: (path) => ipcRenderer.invoke("mpv:setPath", path),
		getPath: () => ipcRenderer.invoke("mpv:getPath"),
		selectPath: () => ipcRenderer.invoke("mpv:selectPath"),

		// Lifecycle
		initialize: (data) => ipcRenderer.invoke("mpv:initialize", data),
		restart: (data) => ipcRenderer.invoke("mpv:restart", data),
		isRunning: () => ipcRenderer.invoke("mpv:isRunning"),
		cleanup: () => ipcRenderer.invoke("mpv:cleanup"),
		quit: () => ipcRenderer.send("mpv:quit"),

		// Playback controls
		play: (url) => ipcRenderer.invoke("mpv:play", url),
		setQueue: (current, next, pause) =>
			ipcRenderer.invoke("mpv:setQueue", current, next, pause),
		setQueueNext: (url) => ipcRenderer.invoke("mpv:setQueueNext", url),
		autoNext: (url) => ipcRenderer.send("mpv:autoNext", url),
		pause: () => ipcRenderer.invoke("mpv:pause"),
		resume: () => ipcRenderer.invoke("mpv:resume"),
		stop: () => ipcRenderer.invoke("mpv:stop"),
		seek: (time) => ipcRenderer.invoke("mpv:seek", time),
		volume: (value) => ipcRenderer.send("mpv:volume", value),
		mute: (mute) => ipcRenderer.send("mpv:mute", mute),
		setMetadata: (metadata) => ipcRenderer.send("mpris:updateSong", metadata),
		setPlaybackStatus: (status) => ipcRenderer.send("mpris:updatePlaybackStatus", status),
		setMprisPosition: (seconds) => ipcRenderer.send("mpris:updatePosition", seconds),
		updateSeek: (seconds) => ipcRenderer.send("mpris:updateSeek", seconds),
		updateVolume: (volume) => ipcRenderer.send("mpris:updateVolume", volume),

		// State queries
		getPosition: () => ipcRenderer.invoke("mpv:getPosition"),
		getDuration: () => ipcRenderer.invoke("mpv:getDuration"),

		// Event listeners - return cleanup functions
		onTimeUpdate: (callback) => {
			const handler = (_, data) => callback(data);
			ipcRenderer.on("mpv:timeUpdate", handler);
			return () => ipcRenderer.removeListener("mpv:timeUpdate", handler);
		},
		onEnded: (callback) => {
			const handler = () => callback();
			ipcRenderer.on("mpv:ended", handler);
			return () => ipcRenderer.removeListener("mpv:ended", handler);
		},
		onAutoNext: (callback) => {
			const handler = () => callback();
			ipcRenderer.on("mpv:autoNext", handler);
			return () => ipcRenderer.removeListener("mpv:autoNext", handler);
		},
		onError: (callback) => {
			const handler = (_, error) => callback(error);
			ipcRenderer.on("mpv:error", handler);
			return () => ipcRenderer.removeListener("mpv:error", handler);
		},
		onStateChange: (callback) => {
			const handler = (_, state) => callback(state);
			ipcRenderer.on("mpv:stateChange", handler);
			return () => ipcRenderer.removeListener("mpv:stateChange", handler);
		},
		onFallback: (callback) => {
			const handler = (_, isError) => callback(isError);
			ipcRenderer.on("mpv:fallback", handler);
			return () => ipcRenderer.removeListener("mpv:fallback", handler);
		},

		// MPRIS control events (from D-Bus)
		onMprisPlay: (callback) => {
			const handler = () => callback();
			ipcRenderer.on("mpris:play", handler);
			return () => ipcRenderer.removeListener("mpris:play", handler);
		},
		onMprisPause: (callback) => {
			const handler = () => callback();
			ipcRenderer.on("mpris:pause", handler);
			return () => ipcRenderer.removeListener("mpris:pause", handler);
		},
		onMprisPlayPause: (callback) => {
			const handler = () => callback();
			ipcRenderer.on("mpris:playPause", handler);
			return () => ipcRenderer.removeListener("mpris:playPause", handler);
		},
		onMprisStop: (callback) => {
			const handler = () => callback();
			ipcRenderer.on("mpris:stop", handler);
			return () => ipcRenderer.removeListener("mpris:stop", handler);
		},
		onMprisNext: (callback) => {
			const handler = () => callback();
			ipcRenderer.on("mpris:next", handler);
			return () => ipcRenderer.removeListener("mpris:next", handler);
		},
		onMprisPrevious: (callback) => {
			const handler = () => callback();
			ipcRenderer.on("mpris:previous", handler);
			return () => ipcRenderer.removeListener("mpris:previous", handler);
		},
		onMprisSeek: (callback) => {
			const handler = (_, offset) => callback(offset);
			ipcRenderer.on("mpris:seek", handler);
			return () => ipcRenderer.removeListener("mpris:seek", handler);
		},
		onMprisSetPosition: (callback) => {
			const handler = (_, position) => callback(position);
			ipcRenderer.on("mpris:setPosition", handler);
			return () => ipcRenderer.removeListener("mpris:setPosition", handler);
		},
		onMprisVolume: (callback) => {
			const handler = (_, volume) => callback(volume);
			ipcRenderer.on("mpris:volume", handler);
			return () => ipcRenderer.removeListener("mpris:volume", handler);
		},
	},
});
