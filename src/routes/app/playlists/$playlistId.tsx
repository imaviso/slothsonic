import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	Check,
	ListMusic,
	Loader2,
	Music,
	Pause,
	Pencil,
	Play,
	Plus,
	Search,
	Shuffle,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PlaylistSongList } from "@/components/PlaylistSongList";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	deletePlaylist,
	getCoverArtUrl,
	getPlaylist,
	type Song,
	search,
	updatePlaylist,
} from "@/lib/api";
import { playAlbum, playSong, usePlayer } from "@/lib/player";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/playlists/$playlistId")({
	component: PlaylistDetailPage,
});

function formatTotalDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	if (hours > 0) {
		return `${hours} hr ${mins} min`;
	}
	return `${mins} min`;
}

interface SearchResultItemProps {
	song: Song;
	isSelected: boolean;
	isAlreadyInPlaylist: boolean;
	onToggle: () => void;
}

function SearchResultItem({
	song,
	isSelected,
	isAlreadyInPlaylist,
	onToggle,
}: SearchResultItemProps) {
	const [coverUrl, setCoverUrl] = useState<string | null>(null);

	useEffect(() => {
		if (song.coverArt) {
			getCoverArtUrl(song.coverArt, 50).then(setCoverUrl);
		}
	}, [song.coverArt]);

	return (
		<button
			type="button"
			onClick={() => !isAlreadyInPlaylist && onToggle()}
			disabled={isAlreadyInPlaylist}
			className={cn(
				"w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors",
				isAlreadyInPlaylist
					? "opacity-50 cursor-not-allowed"
					: isSelected
						? "bg-primary/10 border border-primary"
						: "hover:bg-muted",
			)}
		>
			<div
				className={cn(
					"w-5 h-5 rounded border flex items-center justify-center flex-shrink-0",
					isSelected
						? "bg-primary border-primary text-primary-foreground"
						: "border-muted-foreground",
				)}
			>
				{isSelected && <Check className="w-3 h-3" />}
			</div>
			<div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
				{coverUrl ? (
					<img
						src={coverUrl}
						alt={song.album}
						className="w-full h-full object-cover"
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center">
						<Music className="w-4 h-4 text-muted-foreground" />
					</div>
				)}
			</div>
			<div className="flex-1 min-w-0">
				<p className="font-medium truncate">{song.title}</p>
				<p className="text-sm text-muted-foreground truncate">
					{song.artist} · {song.album}
				</p>
			</div>
			{isAlreadyInPlaylist && (
				<span className="text-xs text-muted-foreground">Already added</span>
			)}
		</button>
	);
}

