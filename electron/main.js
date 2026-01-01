import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import { pid } from "node:process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import MpvAPI from "node-mpv";
import { initializeMpris, destroyMpris } from "./mpris.js";

// Disable Chromium's built-in MPRIS integration on Linux
// We use our own MPRIS service for better control over metadata (including cover art)
if (process.platform === "linux") {
	app.commandLine.appendSwitch("disable-features", "HardwareMediaKeyHandling,MediaSessionService");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (process.platform === "win32") {
	app.setAppUserModelId(app.getName());
}

let mainWindow = null;
// Check if we're in dev mode: either not packaged OR dist folder doesn't exist
const isDev = !app.isPackaged && !existsSync(path.join(__dirname, "../dist"));

// ============================================================================
// MPV Controller using node-mpv
// ============================================================================

const isWindows = process.platform === "win32";
const socketPath = isWindows
	? `\\\\.\\pipe\\mpv-subsonic-${pid}`
	: `/tmp/mpv-subsonic-${pid}.sock`;

let mpvInstance = null;
let mpvPath = null; // Will be detected or set by user
let currentVolume = 100;
let lastPlaylistPos = 0; // Track expected playlist position
let autoNextLock = false; // Prevent duplicate autoNext events
let autoNextTimeout = null; // Debounce timeout

// Common paths where MPV might be installed
const MPV_SEARCH_PATHS = isWindows
	? [
			"C:\\Program Files\\mpv\\mpv.exe",
			"C:\\Program Files (x86)\\mpv\\mpv.exe",
		]
	: [
			"/run/current-system/sw/bin/mpv", // NixOS system
			`${process.env.HOME}/.nix-profile/bin/mpv`, // NixOS user profile
			"/usr/bin/mpv",
			"/usr/local/bin/mpv",
			"/opt/homebrew/bin/mpv", // macOS Homebrew ARM
		];

// Find MPV binary
function findMpvBinary() {
	// First check if mpv is in PATH
	try {
		const whichCmd = isWindows ? "where mpv" : "which mpv";
		const result = execSync(whichCmd, { encoding: "utf-8" }).trim();
		if (result) {
			return result.split("\n")[0]; // Take first result
		}
	} catch {
		// mpv not in PATH, check known locations
	}

	// Check known paths
	for (const p of MPV_SEARCH_PATHS) {
		if (existsSync(p)) {
			return p;
		}
	}

	return null;
}

// State machine for cleanup
const MpvState = {
	STARTED: 0,
	IN_PROGRESS: 1,
	DONE: 2,
};
let mpvState = MpvState.STARTED;

const mpvLog = (action, error = null) => {
	const message = `[MPV] ${action}`;
	if (error) {
		console.error(message, error);
	} else {
		console.log(message);
	}
};

const DEFAULT_MPV_PARAMETERS = [
	"--idle=yes",
	"--no-config",
	"--no-terminal",
	"--load-scripts=no",
	"--prefetch-playlist=yes",
];

const createMpv = async (options = {}) => {
	const { binaryPath, extraParameters = [], properties = {} } = options;

	// Determine which binary to use
	const effectiveBinary = binaryPath || mpvPath || findMpvBinary();
	if (!effectiveBinary) {
		throw new Error("MPV binary not found. Please install MPV or specify the path in settings.");
	}

	mpvLog(`Using MPV binary: ${effectiveBinary}`);

	// Build parameters
	const params = [...DEFAULT_MPV_PARAMETERS, ...extraParameters];

	const mpv = new MpvAPI(
		{
			audio_only: true,
			auto_restart: false,
			binary: effectiveBinary,
			socket: socketPath,
			time_update: 1,
		},
		params,
	);

	try {
		await mpv.start();
		mpvLog("Started successfully");

		// TODO: BUG - First song playback sometimes fails with "Unable to load file or stream"
		// even though subsequent plays work fine. The readiness check below helps but doesn't
		// fully fix the race condition. Possibly related to node-mpv IPC socket timing.

		// Wait for MPV to be fully ready by making a simple query
		// This ensures the IPC socket is connected and responsive
		let retries = 10;
		while (retries > 0) {
			try {
				await mpv.getProperty("idle-active");
				break;
			} catch {
				retries--;
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}
		if (retries === 0) {
			mpvLog("Warning: MPV may not be fully ready");
		}
	} catch (error) {
		mpvLog("Failed to start", error);
		throw error;
	}

	// Set initial properties
	if (Object.keys(properties).length > 0) {
		try {
			await mpv.setMultipleProperties(properties);
		} catch (error) {
			mpvLog("Failed to set properties", error);
		}
	}

	// Set initial volume
	try {
		await mpv.volume(currentVolume);
	} catch (error) {
		mpvLog("Failed to set initial volume", error);
	}

	// Event: playlist position changed (track ended, auto-next) and pause state
	mpv.on("status", (status) => {
		if (status.property === "playlist-pos") {
			const newPos = status.value;
			
			if (newPos === -1) {
				// End of playlist
				mpv?.pause();
				lastPlaylistPos = 0;
			} else if (newPos > lastPlaylistPos && !autoNextLock) {
				// MPV auto-advanced to next track (position increased)
				// Use a lock and debounce to prevent duplicate events
				autoNextLock = true;
				
				// Clear any pending timeout
				if (autoNextTimeout) {
					clearTimeout(autoNextTimeout);
				}
				
				// Debounce: wait a short moment to ensure we don't fire multiple times
				autoNextTimeout = setTimeout(() => {
					sendToRenderer("mpv:autoNext");
					// Reset lock after a delay to allow next transition
					setTimeout(() => {
						autoNextLock = false;
					}, 500);
				}, 50);
				
				lastPlaylistPos = newPos;
			} else if (newPos === 0 && lastPlaylistPos > 0) {
				// Playlist was reset (e.g., after we removed tracks)
				lastPlaylistPos = 0;
			}
		}
		// Handle pause state changes via status event
		if (status.property === "pause") {
			if (status.value === true) {
				sendToRenderer("mpv:stateChange", { playing: false, loading: false });
			} else if (status.value === false) {
				sendToRenderer("mpv:stateChange", { playing: true, loading: false });
			}
		}
	});

	// Event: playback resumed
	mpv.on("resumed", () => {
		sendToRenderer("mpv:stateChange", { playing: true, loading: false });
	});

	// Event: playback stopped
	mpv.on("stopped", () => {
		sendToRenderer("mpv:stateChange", { playing: false, loading: false });
		sendToRenderer("mpv:ended");
	});

	// Event: playback paused
	mpv.on("paused", () => {
		sendToRenderer("mpv:stateChange", { playing: false, loading: false });
	});

	// Event: time position update (every second)
	mpv.on("timeposition", async (time) => {
		try {
			const duration = await mpv.getDuration();
			sendToRenderer("mpv:timeUpdate", {
				position: time,
				duration: duration || 0,
			});
		} catch {
			sendToRenderer("mpv:timeUpdate", { position: time, duration: 0 });
		}
	});

	return mpv;
};

const getMpvInstance = () => mpvInstance;

const sendToRenderer = (channel, data = null) => {
	if (mainWindow && !mainWindow.isDestroyed()) {
		if (data !== null) {
			mainWindow.webContents.send(channel, data);
		} else {
			mainWindow.webContents.send(channel);
		}
	}
};

const setAudioPlayerFallback = (isError) => {
	sendToRenderer("mpv:fallback", isError);
};

const quit = async (instance = null) => {
	const mpv = instance || getMpvInstance();
	if (mpv) {
		try {
			await mpv.quit();
		} catch {
			// If quit() fails, try to kill the process directly
			const mpvProcess = mpv.process || mpv.mpvProcess;
			if (mpvProcess && typeof mpvProcess.kill === "function") {
				try {
					mpvProcess.kill("SIGTERM");
				} catch (killErr) {
					mpvLog("Failed to kill mpv process", killErr);
				}
			}
		}

		// Clean up socket file on Unix
		if (!isWindows) {
			try {
				await rm(socketPath);
			} catch {
				// Ignore errors when removing socket file
			}
		}
	}
};

// Cleanup function for multiple exit scenarios
const cleanupMpv = async (force = false) => {
	if (mpvState === MpvState.DONE && !force) {
		return;
	}

	const instance = getMpvInstance();
	if (instance) {
		try {
			if (!force) {
				await instance.stop();
			}
			await quit(instance);
		} catch (err) {
			mpvLog("Failed to cleanup mpv", err);
			// Force kill as fallback
			const mpvProcess = instance.process || instance.mpvProcess;
			if (mpvProcess && typeof mpvProcess.kill === "function") {
				try {
					mpvProcess.kill("SIGKILL");
				} catch {
					// Ignore kill errors
				}
			}
		} finally {
			mpvInstance = null;
		}
	}
};

// ============================================================================
// IPC Handlers
// ============================================================================

function setupMpvIpcHandlers() {
	// Check if MPV is available
	ipcMain.handle("mpv:isAvailable", async (_, customPath) => {
		const testPath = customPath || mpvPath || findMpvBinary();
		if (!testPath) {
			return false;
		}

		try {
			const testMpv = new MpvAPI(
				{
					audio_only: true,
					auto_restart: false,
					binary: testPath,
					socket: isWindows
						? `\\\\.\\pipe\\mpv-test-${pid}`
						: `/tmp/mpv-test-${pid}.sock`,
				},
				["--idle=yes", "--no-config"],
			);

			await testMpv.start();
			await testMpv.quit();

			// Clean up test socket
			if (!isWindows) {
				try {
					await rm(`/tmp/mpv-test-${pid}.sock`);
				} catch {}
			}

			// If no mpvPath set yet, use this one
			if (!mpvPath) {
				mpvPath = testPath;
			}

			return true;
		} catch (error) {
			mpvLog(`MPV check failed for path: ${testPath}`, error);
			return false;
		}
	});

	// Set MPV binary path
	ipcMain.handle("mpv:setPath", async (_, customPath) => {
		mpvPath = customPath || null;
		return true;
	});

	// Get current MPV path
	ipcMain.handle("mpv:getPath", async () => {
		return mpvPath || findMpvBinary() || "mpv";
	});

	// Select MPV path via file dialog
	ipcMain.handle("mpv:selectPath", async () => {
		const result = await dialog.showOpenDialog(mainWindow, {
			title: "Select MPV Executable",
			properties: ["openFile"],
			filters:
				isWindows
					? [
							{ name: "Executable", extensions: ["exe"] },
							{ name: "All Files", extensions: ["*"] },
						]
					: [],
		});

		if (!result.canceled && result.filePaths.length > 0) {
			return result.filePaths[0];
		}
		return null;
	});

	// Initialize MPV
	ipcMain.handle("mpv:initialize", async (_, data = {}) => {
		try {
			mpvLog(`Initializing with: ${JSON.stringify(data)}`);
			mpvInstance = await createMpv(data);
			setAudioPlayerFallback(false);
			return true;
		} catch (err) {
			mpvLog("Failed to initialize, falling back to web player", err);
			setAudioPlayerFallback(true);
			return false;
		}
	});

	// Restart MPV with new settings
	ipcMain.handle("mpv:restart", async (_, data = {}) => {
		try {
			mpvLog(`Restarting with: ${JSON.stringify(data)}`);

			// Clean up previous instance
			if (getMpvInstance()) {
				await getMpvInstance().stop();
				await quit();
			}
			mpvInstance = null;

			mpvInstance = await createMpv(data);
			mpvLog("Restarted successfully");
			setAudioPlayerFallback(false);
			return true;
		} catch (err) {
			mpvLog("Failed to restart, falling back to web player", err);
			setAudioPlayerFallback(true);
			return false;
		}
	});

	// Check if MPV is running
	ipcMain.handle("mpv:isRunning", async () => {
		return getMpvInstance()?.isRunning() || false;
	});

	// Play a URL (replace current playlist)
	ipcMain.handle("mpv:play", async (_, url) => {
		const mpv = getMpvInstance();
		if (!mpv) {
			throw new Error("MPV not initialized");
		}

		// Reset position tracking when playing a new track
		lastPlaylistPos = 0;
		autoNextLock = false;
		if (autoNextTimeout) {
			clearTimeout(autoNextTimeout);
			autoNextTimeout = null;
		}

		try {
			await mpv.load(url, "replace");
			await mpv.play();
			return true;
		} catch (err) {
			mpvLog("Failed to play", err);
			throw err;
		}
	});

	// Set queue: current track + next track (for gapless playback)
	ipcMain.handle("mpv:setQueue", async (_, current, next, shouldPause) => {
		const mpv = getMpvInstance();
		if (!mpv) return;

		// Reset position tracking when setting a new queue
		lastPlaylistPos = 0;
		autoNextLock = false;
		if (autoNextTimeout) {
			clearTimeout(autoNextTimeout);
			autoNextTimeout = null;
		}

		if (!current && !next) {
			try {
				await mpv.clearPlaylist();
				await mpv.pause();
			} catch (err) {
				mpvLog("Failed to clear queue", err);
			}
			return;
		}

		try {
			if (current) {
				await mpv.load(current, "replace");

				if (next) {
					await mpv.load(next, "append");
				}
			}

			if (shouldPause) {
				await mpv.pause();
			} else if (shouldPause === false) {
				await mpv.play();
			}
		} catch (err) {
			mpvLog("Failed to set queue", err);
		}
	});

	// Set the next track in queue (for preloading)
	ipcMain.handle("mpv:setQueueNext", async (_, url) => {
		const mpv = getMpvInstance();
		if (!mpv) return;

		try {
			const size = await mpv.getPlaylistSize();

			// Remove existing "next" track if present
			if (size && size > 1) {
				await mpv.playlistRemove(1);
			}

			if (url) {
				await mpv.load(url, "append");
			}
		} catch (err) {
			mpvLog("Failed to set queue next", err);
		}
	});

	// Handle auto-next (called from renderer after receiving mpv:autoNext)
	ipcMain.on("mpv:autoNext", async (_, url) => {
		const mpv = getMpvInstance();
		if (!mpv) return;

		try {
			// Get current playlist size
			const size = await mpv.getPlaylistSize().catch(() => 0);
			
			// Remove the track that just finished (position 0) if playlist has items
			if (size > 1) {
				await mpv.playlistRemove(0).catch(() => {});
			}
			
			// Reset position tracking - we're now at position 0 of the new playlist
			lastPlaylistPos = 0;

			// Append next track if provided
			if (url) {
				await mpv.load(url, "append");
			}
		} catch (err) {
			mpvLog("Failed to handle auto-next", err);
		}
	});

	// Pause
	ipcMain.handle("mpv:pause", async () => {
		try {
			const mpv = getMpvInstance();
			if (!mpv) return;
			await mpv.pause();
		} catch (err) {
			mpvLog("Failed to pause", err);
		}
	});

	// Resume
	ipcMain.handle("mpv:resume", async () => {
		try {
			const mpv = getMpvInstance();
			if (!mpv) return;
			await mpv.play();
		} catch (err) {
			mpvLog("Failed to resume", err);
		}
	});

	// Stop
	ipcMain.handle("mpv:stop", async () => {
		try {
			await getMpvInstance()?.stop();
		} catch (err) {
			mpvLog("Failed to stop", err);
		}
	});

	// Seek to absolute position
	ipcMain.handle("mpv:seek", async (_, time) => {
		try {
			const mpv = getMpvInstance();
			if (!mpv) return;
			await mpv.goToPosition(time);
		} catch (err) {
			mpvLog(`Failed to seek to ${time}`, err);
		}
	});

	// Set volume (0-100) - use 'on' for fire-and-forget (like Feishin)
	ipcMain.on("mpv:volume", async (_, value) => {
		try {
			if (value === undefined || value === null || value < 0 || value > 100) {
				return;
			}
			currentVolume = Math.round(value);
			const mpv = getMpvInstance();
			if (!mpv) return;
			await mpv.volume(currentVolume);
		} catch (err) {
			mpvLog(`Failed to set volume to ${value}`, err);
		}
	});

	// Mute/unmute - use 'on' for fire-and-forget
	ipcMain.on("mpv:mute", async (_, mute) => {
		try {
			await getMpvInstance()?.mute(mute);
		} catch (err) {
			mpvLog("Failed to set mute", err);
		}
	});

	// Get current time position
	ipcMain.handle("mpv:getPosition", async () => {
		try {
			return (await getMpvInstance()?.getTimePosition()) || 0;
		} catch {
			return 0;
		}
	});

	// Get duration
	ipcMain.handle("mpv:getDuration", async () => {
		try {
			return (await getMpvInstance()?.getDuration()) || 0;
		} catch {
			return 0;
		}
	});

	// Cleanup
	ipcMain.handle("mpv:cleanup", async () => {
		try {
			await getMpvInstance()?.stop();
			await getMpvInstance()?.clearPlaylist();
		} catch (err) {
			mpvLog("Failed to cleanup", err);
		}
	});

	// Quit MPV
	ipcMain.on("mpv:quit", async () => {
		try {
			await getMpvInstance()?.stop();
			await quit();
		} catch (err) {
			mpvLog("Failed to quit", err);
		} finally {
			mpvInstance = null;
		}
	});
}

// ============================================================================
// Window Creation
// ============================================================================

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1400,
		height: 900,
		minWidth: 800,
		minHeight: 600,
		webPreferences: {
			preload: path.join(__dirname, "preload.cjs"),
			contextIsolation: true,
			nodeIntegration: false,
		},
		titleBarStyle: "hiddenInset",
		trafficLightPosition: { x: 16, y: 16 },
		backgroundColor: "#0a0a0a",
		show: false,
	});

	// Show window when ready to prevent visual flash
	mainWindow.once("ready-to-show", () => {
		mainWindow.show();
	});

	// Open external links in default browser
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: "deny" };
	});

	if (isDev) {
		// Development: load from Vite dev server
		mainWindow.loadURL("http://localhost:3000");
		// Open DevTools in development
		mainWindow.webContents.openDevTools();
	} else {
		// Production: load from built files
		mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
	}

	mainWindow.on("closed", () => {
		// Stop MPV when window is closed
		cleanupMpv(true);
		mainWindow = null;
	});
}

