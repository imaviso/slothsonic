import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Clock,
	GripVertical,
	Loader2,
	Music,
	Play,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { PlaylistWithSongs, Song } from "@/lib/api";
import { getCoverArtUrl, updatePlaylist } from "@/lib/api";
import { playSong, usePlayer } from "@/lib/player";
import { cn } from "@/lib/utils";
import { AddToPlaylistButton } from "./AddToPlaylistButton";
import { SongContextMenu } from "./SongContextMenu";
import { StarButton } from "./StarButton";

function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface PlaylistSongRowProps {
	song: Song;
	index: number;
	songs: Song[];
	onRemove: (index: number) => void;
	isRemoving: boolean;
	onDragStart: (index: number) => void;
	onDragOver: (index: number) => void;
	onDragEnd: () => void;
	isDragging: boolean;
	dragOverIndex: number | null;
}

function PlaylistSongRow({
	song,
	index,
	songs,
	onRemove,
	isRemoving,
	onDragStart,
	onDragOver,
	onDragEnd,
	isDragging,
	dragOverIndex,
}: PlaylistSongRowProps) {
	const { currentTrack, isPlaying, togglePlayPause } = usePlayer();
	const [coverUrl, setCoverUrl] = useState<string | null>(null);

	const isCurrentTrack = song.id === currentTrack?.id;
	const isThisTrackPlaying = isCurrentTrack && isPlaying;

	useEffect(() => {
		if (song.coverArt) {
			getCoverArtUrl(song.coverArt, 50).then(setCoverUrl);
		}
	}, [song.coverArt]);

	const handlePlay = () => {
		if (isCurrentTrack) {
			togglePlayPause();
		} else {
			playSong(song, songs, index);
		}
	};

	return (
		<SongContextMenu song={song} songs={songs} index={index}>
			{/* biome-ignore lint/a11y/useSemanticElements: Using div for drag-and-drop grid layout */}
			<div
				role="listitem"
				draggable
				onDragStart={(e) => {
					e.dataTransfer.effectAllowed = "move";
					onDragStart(index);
				}}
				onDragOver={(e) => {
					e.preventDefault();
					onDragOver(index);
				}}
				onDragEnd={onDragEnd}
				className={cn(
					"w-full grid gap-4 px-4 py-2 hover:bg-muted/50 transition-colors group",
					"grid-cols-[auto_auto_1fr_1fr_auto_auto_auto_auto]",
					isCurrentTrack && "bg-muted/30",
					isDragging && "opacity-50",
					dragOverIndex === index && "border-t-2 border-primary",
				)}
			>
				{/* Drag handle */}
				<div className="flex items-center cursor-grab active:cursor-grabbing">
					<GripVertical className="w-4 h-4 text-muted-foreground" />
				</div>

				{/* Play indicator / track number */}
				<button
					type="button"
					onClick={handlePlay}
					className="w-8 flex items-center justify-center"
				>
					{isThisTrackPlaying ? (
						<span className="w-3 h-3 flex gap-0.5 items-end">
							<span className="w-0.5 h-2 bg-primary animate-pulse" />
							<span
								className="w-0.5 h-3 bg-primary animate-pulse"
								style={{ animationDelay: "0.2s" }}
							/>
							<span
								className="w-0.5 h-1.5 bg-primary animate-pulse"
								style={{ animationDelay: "0.4s" }}
							/>
						</span>
					) : (
						<>
							<span
								className={cn(
									"text-sm group-hover:hidden",
									isCurrentTrack ? "text-primary" : "text-muted-foreground",
								)}
							>
								{index + 1}
							</span>
							<Play
								className={cn(
									"w-4 h-4 hidden group-hover:block",
									isCurrentTrack ? "text-primary" : "text-foreground",
								)}
							/>
						</>
					)}
				</button>

				{/* Song info */}
				<button
					type="button"
					onClick={handlePlay}
					className="flex items-center gap-3 min-w-0 text-left"
				>
					{coverUrl ? (
						<img
							src={coverUrl}
							alt={song.title}
							className="w-10 h-10 rounded object-cover flex-shrink-0"
						/>
					) : (
						<div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
							<Music className="w-4 h-4 text-muted-foreground" />
						</div>
					)}
					<div className="min-w-0">
						<p
							className={cn(
								"font-medium text-sm truncate",
								isCurrentTrack ? "text-primary" : "text-foreground",
							)}
						>
							{song.title}
						</p>
						{song.artist && (
							<p className="text-xs text-muted-foreground truncate">
								{song.artist}
							</p>
						)}
					</div>
				</button>

				{/* Album */}
				<div className="hidden sm:flex items-center min-w-0">
					<p className="text-sm text-muted-foreground truncate">{song.album}</p>
				</div>

				{/* Star button */}
				<div className="flex items-center">
					<StarButton
						id={song.id}
						type="song"
						isStarred={!!song.starred}
						size="sm"
					/>
				</div>

				{/* Add to playlist */}
				<div className="flex items-center">
					<AddToPlaylistButton songId={song.id} song={song} size="sm" />
				</div>

				{/* Remove from playlist */}
				<div className="flex items-center">
					<button
						type="button"
						onClick={() => onRemove(index)}
						disabled={isRemoving}
						className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
						title="Remove from playlist"
					>
						{isRemoving ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<Trash2 className="w-4 h-4" />
						)}
					</button>
				</div>

				{/* Duration */}
				<div className="flex items-center">
					<span className="text-sm text-muted-foreground">
						{song.duration ? formatDuration(song.duration) : "—"}
					</span>
				</div>
			</div>
		</SongContextMenu>
	);
}