function PlaylistDetailPage() {
	const { playlistId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [coverUrl, setCoverUrl] = useState<string | null>(null);
	const [coverLoaded, setCoverLoaded] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editName, setEditName] = useState("");
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [addSongsDialogOpen, setAddSongsDialogOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<Song[]>([]);
	const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(
		new Set(),
	);
	const [isSearching, setIsSearching] = useState(false);
	const { currentTrack, isPlaying, togglePlayPause, shuffle, toggleShuffle } =
		usePlayer();

	const {
		data: playlist,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["playlist", playlistId],
		queryFn: () => getPlaylist(playlistId),
		staleTime: 2 * 60 * 1000, // 2 minutes
		gcTime: 15 * 60 * 1000, // 15 minutes
	});

	const updateMutation = useMutation({
		mutationFn: (name: string) => updatePlaylist({ playlistId, name }),
		onSuccess: (_data, name) => {
			queryClient.invalidateQueries({ queryKey: ["playlist", playlistId] });
			queryClient.invalidateQueries({ queryKey: ["playlists"] });
			setIsEditing(false);
			toast.success(`Renamed to "${name}"`);
		},
		onError: () => {
			toast.error("Failed to rename playlist");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: () => deletePlaylist(playlistId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["playlists"] });
			toast.success("Playlist deleted");
		},
		onError: () => {
			toast.error("Failed to delete playlist");
		},
	});

	const addSongsMutation = useMutation({
		mutationFn: (songIds: string[]) =>
			updatePlaylist({ playlistId, songIdToAdd: songIds }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["playlist", playlistId] });
			queryClient.invalidateQueries({ queryKey: ["playlists"] });
			setAddSongsDialogOpen(false);
			setSearchQuery("");
			setSearchResults([]);
			setSelectedSongIds(new Set());
			toast.success("Songs added to playlist");
		},
		onError: () => {
			toast.error("Failed to add songs");
		},
	});

	// Debounced auto-search
	useEffect(() => {
		if (!searchQuery.trim()) {
			setSearchResults([]);
			return;
		}

		setIsSearching(true);
		const timeoutId = setTimeout(async () => {
			try {
				const results = await search(searchQuery);
				setSearchResults(results.songs);
			} catch {
				toast.error("Search failed");
			} finally {
				setIsSearching(false);
			}
		}, 300);

		return () => clearTimeout(timeoutId);
	}, [searchQuery]);

	const toggleSongSelection = (songId: string) => {
		setSelectedSongIds((prev) => {
			const next = new Set(prev);
			if (next.has(songId)) {
				next.delete(songId);
			} else {
				next.add(songId);
			}
			return next;
		});
	};

	const handleAddSelectedSongs = () => {
		if (selectedSongIds.size === 0) return;
		addSongsMutation.mutate(Array.from(selectedSongIds));
	};

	useEffect(() => {
		if (playlist?.coverArt) {
			getCoverArtUrl(playlist.coverArt, 500).then(setCoverUrl);
		}
	}, [playlist?.coverArt]);

	useEffect(() => {
		if (playlist) {
			setEditName(playlist.name);
		}
	}, [playlist]);

	if (isLoading) {
		return (
			<div className="p-6">
				<div className="animate-pulse">
					<div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
						<div className="w-48 h-48 sm:w-64 sm:h-64 bg-muted rounded-lg" />
						<div className="flex-1 space-y-4 text-center md:text-left">
							<div className="h-8 bg-muted rounded w-1/2 mx-auto md:mx-0" />
							<div className="h-4 bg-muted rounded w-1/3 mx-auto md:mx-0" />
							<div className="h-4 bg-muted rounded w-1/4 mx-auto md:mx-0" />
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (error || !playlist) {
		return (
			<div className="p-6">
				<div className="text-center py-12">
					<p className="text-destructive">Failed to load playlist</p>
					<Link to="/app/playlists">
						<Button variant="outline" className="mt-4">
							Back to Playlists
						</Button>
					</Link>
				</div>
			</div>
		);
	}

	const songs = playlist.entry ?? [];
	const totalDuration = songs.reduce(
		(acc, song) => acc + (song.duration || 0),
		0,
	);

	const isPlaylistPlaying = songs.some((song) => song.id === currentTrack?.id);

	const handlePlayPlaylist = () => {
		if (songs.length === 0) return;

		if (isPlaylistPlaying && isPlaying) {
			togglePlayPause();
		} else if (isPlaylistPlaying) {
			togglePlayPause();
		} else {
			playSong(songs[0], songs, 0);
		}
	};

	const handleShufflePlay = () => {
		if (songs.length === 0) return;

		// Shuffle the songs array
		const shuffled = [...songs];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}

		// Play the shuffled queue and enable shuffle mode
		playAlbum(shuffled, 0);
		if (!shuffle) {
			toggleShuffle();
		}
	};

	const handleDelete = () => {
		setDeleteDialogOpen(true);
	};

	const confirmDelete = () => {
		setDeleteDialogOpen(false);
		// Navigate immediately for optimistic UX
		navigate({ to: "/app/playlists" });
		deleteMutation.mutate();
	};

	const handleSaveEdit = (e: React.FormEvent) => {
		e.preventDefault();
		if (editName.trim() && editName !== playlist.name) {
			updateMutation.mutate(editName.trim());
		} else {
			setIsEditing(false);
		}
	};

	return (
		<div className="p-6 space-y-6">
			{/* Delete confirmation dialog */}
			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Playlist</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete "{playlist.name}"? This action
							cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={confirmDelete}
							disabled={deleteMutation.isPending}
						>
							{deleteMutation.isPending ? (
								<>
									<Loader2 className="w-4 h-4 animate-spin mr-2" />
									Deleting...
								</>
							) : (
								"Delete"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Back button */}
			<Link
				to="/app/playlists"
				className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				<ArrowLeft className="w-4 h-4" />
				Back to Playlists
			</Link>

			{/* Playlist header */}
			<div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
				{/* Cover art */}
				<div className="w-48 h-48 sm:w-64 sm:h-64 rounded-lg overflow-hidden bg-muted flex-shrink-0 shadow-lg">
					{coverUrl ? (
						<img
							src={coverUrl}
							alt={playlist.name}
							className={cn(
								"w-full h-full object-cover transition-opacity duration-200",
								coverLoaded ? "opacity-100" : "opacity-0",
							)}
							onLoad={() => setCoverLoaded(true)}
						/>
					) : (
						<div className="w-full h-full flex items-center justify-center">
							<ListMusic className="w-24 h-24 text-muted-foreground" />
						</div>
					)}
				</div>

				{/* Playlist info */}
				<div className="flex flex-col justify-end space-y-2 text-center md:text-left items-center md:items-start">
					<p className="text-sm text-muted-foreground uppercase tracking-wide">
						Playlist
					</p>

					{isEditing ? (
						<form onSubmit={handleSaveEdit} className="flex gap-2">
							<Input
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								className="text-2xl font-bold h-auto py-1"
								autoFocus
							/>
							<Button
								type="submit"
								size="icon"
								disabled={updateMutation.isPending}
							>
								{updateMutation.isPending ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : (
									<Check className="w-4 h-4" />
								)}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={() => {
									setIsEditing(false);
									setEditName(playlist.name);
								}}
							>
								<X className="w-4 h-4" />
							</Button>
						</form>
					) : (
						<div className="flex items-center gap-2">
							<h1 className="text-2xl sm:text-4xl font-bold text-foreground">
								{playlist.name}
							</h1>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								onClick={() => setIsEditing(true)}
								title="Edit name"
							>
								<Pencil className="w-4 h-4" />
							</Button>
						</div>
					)}

					<div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-muted-foreground">
						{playlist.owner && (
							<span className="font-medium text-foreground">
								{playlist.owner}
							</span>
						)}
						{songs.length > 0 && (
							<>
								{playlist.owner && <span>·</span>}
								<span>
									{songs.length} song{songs.length !== 1 ? "s" : ""}
								</span>
							</>
						)}
						{totalDuration > 0 && (
							<>
								<span>·</span>
								<span>{formatTotalDuration(totalDuration)}</span>
							</>
						)}
					</div>

					{playlist.comment && (
						<p className="text-sm text-muted-foreground">{playlist.comment}</p>
					)}

					<div className="pt-4 flex items-center gap-3">
						<Button
							size="lg"
							className="gap-2"
							onClick={handlePlayPlaylist}
							disabled={songs.length === 0}
						>
							{isPlaylistPlaying && isPlaying ? (
								<>
									<Pause className="w-5 h-5" />
									Pause
								</>
							) : (
								<>
									<Play className="w-5 h-5" />
									Play
								</>
							)}
						</Button>
						<Button
							variant="outline"
							size="lg"
							className={cn("gap-2", shuffle && "text-primary border-primary")}
							onClick={handleShufflePlay}
							disabled={songs.length === 0}
							title="Shuffle play"
						>
							<Shuffle className="w-5 h-5" />
							Shuffle
						</Button>
						<Button
							variant="outline"
							size="icon"
							className="h-10 w-10"
							onClick={() => setAddSongsDialogOpen(true)}
							title="Add songs"
						>
							<Plus className="w-5 h-5" />
						</Button>
						<Button
							variant="outline"
							size="icon"
							className="h-10 w-10"
							onClick={handleDelete}
							disabled={deleteMutation.isPending}
							title="Delete playlist"
						>
							{deleteMutation.isPending ? (
								<Loader2 className="w-5 h-5 animate-spin" />
							) : (
								<Trash2 className="w-5 h-5" />
							)}
						</Button>
					</div>
				</div>
			</div>

			{/* Add Songs Dialog */}
			<Dialog open={addSongsDialogOpen} onOpenChange={setAddSongsDialogOpen}>
				<DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
					<DialogHeader>
						<DialogTitle>Add Songs to Playlist</DialogTitle>
						<DialogDescription>
							Search for songs to add to "{playlist.name}"
						</DialogDescription>
					</DialogHeader>
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
						<Input
							placeholder="Search for songs..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
							autoFocus
						/>
						{isSearching && (
							<Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
						)}
					</div>
					<div className="flex-1 overflow-y-auto min-h-0 space-y-1">
						{searchResults.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground">
								{searchQuery && !isSearching
									? "No songs found"
									: !searchQuery
										? "Start typing to search for songs"
										: "Searching..."}
							</div>
						) : (
							searchResults.map((song) => (
								<SearchResultItem
									key={song.id}
									song={song}
									isSelected={selectedSongIds.has(song.id)}
									isAlreadyInPlaylist={songs.some((s) => s.id === song.id)}
									onToggle={() => toggleSongSelection(song.id)}
								/>
							))
						)}
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setAddSongsDialogOpen(false);
								setSearchQuery("");
								setSearchResults([]);
								setSelectedSongIds(new Set());
							}}
						>
							Cancel
						</Button>
						<Button
							onClick={handleAddSelectedSongs}
							disabled={
								selectedSongIds.size === 0 || addSongsMutation.isPending
							}
						>
							{addSongsMutation.isPending ? (
								<>
									<Loader2 className="w-4 h-4 animate-spin mr-2" />
									Adding...
								</>
							) : (
								`Add ${selectedSongIds.size} Song${selectedSongIds.size !== 1 ? "s" : ""}`
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Song list */}
			{songs.length === 0 ? (
				<div className="text-center py-12 bg-card rounded-lg border">
					<ListMusic className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
					<p className="text-muted-foreground">This playlist is empty</p>
					<p className="text-sm text-muted-foreground mt-1">
						Add songs from albums or search to add songs
					</p>
					<Button className="mt-4" onClick={() => setAddSongsDialogOpen(true)}>
						<Plus className="w-4 h-4 mr-2" />
						Add Songs
					</Button>
				</div>
			) : (
				<PlaylistSongList playlistId={playlistId} songs={songs} />
			)}
		</div>
	);
}
