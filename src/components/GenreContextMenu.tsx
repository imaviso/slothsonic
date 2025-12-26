import { ListEnd, Play, Shuffle } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { getSongsByGenre } from "@/lib/api";
import { addToQueue, playAlbum } from "@/lib/player";

interface GenreContextMenuProps {
	genreName: string;
	children: ReactNode;
}

export function GenreContextMenu({
	genreName,
	children,
}: GenreContextMenuProps) {
	const handlePlayAll = async () => {
		try {
			const songs = await getSongsByGenre(genreName, 100, 0);
			if (songs.length > 0) {
				playAlbum(songs, 0);
			} else {
				toast.error("No songs in this genre");
			}
		} catch {
			toast.error("Failed to play genre");
		}
	};

	const handleShuffle = async () => {
		try {
			const songs = await getSongsByGenre(genreName, 100, 0);
			if (songs.length > 0) {
				const shuffled = [...songs].sort(() => Math.random() - 0.5);
				playAlbum(shuffled, 0);
			} else {
				toast.error("No songs in this genre");
			}
		} catch {
			toast.error("Failed to shuffle genre");
		}
	};

	const handleAddToQueue = async () => {
		try {
			const songs = await getSongsByGenre(genreName, 100, 0);
			if (songs.length > 0) {
				addToQueue(songs);
				toast.success(`Added ${songs.length} songs to queue`);
			} else {
				toast.error("No songs in this genre");
			}
		} catch {
			toast.error("Failed to add to queue");
		}
	};

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent className="w-56">
				<ContextMenuItem onClick={handlePlayAll}>
					<Play className="mr-2 h-4 w-4" />
					Play all
				</ContextMenuItem>
				<ContextMenuItem onClick={handleShuffle}>
					<Shuffle className="mr-2 h-4 w-4" />
					Shuffle
				</ContextMenuItem>
				<ContextMenuItem onClick={handleAddToQueue}>
					<ListEnd className="mr-2 h-4 w-4" />
					Add to queue
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
