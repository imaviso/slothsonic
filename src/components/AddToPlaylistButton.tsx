import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ListPlus, Loader2, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	createPlaylist,
	getPlaylists,
	type Playlist,
	type PlaylistWithSongs,
	updatePlaylist,
} from "@/lib/api";
import { cn } from "@/lib/utils";

interface AddToPlaylistButtonProps {
	songId: string;
	/** Optional song data for optimistic updates */
	song?: {
		id: string;
		title: string;
		artist?: string;
		album?: string;
		albumId?: string;
		duration?: number;
		coverArt?: string;
	};
	size?: "sm" | "default";
}

export function AddToPlaylistButton({
	songId,
	song,
	size = "sm",
}: AddToPlaylistButtonProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [showNewPlaylist, setShowNewPlaylist] = useState(false);
	const [newPlaylistName, setNewPlaylistName] = useState("");
	const [addedToPlaylist, setAddedToPlaylist] = useState<string | null>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const queryClient = useQueryClient();

	const { data: playlists, isLoading } = useQuery({
		queryKey: ["playlists"],
		queryFn: getPlaylists,
		enabled: isOpen,
	});

	const addToPlaylistMutation = useMutation({
		mutationFn: (playlistId: string) =>
			updatePlaylist({ playlistId, songIdToAdd: [songId] }),
		onMutate: async (playlistId) => {
			// Cancel outgoing refetches
			await queryClient.cancelQueries({ queryKey: ["playlist", playlistId] });
			await queryClient.cancelQueries({ queryKey: ["playlists"] });

			// Snapshot previous values
			const previousPlaylist = queryClient.getQueryData<PlaylistWithSongs>([
				"playlist",
				playlistId,
			]);
			const previousPlaylists = queryClient.getQueryData<Playlist[]>([
				"playlists",
			]);

			// Optimistically update the playlist detail
			if (previousPlaylist && song) {
				queryClient.setQueryData<PlaylistWithSongs>(["playlist", playlistId], {
					...previousPlaylist,
					songCount: previousPlaylist.songCount + 1,
					duration: previousPlaylist.duration + (song.duration ?? 0),
					entry: [...(previousPlaylist.entry ?? []), song],
				});
			}

			// Optimistically update the playlists list
			if (previousPlaylists) {
				queryClient.setQueryData<Playlist[]>(
					["playlists"],
					previousPlaylists.map((p) =>
						p.id === playlistId
							? {
									...p,
									songCount: p.songCount + 1,
									duration: p.duration + (song?.duration ?? 0),
								}
							: p,
					),
				);
			}

			// Show success immediately
			setAddedToPlaylist(playlistId);

			return { previousPlaylist, previousPlaylists };
		},
		onError: (_err, playlistId, context) => {
			// Rollback on error
			if (context?.previousPlaylist) {
				queryClient.setQueryData(
					["playlist", playlistId],
					context.previousPlaylist,
				);
			}
			if (context?.previousPlaylists) {
				queryClient.setQueryData(["playlists"], context.previousPlaylists);
			}
			setAddedToPlaylist(null);
		},
		onSuccess: (_, playlistId) => {
			// Refetch to ensure sync with server
			queryClient.invalidateQueries({ queryKey: ["playlist", playlistId] });
			queryClient.invalidateQueries({ queryKey: ["playlists"] });
		},
		onSettled: () => {
			setTimeout(() => {
				setIsOpen(false);
				setAddedToPlaylist(null);
			}, 600);
		},
	});

	const createPlaylistMutation = useMutation({
		mutationFn: (name: string) => createPlaylist({ name, songId: [songId] }),
		onMutate: async (name) => {
			await queryClient.cancelQueries({ queryKey: ["playlists"] });

			const previousPlaylists = queryClient.getQueryData<Playlist[]>([
				"playlists",
			]);

			// Optimistically add the new playlist
			const optimisticPlaylist: Playlist = {
				id: `temp-${Date.now()}`,
				name,
				songCount: 1,
				duration: song?.duration ?? 0,
			};

			if (previousPlaylists) {
				queryClient.setQueryData<Playlist[]>(
					["playlists"],
					[...previousPlaylists, optimisticPlaylist],
				);
			}

			return { previousPlaylists };
		},
		onError: (_err, _name, context) => {
			if (context?.previousPlaylists) {
				queryClient.setQueryData(["playlists"], context.previousPlaylists);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["playlists"] });
			setNewPlaylistName("");
			setShowNewPlaylist(false);
			setIsOpen(false);
		},
	});

	// Close menu when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setIsOpen(false);
				setShowNewPlaylist(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isOpen]);

	const handleCreatePlaylist = (e: React.FormEvent) => {
		e.preventDefault();
		if (newPlaylistName.trim()) {
			createPlaylistMutation.mutate(newPlaylistName.trim());
		}
	};

	return (
		<div className="relative" ref={menuRef}>
			<Button
				variant="ghost"
				size="icon"
				className={cn(size === "sm" ? "w-8 h-8" : "w-10 h-10")}
				onClick={(e) => {
					e.stopPropagation();
					setIsOpen(!isOpen);
				}}
				title="Add to playlist"
			>
				<ListPlus className={cn(size === "sm" ? "w-4 h-4" : "w-5 h-5")} />
			</Button>

			{isOpen && (
				<div className="absolute right-0 top-full mt-1 z-50 w-56 bg-popover border rounded-md shadow-lg py-1">
					<div className="px-3 py-2 border-b">
						<p className="text-sm font-medium">Add to playlist</p>
					</div>

					{isLoading ? (
						<div className="px-3 py-4 flex justify-center">
							<Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
						</div>
					) : (
						<div className="max-h-48 overflow-y-auto">
							{playlists && playlists.length > 0 ? (
								playlists.map((playlist) => (
									<button
										key={playlist.id}
										type="button"
										onClick={() => addToPlaylistMutation.mutate(playlist.id)}
										disabled={
											addToPlaylistMutation.isPending ||
											addedToPlaylist === playlist.id
										}
										className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between"
									>
										<span className="truncate">{playlist.name}</span>
										{addedToPlaylist === playlist.id && (
											<Check className="w-4 h-4 text-green-500" />
										)}
									</button>
								))
							) : (
								<p className="px-3 py-2 text-sm text-muted-foreground">
									No playlists yet
								</p>
							)}
						</div>
					)}

					<div className="border-t">
						{showNewPlaylist ? (
							<form onSubmit={handleCreatePlaylist} className="p-2 space-y-2">
								<Input
									type="text"
									placeholder="Playlist name..."
									value={newPlaylistName}
									onChange={(e) => setNewPlaylistName(e.target.value)}
									className="h-8 text-sm"
									autoFocus
								/>
								<div className="flex gap-1">
									<Button
										type="submit"
										size="sm"
										className="flex-1 h-7"
										disabled={
											!newPlaylistName.trim() ||
											createPlaylistMutation.isPending
										}
									>
										{createPlaylistMutation.isPending ? (
											<Loader2 className="w-3 h-3 animate-spin" />
										) : (
											"Create"
										)}
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-7"
										onClick={() => {
											setShowNewPlaylist(false);
											setNewPlaylistName("");
										}}
									>
										Cancel
									</Button>
								</div>
							</form>
						) : (
							<button
								type="button"
								onClick={() => setShowNewPlaylist(true)}
								className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
							>
								<Plus className="w-4 h-4" />
								<span>New playlist</span>
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
