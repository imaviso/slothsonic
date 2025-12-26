import { useNavigate } from "@tanstack/react-router";
import { Disc3, Trash2, User } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Song } from "@/lib/api";
import { insertIntoQueue } from "@/lib/player";

interface QueueContextMenuProps {
	song: Song;
	index: number;
	isCurrentTrack: boolean;
	onRemove: () => void;
	children: ReactNode;
}

export function QueueContextMenu({
	song,
	index,
	isCurrentTrack,
	onRemove,
	children,
}: QueueContextMenuProps) {
	const navigate = useNavigate();

	const handleRemove = () => {
		if (isCurrentTrack) {
			toast.error("Cannot remove the currently playing song");
			return;
		}
		const removedIndex = index;
		const removedSong = song;
		onRemove();
		toast.success("Removed from queue", {
			action: {
				label: "Undo",
				onClick: () => {
					insertIntoQueue(removedSong, removedIndex);
					toast.success("Song restored to queue");
				},
			},
		});
	};

	const handleGoToAlbum = () => {
		if (song.albumId) {
			navigate({
				to: "/app/albums/$albumId",
				params: { albumId: song.albumId },
			});
		}
	};

	const handleGoToArtist = () => {
		if (song.artistId) {
			navigate({
				to: "/app/artists/$artistId",
				params: { artistId: song.artistId },
			});
		}
	};

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent className="w-48">
				<div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
					Queue Position: {index + 1}
				</div>

				<ContextMenuSeparator />

				{!isCurrentTrack && (
					<>
						<ContextMenuItem
							onClick={handleRemove}
							className="text-destructive"
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Remove from queue
						</ContextMenuItem>

						<ContextMenuSeparator />
					</>
				)}

				{song.albumId && (
					<ContextMenuItem onClick={handleGoToAlbum}>
						<Disc3 className="mr-2 h-4 w-4" />
						Go to album
					</ContextMenuItem>
				)}
				{song.artistId && (
					<ContextMenuItem onClick={handleGoToArtist}>
						<User className="mr-2 h-4 w-4" />
						Go to artist
					</ContextMenuItem>
				)}
			</ContextMenuContent>
		</ContextMenu>
	);
}
