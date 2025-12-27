import { useSyncExternalStore } from "react";

export interface SubsonicCredentials {
	serverUrl: string;
	username: string;
	password: string;
}

interface AuthState {
	credentials: SubsonicCredentials | null;
	isAuthenticated: boolean;
}

const AUTH_STORAGE_KEY = "slothsonic-auth";

function getStoredCredentials(): SubsonicCredentials | null {
	try {
		const stored = localStorage.getItem(AUTH_STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch {
		// Invalid stored data
	}
	return null;
}

let authState: AuthState = {
	credentials: getStoredCredentials(),
	isAuthenticated: getStoredCredentials() !== null,
};

const listeners = new Set<() => void>();

function emitChange() {
	for (const listener of listeners) {
		listener();
	}
}

export function login(credentials: SubsonicCredentials) {
	// Normalize server URL (remove trailing slash)
	const normalizedCredentials = {
		...credentials,
		serverUrl: credentials.serverUrl.replace(/\/+$/, ""),
	};

	localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalizedCredentials));
	authState = {
		credentials: normalizedCredentials,
		isAuthenticated: true,
	};
	emitChange();
}

export function logout() {
	localStorage.removeItem(AUTH_STORAGE_KEY);
	authState = {
		credentials: null,
		isAuthenticated: false,
	};
	emitChange();
}

export function getCredentials(): SubsonicCredentials | null {
	return authState.credentials;
}

export function isAuthenticated(): boolean {
	return authState.isAuthenticated;
}

function subscribe(callback: () => void) {
	listeners.add(callback);
	return () => listeners.delete(callback);
}

function getSnapshot(): AuthState {
	return authState;
}

export function useAuth() {
	const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
	return {
		credentials: state.credentials,
		isAuthenticated: state.isAuthenticated,
		login,
		logout,
	};
}
