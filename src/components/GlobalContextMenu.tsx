import { useNavigate } from "@tanstack/react-router";
import {
	Disc3,
	Home,
	ListMusic,
	Pause,
	Play,
	Search,
	Tags,
	Users,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect } from "react";

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { togglePlayPause, usePlayer } from "@/lib/player";

interface GlobalContextMenuProps {
	children: ReactNode;
}

export function GlobalContextMenu({ children }: GlobalContextMenuProps) {
	const navigate = useNavigate();
	const { isPlaying } = usePlayer();
	const isMobile = useIsMobile();

	// Prevent native context menu on the entire document
	// except for inputs, textareas, and elements with existing context menus
	useEffect(() => {
		// Don't prevent native context menu on mobile
		if (isMobile) return;

		const handleContextMenu = (e: MouseEvent) => {
			const target = e.target as HTMLElement;

			// Allow native context menu on form inputs
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable
			) {
				return;
			}

			// Check if we're inside a custom context menu trigger
			const contextMenuTrigger = target.closest(
				'[data-slot="context-menu-trigger"]',
			);
			if (contextMenuTrigger) {
				// Let the specific context menu handle it
				return;
			}

			// Prevent native menu for everything else
			e.preventDefault();
		};

		document.addEventListener("contextmenu", handleContextMenu);
		return () => document.removeEventListener("contextmenu", handleContextMenu);
	}, [isMobile]);

	const handleOpenSearch = useCallback(() => {
		// Trigger the global search (Cmd+K)
		const event = new KeyboardEvent("keydown", {
			key: "k",
			metaKey: true,
			bubbles: true,
		});
		document.dispatchEvent(event);
	}, []);

	const handleTogglePlayPause = useCallback(() => {
		togglePlayPause();
	}, []);

	const handleNavigate = useCallback(
		(to: string) => {
			navigate({ to });
		},
		[navigate],
	);

	// On mobile, just render children without context menu wrapper
	if (isMobile) {
		return <div className="flex min-h-svh w-full flex-col">{children}</div>;
	}

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div className="flex min-h-svh w-full flex-col">{children}</div>
			</ContextMenuTrigger>
			<ContextMenuContent className="w-64">
				<ContextMenuItem onClick={handleOpenSearch}>
					<Search className="mr-2 h-4 w-4" />
					Search
					<ContextMenuShortcut>⌘K</ContextMenuShortcut>
				</ContextMenuItem>

				<ContextMenuItem onClick={handleTogglePlayPause}>
					{isPlaying ? (
						<Pause className="mr-2 h-4 w-4" />
					) : (
						<Play className="mr-2 h-4 w-4" />
					)}
					{isPlaying ? "Pause" : "Play"}
					<ContextMenuShortcut>Space</ContextMenuShortcut>
				</ContextMenuItem>

				<ContextMenuSeparator />

				<ContextMenuItem onClick={() => handleNavigate("/app")}>
					<Home className="mr-2 h-4 w-4" />
					Home
				</ContextMenuItem>

				<ContextMenuItem onClick={() => handleNavigate("/app/albums")}>
					<Disc3 className="mr-2 h-4 w-4" />
					Albums
				</ContextMenuItem>

				<ContextMenuItem onClick={() => handleNavigate("/app/artists")}>
					<Users className="mr-2 h-4 w-4" />
					Artists
				</ContextMenuItem>

				<ContextMenuItem onClick={() => handleNavigate("/app/songs")}>
					<ListMusic className="mr-2 h-4 w-4" />
					Songs
				</ContextMenuItem>

				<ContextMenuItem onClick={() => handleNavigate("/app/genres")}>
					<Tags className="mr-2 h-4 w-4" />
					Genres
				</ContextMenuItem>

				<ContextMenuItem onClick={() => handleNavigate("/app/playlists")}>
					<ListMusic className="mr-2 h-4 w-4" />
					Playlists
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
