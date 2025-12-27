/**
 * MPRIS D-Bus interface implementation for Linux desktop integration.
 * Uses mpris-service package for MPRIS2 support.
 *
 * @see https://specifications.freedesktop.org/mpris-spec/latest/
 */

import { ipcMain } from "electron";
import Player from "mpris-service";

let mprisPlayer = null;
let mainWindowGetter = null;

/**
 * Initialize the MPRIS service
 * @param {() => import('electron').BrowserWindow | null} getMainWindow - Function to get the main window
 */
export function initializeMpris(getMainWindow) {
	if (process.platform !== "linux") {
		console.log("[MPRIS] Not on Linux, skipping initialization");
		return false;
	}

	try {
		mainWindowGetter = getMainWindow;

		mprisPlayer = Player({
			identity: "Slothsonic",
			maximumRate: 1.0,
			minimumRate: 1.0,
			name: "slothsonic",
			rate: 1.0,
			supportedInterfaces: ["player"],
			supportedMimeTypes: ["audio/mpeg", "audio/flac", "audio/ogg", "audio/wav"],
			supportedUriSchemes: ["http", "https"],
		});

		setupEventHandlers();
		setupIpcHandlers();

		console.log("[MPRIS] Service initialized successfully");
		return true;
	} catch (error) {
		console.error("[MPRIS] Failed to initialize:", error);
		return false;
	}
}

/**
 * Check if there's valid metadata
 */
function hasData() {
	return mprisPlayer?.metadata && !!mprisPlayer.metadata["mpris:length"];
}

/**
 * Get the main window and send a message
 */
function sendToRenderer(channel, data = null) {
	const mainWindow = mainWindowGetter?.();
	if (mainWindow && !mainWindow.isDestroyed()) {
		if (data !== null) {
			mainWindow.webContents.send(channel, data);
		} else {
			mainWindow.webContents.send(channel);
		}
	}
}

/**
 * Setup MPRIS event handlers
 */
function setupEventHandlers() {
	if (!mprisPlayer) return;

	mprisPlayer.on("quit", () => {
		process.exit();
	});

	mprisPlayer.on("raise", () => {
		const mainWindow = mainWindowGetter?.();
		if (mainWindow) {
			if (mainWindow.isMinimized()) mainWindow.restore();
			mainWindow.focus();
		}
	});

	mprisPlayer.on("stop", () => {
		sendToRenderer("mpris:stop");
		mprisPlayer.playbackStatus = "Paused";
	});

	mprisPlayer.on("pause", () => {
		if (!hasData()) return;
		sendToRenderer("mpris:pause");
		mprisPlayer.playbackStatus = "Paused";
	});

	mprisPlayer.on("play", () => {
		if (!hasData()) return;
		sendToRenderer("mpris:play");
		mprisPlayer.playbackStatus = "Playing";
	});

	mprisPlayer.on("playpause", () => {
		if (!hasData()) return;
		sendToRenderer("mpris:playPause");
		if (mprisPlayer.playbackStatus !== "Playing") {
			mprisPlayer.playbackStatus = "Playing";
		} else {
			mprisPlayer.playbackStatus = "Paused";
		}
	});

	mprisPlayer.on("next", () => {
		if (!hasData()) return;
		sendToRenderer("mpris:next");
		if (mprisPlayer.playbackStatus !== "Playing") {
			mprisPlayer.playbackStatus = "Playing";
		}
	});

	mprisPlayer.on("previous", () => {
		if (!hasData()) return;
		sendToRenderer("mpris:previous");
		if (mprisPlayer.playbackStatus !== "Playing") {
			mprisPlayer.playbackStatus = "Playing";
		}
	});

	mprisPlayer.on("volume", (vol) => {
		let volume = Math.round(vol * 100);
		if (volume > 100) volume = 100;
		if (volume < 0) volume = 0;
		sendToRenderer("mpris:volume", volume);
		mprisPlayer.volume = volume / 100;
	});

	mprisPlayer.on("position", (event) => {
		sendToRenderer("mpris:setPosition", event.position / 1e6);
	});

	mprisPlayer.on("seek", (offset) => {
		sendToRenderer("mpris:seek", offset / 1e6);
	});
}

/**
 * Setup IPC handlers for renderer -> main communication
 */
function setupIpcHandlers() {
	// Update position (for getPosition callback)
	ipcMain.on("mpris:updatePosition", (_event, timeSec) => {
		if (mprisPlayer) {
			mprisPlayer.getPosition = () => timeSec * 1e6;
		}
	});

	// Update seek (emit seeked signal)
	ipcMain.on("mpris:updateSeek", (_event, timeSec) => {
		if (mprisPlayer) {
			mprisPlayer.seeked(timeSec * 1e6);
		}
	});

	// Update volume
	ipcMain.on("mpris:updateVolume", (_event, volume) => {
		if (mprisPlayer) {
			mprisPlayer.volume = Number(volume) / 100;
		}
	});

	// Update playback status
	ipcMain.on("mpris:updatePlaybackStatus", (_event, status) => {
		if (mprisPlayer) {
			mprisPlayer.playbackStatus = status;
		}
	});

	// Update song metadata
	ipcMain.on("mpris:updateSong", (_event, metadata) => {
		if (!mprisPlayer) return;

		try {
			if (!metadata?.trackId) {
				mprisPlayer.metadata = {};
				return;
			}

			mprisPlayer.metadata = {
				"mpris:artUrl": metadata.artUrl || null,
				"mpris:length": metadata.length
					? Math.round(metadata.length * 1e6)
					: null,
				"mpris:trackid": metadata.trackId
					? mprisPlayer.objectPath(`track/${metadata.trackId.replace(/-/g, "")}`)
					: "",
				"xesam:album": metadata.album || null,
				"xesam:artist": metadata.artist ? [metadata.artist] : null,
				"xesam:title": metadata.title || null,
			};
		} catch (err) {
			console.error("[MPRIS] Failed to update metadata:", err);
		}
	});
}

/**
 * Destroy the MPRIS service
 */
export function destroyMpris() {
	if (mprisPlayer) {
		try {
			// mpris-service doesn't have an explicit destroy method,
			// but we can clear the reference
			mprisPlayer = null;
			console.log("[MPRIS] Service destroyed");
		} catch (error) {
			console.error("[MPRIS] Error destroying service:", error);
		}
	}
}