// ============================================================================
// App Lifecycle
// ============================================================================

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
	cleanupMpv(true);
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	// On macOS, re-create window when dock icon is clicked
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

// Clean up MPV on app quit with state machine
app.on("before-quit", async (event) => {
	switch (mpvState) {
		case MpvState.DONE:
			return;
		case MpvState.IN_PROGRESS:
			event.preventDefault();
			break;
		case MpvState.STARTED: {
			try {
				mpvState = MpvState.IN_PROGRESS;
				event.preventDefault();
				await cleanupMpv();
				await destroyMpris();
			} catch (err) {
				mpvLog("Failed to cleanup before quit", err);
			} finally {
				mpvState = MpvState.DONE;
				app.quit();
			}
			break;
		}
	}
});

// Handle process exit to ensure MPV is killed
process.on("exit", () => {
	const instance = getMpvInstance();
	if (instance) {
		const mpvProcess = instance.process || instance.mpvProcess;
		if (mpvProcess && typeof mpvProcess.kill === "function") {
			try {
				mpvProcess.kill("SIGKILL");
			} catch {
				// Ignore errors during exit
			}
		}
	}
});

// Handle signals
process.on("SIGINT", async () => {
	await cleanupMpv(true);
	process.exit(0);
});

process.on("SIGTERM", async () => {
	await cleanupMpv(true);
	process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", async (error) => {
	console.error("Uncaught exception:", error);
	await cleanupMpv(true).catch(() => {});
});

process.on("unhandledRejection", async (reason) => {
	console.error("Unhandled rejection:", reason);
	await cleanupMpv(true).catch(() => {});
});

// Start the app
app.whenReady().then(async () => {
	setupMpvIpcHandlers();
	createWindow();
	
	// Initialize MPRIS for Linux desktop integration
	// The mpris.js module handles all event handlers and IPC internally
	if (process.platform === "linux") {
		initializeMpris(() => mainWindow);
	}
});
