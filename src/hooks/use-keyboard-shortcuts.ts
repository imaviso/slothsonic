import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { star, unstar } from "@/lib/api";
import {
	playNext,
	playPrevious,
	seek,
	setVolume,
	togglePlayPause,
	toggleRepeat,
	toggleShuffle,
	updateCurrentTrackStarred,
	usePlayer,
} from "@/lib/player";

/**
 * Global keyboard shortcuts hook for player controls.
 * Should be used in a component that's always mounted (e.g., AppLayout).
 *
 * Shortcuts:
 * - Space: Play/Pause
 * - ArrowLeft: Seek backward 10s
 * - ArrowRight: Seek forward 10s
 * - ArrowUp: Volume up 10%
 * - ArrowDown: Volume down 10%
 * - N: Next track
 * - P: Previous track
 * - M: Mute/unmute
 * - L: Toggle favorite (star/unstar)
 * - R: Toggle repeat mode
 * - S: Toggle shuffle
 */
export function useGlobalKeyboardShortcuts() {
	const { currentTrack, currentTime, duration, volume } = usePlayer();
	const queryClient = useQueryClient();

	// Use refs for values that change frequently to avoid recreating the callback
	const currentTimeRef = useRef(currentTime);
	const durationRef = useRef(duration);
	const volumeRef = useRef(volume);
	const currentTrackRef = useRef(currentTrack);
	const prevVolumeRef = useRef(1);

	// Keep refs in sync
	useEffect(() => {
		currentTimeRef.current = currentTime;
	}, [currentTime]);

	useEffect(() => {
		durationRef.current = duration;
	}, [duration]);

	useEffect(() => {
		volumeRef.current = volume;
	}, [volume]);

	useEffect(() => {
		currentTrackRef.current = currentTrack;
	}, [currentTrack]);

	// Stable star mutation handler
	const handleStar = useCallback(
		async (songId: string, shouldStar: boolean) => {
			updateCurrentTrackStarred(shouldStar);
			try {
				if (shouldStar) {
					await star({ id: songId });
				} else {
					await unstar({ id: songId });
				}
				toast.success(
					shouldStar ? "Added to favorites" : "Removed from favorites",
				);
				queryClient.invalidateQueries({ queryKey: ["starred"] });
			} catch {
				updateCurrentTrackStarred(!shouldStar);
				toast.error(
					shouldStar
						? "Failed to add to favorites"
						: "Failed to remove from favorites",
				);
			}
		},
		[queryClient],
	);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;

			// Ignore if typing in an input/textarea
			const isInputFocused =
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable;

			if (isInputFocused) {
				return;
			}

			// Handle space on buttons - prevent default button activation and use global handler
			if (e.code === "Space" && target.tagName === "BUTTON") {
				e.preventDefault();
				togglePlayPause();
				return;
			}

			switch (e.code) {
				case "Space":
					e.preventDefault();
					togglePlayPause();
					break;
				case "ArrowLeft":
					e.preventDefault();
					seek(Math.max(0, currentTimeRef.current - 10));
					break;
				case "ArrowRight":
					e.preventDefault();
					seek(Math.min(durationRef.current || 0, currentTimeRef.current + 10));
					break;
				case "ArrowUp":
					e.preventDefault();
					setVolume(Math.min(1, volumeRef.current + 0.1));
					break;
				case "ArrowDown":
					e.preventDefault();
					setVolume(Math.max(0, volumeRef.current - 0.1));
					break;
				case "KeyN":
					e.preventDefault();
					playNext();
					break;
				case "KeyP":
					e.preventDefault();
					playPrevious();
					break;
				case "KeyM":
					e.preventDefault();
					// Toggle mute
					if (volumeRef.current > 0) {
						prevVolumeRef.current = volumeRef.current;
						setVolume(0);
					} else {
						setVolume(prevVolumeRef.current);
					}
					break;
				case "KeyL":
					e.preventDefault();
					// Toggle favorite for current track
					if (currentTrackRef.current) {
						handleStar(
							currentTrackRef.current.id,
							!currentTrackRef.current.starred,
						);
					}
					break;
				case "KeyR":
					e.preventDefault();
					toggleRepeat();
					break;
				case "KeyS":
					e.preventDefault();
					toggleShuffle();
					break;
				default:
					break;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleStar]);
}
