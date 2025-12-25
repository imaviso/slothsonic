import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	ListMusic,
	Loader2,
	Pause,
	Pencil,
	Play,
	Shuffle,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { PlaylistSongList } from "@/components/PlaylistSongList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	deletePlaylist,
	getCoverArtUrl,
	getPlaylist,
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

function PlaylistDetailPage() {
	const { playlistId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [coverUrl, setCoverUrl] = useState<string | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [editName, setEditName] = useState("");
	const { currentTrack, isPlaying, togglePlayPause, shuffle, toggleShuffle } =
		usePlayer();

	const {
		data: playlist,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["playlist", playlistId],
		queryFn: () => getPlaylist(playlistId),
	});

	const updateMutation = useMutation({
		mutationFn: (name: string) => updatePlaylist({ playlistId, name }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["playlist", playlistId] });
			queryClient.invalidateQueries({ queryKey: ["playlists"] });
			setIsEditing(false);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: () => deletePlaylist(playlistId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["playlists"] });
			navigate({ to: "/app/playlists" });
		},
	});

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
		if (confirm("Are you sure you want to delete this playlist?")) {
			deleteMutation.mutate();
		}
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
							className="w-full h-full object-cover"
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
									"Save"
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

			{/* Song list */}
			{songs.length === 0 ? (
				<div className="text-center py-12 bg-card rounded-lg border">
					<ListMusic className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
					<p className="text-muted-foreground">This playlist is empty</p>
					<p className="text-sm text-muted-foreground mt-1">
						Add songs from albums or the song list
					</p>
				</div>
			) : (
				<PlaylistSongList playlistId={playlistId} songs={songs} />
			)}
		</div>
	);
}