interface PlaylistSongListProps {
	playlistId: string;
	songs: Song[];
}

export function PlaylistSongList({ playlistId, songs }: PlaylistSongListProps) {
	const queryClient = useQueryClient();
	const [removingIndex, setRemovingIndex] = useState<number | null>(null);
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

	const removeMutation = useMutation({
		mutationFn: (songIndex: number) =>
			updatePlaylist({ playlistId, songIndexToRemove: [songIndex] }),
		onMutate: async (songIndex) => {
			await queryClient.cancelQueries({ queryKey: ["playlist", playlistId] });

			const previousPlaylist = queryClient.getQueryData<PlaylistWithSongs>([
				"playlist",
				playlistId,
			]);

			// Optimistically remove the song
			if (previousPlaylist?.entry) {
				const removedSong = previousPlaylist.entry[songIndex];
				queryClient.setQueryData<PlaylistWithSongs>(["playlist", playlistId], {
					...previousPlaylist,
					songCount: previousPlaylist.songCount - 1,
					duration: previousPlaylist.duration - (removedSong?.duration ?? 0),
					entry: previousPlaylist.entry.filter((_, i) => i !== songIndex),
				});
			}

			return { previousPlaylist, songIndex };
		},
		onError: (_err, _songIndex, context) => {
			if (context?.previousPlaylist) {
				queryClient.setQueryData(
					["playlist", playlistId],
					context.previousPlaylist,
				);
			}
			toast.error("Failed to remove song from playlist");
		},
		onSuccess: (_data, _songIndex, context) => {
			const removedSong = context?.previousPlaylist?.entry?.[context.songIndex];
			queryClient.invalidateQueries({ queryKey: ["playlist", playlistId] });
			queryClient.invalidateQueries({ queryKey: ["playlists"] });
			toast.success("Removed from playlist", {
				action: removedSong
					? {
							label: "Undo",
							onClick: async () => {
								try {
									await updatePlaylist({
										playlistId,
										songIdToAdd: [removedSong.id],
									});
									queryClient.invalidateQueries({
										queryKey: ["playlist", playlistId],
									});
									queryClient.invalidateQueries({ queryKey: ["playlists"] });
									toast.success("Song restored to playlist");
								} catch {
									toast.error("Failed to restore song");
								}
							},
						}
					: undefined,
			});
		},
		onSettled: () => {
			setRemovingIndex(null);
		},
	});

	const reorderMutation = useMutation({
		mutationFn: async ({
			fromIndex,
			toIndex,
		}: {
			fromIndex: number;
			toIndex: number;
		}) => {
			// The Subsonic API doesn't have a direct reorder endpoint.
			// We need to remove the song from old position and add it at new position.
			// This is done by removing and re-adding with the correct order.

			// Get current song IDs in new order
			const newOrder = [...songs];
			const [movedSong] = newOrder.splice(fromIndex, 1);
			newOrder.splice(toIndex, 0, movedSong);

			// Unfortunately, Subsonic API doesn't support reordering directly.
			// The workaround is to recreate the playlist with the new order,
			// but that requires deleting all songs and re-adding them.
			// For now, we'll remove the song and add it back at the right position.

			// Remove from old position
			await updatePlaylist({
				playlistId,
				songIndexToRemove: [fromIndex],
			});

			// Get remaining songs after removal
			const remainingSongs = songs.filter((_, i) => i !== fromIndex);

			// Calculate insertion index (the API adds at the end, so we need to add all songs after the target)
			// Actually, the API only supports adding to the end and removing by index
			// So we need to remove all songs after target and re-add them in order

			if (toIndex < remainingSongs.length) {
				// We need to remove songs from toIndex onwards, then add them back with the moved song
				const songsToReAdd = remainingSongs.slice(toIndex);
				const indicesToRemove = Array.from(
					{ length: songsToReAdd.length },
					(_, i) => toIndex + i,
				);

				if (indicesToRemove.length > 0) {
					await updatePlaylist({
						playlistId,
						songIndexToRemove: indicesToRemove,
					});
				}

				// Now add them back in order: moved song first, then the rest
				const songIdsToAdd = [movedSong.id, ...songsToReAdd.map((s) => s.id)];
				await updatePlaylist({
					playlistId,
					songIdToAdd: songIdsToAdd,
				});
			} else {
				// Moving to end, just add the song
				await updatePlaylist({
					playlistId,
					songIdToAdd: [movedSong.id],
				});
			}
		},
		onMutate: async ({ fromIndex, toIndex }) => {
			await queryClient.cancelQueries({ queryKey: ["playlist", playlistId] });

			const previousPlaylist = queryClient.getQueryData<PlaylistWithSongs>([
				"playlist",
				playlistId,
			]);

			// Optimistically reorder
			if (previousPlaylist?.entry) {
				const newEntry = [...previousPlaylist.entry];
				const [movedSong] = newEntry.splice(fromIndex, 1);
				newEntry.splice(toIndex, 0, movedSong);

				queryClient.setQueryData<PlaylistWithSongs>(["playlist", playlistId], {
					...previousPlaylist,
					entry: newEntry,
				});
			}

			return { previousPlaylist };
		},
		onError: (_err, _vars, context) => {
			if (context?.previousPlaylist) {
				queryClient.setQueryData(
					["playlist", playlistId],
					context.previousPlaylist,
				);
			}
			toast.error("Failed to reorder playlist");
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["playlist", playlistId] });
		},
	});

	const handleRemove = (index: number) => {
		setRemovingIndex(index);
		removeMutation.mutate(index);
	};

	const handleDragStart = (index: number) => {
		setDragIndex(index);
	};

	const handleDragOver = (index: number) => {
		if (dragIndex !== null && dragIndex !== index) {
			setDragOverIndex(index);
		}
	};

	const handleDragEnd = () => {
		if (
			dragIndex !== null &&
			dragOverIndex !== null &&
			dragIndex !== dragOverIndex
		) {
			reorderMutation.mutate({ fromIndex: dragIndex, toIndex: dragOverIndex });
		}
		setDragIndex(null);
		setDragOverIndex(null);
	};

	if (songs.length === 0) {
		return (
			<div className="text-center py-12">
				<Music className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
				<p className="text-muted-foreground">No songs in this playlist</p>
			</div>
		);
	}

	return (
		<div className="bg-card rounded-lg border">
			<div className="grid gap-4 px-4 py-2 border-b text-sm text-muted-foreground grid-cols-[auto_auto_1fr_1fr_auto_auto_auto_auto]">
				<span className="w-4" /> {/* Drag handle space */}
				<span className="w-8 text-center">#</span>
				<span>Title</span>
				<span className="hidden sm:block">Album</span>
				{/* Empty headers for action columns */}
				<span />
				<span />
				<span />
				<span className="flex items-center gap-1">
					<Clock className="w-4 h-4" />
				</span>
			</div>
			<div className="divide-y">
				{songs.map((song, index) => (
					<PlaylistSongRow
						key={`${song.id}-${index}`}
						song={song}
						index={index}
						songs={songs}
						onRemove={handleRemove}
						isRemoving={removingIndex === index}
						onDragStart={handleDragStart}
						onDragOver={handleDragOver}
						onDragEnd={handleDragEnd}
						isDragging={dragIndex === index}
						dragOverIndex={dragOverIndex}
					/>
				))}
			</div>
		</div>
	);
}
