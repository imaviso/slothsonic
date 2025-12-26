import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ListEnd, Play, Shuffle, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Playlist } from "@/lib/api";
import { deletePlaylist, getPlaylist } from "@/lib/api";
import { addToQueue, playAlbum } from "@/lib/player";

interface PlaylistContextMenuProps {
	playlist: Playlist;
	children: ReactNode;
}

export function PlaylistContextMenu({
	playlist,
	children,
}: PlaylistContextMenuProps) {
	const queryClient = useQueryClient();

	const deleteMutation = useMutation({
		mutationFn: () => deletePlaylist(playlist.id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["playlists"] });
			toast.success("Playlist deleted");
		},
		onError: () => {
			toast.error("Failed to delete playlist");
		},
	});

	const handlePlay = async () => {
		try {
			const data = await getPlaylist(playlist.id);
			const songs = data.entry ?? [];
			if (songs.length > 0) {
				playAlbum(songs, 0);
			} else {
				toast.error("Playlist is empty");
			}
		} catch {
			toast.error("Failed to play playlist");
		}
	};

	const handleShuffle = async () => {
		try {
			const data = await getPlaylist(playlist.id);
			const songs = data.entry ?? [];
			if (songs.length > 0) {
				const shuffled = [...songs].sort(() => Math.random() - 0.5);
				playAlbum(shuffled, 0);
			} else {
				toast.error("Playlist is empty");
			}
		} catch {
			toast.error("Failed to shuffle playlist");
		}
	};

	const handleAddToQueue = async () => {
		try {
			const data = await getPlaylist(playlist.id);
			const songs = data.entry ?? [];
			if (songs.length > 0) {
				addToQueue(songs);
				toast.success(`Added ${songs.length} songs to queue`);
			} else {
				toast.error("Playlist is empty");
			}
		} catch {
			toast.error("Failed to add to queue");
		}
	};

	const handleDelete = () => {
		if (confirm("Are you sure you want to delete this playlist?")) {
			deleteMutation.mutate();
		}
	};

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent className="w-56">
				<ContextMenuItem onClick={handlePlay}>
					<Play className="mr-2 h-4 w-4" />
					Play
				</ContextMenuItem>
				<ContextMenuItem onClick={handleShuffle}>
					<Shuffle className="mr-2 h-4 w-4" />
					Shuffle
				</ContextMenuItem>
				<ContextMenuItem onClick={handleAddToQueue}>
					<ListEnd className="mr-2 h-4 w-4" />
					Add to queue
				</ContextMenuItem>

				<ContextMenuSeparator />

				<ContextMenuItem
					onClick={handleDelete}
					className="text-destructive focus:text-destructive"
				>
					<Trash2 className="mr-2 h-4 w-4" />
					Delete playlist
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
