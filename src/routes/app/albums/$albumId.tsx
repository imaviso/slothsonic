import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, Disc3, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";

import { StarButton } from "@/components/StarButton";
import { Button } from "@/components/ui/button";
import { getAlbum, getCoverArtUrl } from "@/lib/api";
import { playAlbum, playSong, usePlayer } from "@/lib/player";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/albums/$albumId")({
	component: AlbumDetailPage,
});

function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTotalDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	if (hours > 0) {
		return `${hours} hr ${mins} min`;
	}
	return `${mins} min`;
}

function AlbumDetailPage() {
	const { albumId } = Route.useParams();
	const [coverUrl, setCoverUrl] = useState<string | null>(null);
	const [imageError, setImageError] = useState(false);
	const { currentTrack, isPlaying, togglePlayPause } = usePlayer();

	const { data, isLoading, error } = useQuery({
		queryKey: ["album", albumId],
		queryFn: () => getAlbum(albumId),
	});

	useEffect(() => {
		if (data?.album.coverArt) {
			getCoverArtUrl(data.album.coverArt, 500).then(setCoverUrl);
		}
	}, [data?.album.coverArt]);

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

	if (error || !data) {
		return (
			<div className="p-6">
				<div className="text-center py-12">
					<p className="text-destructive">Failed to load album</p>
					<Link to="/app/albums">
						<Button variant="outline" className="mt-4">
							Back to Albums
						</Button>
					</Link>
				</div>
			</div>
		);
	}

	const { album, songs } = data;
	const totalDuration = songs.reduce(
		(acc, song) => acc + (song.duration || 0),
		0,
	);

	// Check if current track is from this album
	const isAlbumPlaying = songs.some((song) => song.id === currentTrack?.id);

	const handlePlayAlbum = () => {
		if (isAlbumPlaying && isPlaying) {
			togglePlayPause();
		} else if (isAlbumPlaying) {
			togglePlayPause();
		} else {
			playAlbum(songs, 0);
		}
	};

	const handlePlayTrack = (index: number) => {
		if (songs[index].id === currentTrack?.id) {
			togglePlayPause();
		} else {
			playSong(songs[index], songs, index);
		}
	};

	return (
		<div className="p-6 space-y-6">
			{/* Back button */}
			<Link
				to="/app/albums"
				className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				<ArrowLeft className="w-4 h-4" />
				Back to Albums
			</Link>

			{/* Album header */}
			<div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
				{/* Cover art */}
				<div className="w-48 h-48 sm:w-64 sm:h-64 rounded-lg overflow-hidden bg-muted flex-shrink-0 shadow-lg">
					{coverUrl && !imageError ? (
						<img
							src={coverUrl}
							alt={album.name}
							className="w-full h-full object-cover"
							onError={() => setImageError(true)}
						/>
					) : (
						<div className="w-full h-full flex items-center justify-center">
							<Disc3 className="w-24 h-24 text-muted-foreground" />
						</div>
					)}
				</div>

				{/* Album info */}
				<div className="flex flex-col justify-end space-y-2 text-center md:text-left items-center md:items-start">
					<p className="text-sm text-muted-foreground uppercase tracking-wide">
						Album
					</p>
					<h1 className="text-2xl sm:text-4xl font-bold text-foreground">
						{album.name}
					</h1>
					<div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-muted-foreground">
						{album.artist && (
							<span className="font-medium text-foreground">
								{album.artist}
							</span>
						)}
						{album.year && (
							<>
								<span>•</span>
								<span>{album.year}</span>
							</>
						)}
						{songs.length > 0 && (
							<>
								<span>•</span>
								<span>
									{songs.length} song{songs.length !== 1 ? "s" : ""}
								</span>
							</>
						)}
						{totalDuration > 0 && (
							<>
								<span>•</span>
								<span>{formatTotalDuration(totalDuration)}</span>
							</>
						)}
					</div>
					<div className="pt-4 flex items-center gap-3">
						<Button size="lg" className="gap-2" onClick={handlePlayAlbum}>
							{isAlbumPlaying && isPlaying ? (
								<>
									<Pause className="w-5 h-5" />
									Pause
								</>
							) : (
								<>
									<Play className="w-5 h-5" />
									Play Album
								</>
							)}
						</Button>
						<StarButton
							id={album.id}
							type="album"
							isStarred={!!album.starred}
							size="lg"
						/>
					</div>
				</div>
			</div>

			{/* Track list */}
			<div className="bg-card rounded-lg border">
				<div className="grid grid-cols-[2rem_1fr_2rem_3rem] gap-4 px-4 py-2 border-b text-sm text-muted-foreground">
					<span className="text-center">#</span>
					<span>Title</span>
					{/* Empty header for star column */}
					<span />
					<span className="flex items-center justify-end">
						<Clock className="w-4 h-4" />
					</span>
				</div>
				<div className="divide-y">
					{songs.map((song, index) => {
						const isCurrentTrack = song.id === currentTrack?.id;
						const isThisTrackPlaying = isCurrentTrack && isPlaying;

						return (
							<div
								key={song.id}
								className={cn(
									"w-full grid grid-cols-[2rem_1fr_2rem_3rem] gap-4 px-4 py-3 hover:bg-muted/50 transition-colors group",
									isCurrentTrack && "bg-muted/30",
								)}
							>
								{/* Track number / Play indicator */}
								<button
									type="button"
									onClick={() => handlePlayTrack(index)}
									className="flex items-center justify-center"
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
													isCurrentTrack
														? "text-primary"
														: "text-muted-foreground",
												)}
											>
												{song.track || index + 1}
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
									onClick={() => handlePlayTrack(index)}
									className="min-w-0 text-left"
								>
									<p
										className={cn(
											"font-medium truncate",
											isCurrentTrack ? "text-primary" : "text-foreground",
										)}
									>
										{song.title}
									</p>
									{song.artist && song.artist !== album.artist && (
										<p className="text-sm text-muted-foreground truncate">
											{song.artist}
										</p>
									)}
								</button>

								{/* Star button */}
								<div className="flex items-center">
									<StarButton
										id={song.id}
										type="song"
										isStarred={!!song.starred}
										size="sm"
									/>
								</div>

								{/* Duration */}
								<span className="text-sm text-muted-foreground flex items-center justify-end">
									{song.duration ? formatDuration(song.duration) : "—"}
								</span>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
