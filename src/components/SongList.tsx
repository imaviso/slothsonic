import { Link } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Clock, Music, Play } from "lucide-react";
import { memo, useRef, useState } from "react";

import { useCoverArt } from "@/hooks/use-cover-art";
import type { Song } from "@/lib/api";
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

interface SongRowProps {
	song: Song;
	index: number;
	songs: Song[];
	showAlbum?: boolean;
	showArtist?: boolean;
	isCurrentTrack: boolean;
	isPlaying: boolean;
	onPlay: () => void;
}

const SongRow = memo(
	function SongRow({
		song,
		index,
		songs,
		showAlbum = true,
		showArtist = true,
		isCurrentTrack,
		isPlaying,
		onPlay,
	}: SongRowProps) {
		const { data: coverUrl } = useCoverArt(song.coverArt, 50);
		const [imageLoaded, setImageLoaded] = useState(false);

		const isThisTrackPlaying = isCurrentTrack && isPlaying;

		return (
			<SongContextMenu song={song} songs={songs} index={index}>
				<div
					className={cn(
						"w-full grid gap-4 px-4 py-2 hover:bg-muted/50 transition-colors group",
						showAlbum
							? "grid-cols-[auto_1fr_auto_auto_auto] sm:grid-cols-[auto_1fr_1fr_auto_auto_auto]"
							: "grid-cols-[auto_1fr_auto_auto_auto]",
						isCurrentTrack && "bg-muted/30",
					)}
				>
					{/* Play indicator / track number */}
					<button
						type="button"
						onClick={onPlay}
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
						onClick={onPlay}
						className="flex items-center gap-3 min-w-0 text-left"
					>
						{coverUrl ? (
							<img
								src={coverUrl}
								alt={song.title}
								loading="lazy"
								className={cn(
									"w-10 h-10 rounded object-cover flex-shrink-0 transition-opacity duration-200",
									imageLoaded ? "opacity-100" : "opacity-0",
								)}
								onLoad={() => setImageLoaded(true)}
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
							{showArtist && song.artist && (
								<p className="text-xs text-muted-foreground truncate">
									{song.artistId ? (
										<Link
											to="/app/artists/$artistId"
											params={{ artistId: song.artistId }}
											onClick={(e) => e.stopPropagation()}
											className="hover:underline hover:text-foreground"
										>
											{song.artist}
										</Link>
									) : (
										song.artist
									)}
								</p>
							)}
						</div>
					</button>

					{/* Album */}
					{showAlbum && (
						<div className="hidden sm:flex items-center min-w-0">
							<p className="text-sm text-muted-foreground truncate">
								{song.albumId ? (
									<Link
										to="/app/albums/$albumId"
										params={{ albumId: song.albumId }}
										className="hover:underline hover:text-foreground"
									>
										{song.album}
									</Link>
								) : (
									song.album
								)}
							</p>
						</div>
					)}

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

					{/* Duration */}
					<div className="flex items-center">
						<span className="text-sm text-muted-foreground">
							{song.duration ? formatDuration(song.duration) : "—"}
						</span>
					</div>
				</div>
			</SongContextMenu>
		);
	},
	(prevProps, nextProps) => {
		// Custom comparison for memoization
		return (
			prevProps.song.id === nextProps.song.id &&
			prevProps.song.starred === nextProps.song.starred &&
			prevProps.index === nextProps.index &&
			prevProps.isCurrentTrack === nextProps.isCurrentTrack &&
			prevProps.isPlaying === nextProps.isPlaying &&
			prevProps.showAlbum === nextProps.showAlbum &&
			prevProps.showArtist === nextProps.showArtist
		);
	},
);

interface SongListProps {
	songs: Song[];
	isLoading?: boolean;
	showAlbum?: boolean;
	showArtist?: boolean;
	showHeader?: boolean;
	/** Max height for virtualized list. Use "auto" to fill available space, or a number for fixed pixels */
	maxHeight?: number | "auto";
}

const ROW_HEIGHT = 56; // Approximate height of each row in pixels

export function SongList({
	songs,
	isLoading,
	showAlbum = true,
	showArtist = true,
	showHeader = true,
	maxHeight = "auto",
}: SongListProps) {
	const { currentTrack, isPlaying, togglePlayPause } = usePlayer();
	const parentRef = useRef<HTMLDivElement>(null);

	// Only use virtualization for large lists
	const shouldVirtualize = songs.length > 20;

	const virtualizer = useVirtualizer({
		count: songs.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => ROW_HEIGHT,
		overscan: 5,
	});

	const handlePlay = (song: Song, index: number) => {
		if (song.id === currentTrack?.id) {
			togglePlayPause();
		} else {
			playSong(song, songs, index);
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-2">
				{Array.from({ length: 10 }).map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholder
						key={i}
						className="flex items-center gap-4 px-4 py-2 animate-pulse"
					>
						<div className="w-8 h-4 bg-muted rounded" />
						<div className="w-10 h-10 bg-muted rounded" />
						<div className="flex-1 space-y-2">
							<div className="h-4 bg-muted rounded w-1/3" />
							<div className="h-3 bg-muted rounded w-1/4" />
						</div>
						<div className="w-12 h-4 bg-muted rounded" />
					</div>
				))}
			</div>
		);
	}

	if (songs.length === 0) {
		return (
			<div className="text-center py-12">
				<Music className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
				<p className="text-muted-foreground">No songs found</p>
			</div>
		);
	}

	// For small lists, render without virtualization
	if (!shouldVirtualize) {
		return (
			<div className="bg-card rounded-lg border">
				{showHeader && (
					<div
						className={cn(
							"grid gap-4 px-4 py-2 border-b text-sm text-muted-foreground",
							showAlbum
								? "grid-cols-[auto_1fr_auto_auto_auto] sm:grid-cols-[auto_1fr_1fr_auto_auto_auto]"
								: "grid-cols-[auto_1fr_auto_auto_auto]",
						)}
					>
						<span className="w-8 text-center">#</span>
						<span>Title</span>
						{showAlbum && <span className="hidden sm:block">Album</span>}
						{/* Empty headers for star and playlist columns */}
						<span />
						<span />
						<span className="flex items-center gap-1">
							<Clock className="w-4 h-4" />
						</span>
					</div>
				)}
				<div className="divide-y">
					{songs.map((song, index) => (
						<SongRow
							key={song.id}
							song={song}
							index={index}
							songs={songs}
							showAlbum={showAlbum}
							showArtist={showArtist}
							isCurrentTrack={song.id === currentTrack?.id}
							isPlaying={isPlaying}
							onPlay={() => handlePlay(song, index)}
						/>
					))}
				</div>
			</div>
		);
	}

	// For large lists, use virtualization
	return (
		<div className="bg-card rounded-lg border">
			{showHeader && (
				<div
					className={cn(
						"grid gap-4 px-4 py-2 border-b text-sm text-muted-foreground",
						showAlbum
							? "grid-cols-[auto_1fr_auto_auto_auto] sm:grid-cols-[auto_1fr_1fr_auto_auto_auto]"
							: "grid-cols-[auto_1fr_auto_auto_auto]",
					)}
				>
					<span className="w-8 text-center">#</span>
					<span>Title</span>
					{showAlbum && <span className="hidden sm:block">Album</span>}
					{/* Empty headers for star and playlist columns */}
					<span />
					<span />
					<span className="flex items-center gap-1">
						<Clock className="w-4 h-4" />
					</span>
				</div>
			)}
			<div
				ref={parentRef}
				className="overflow-auto"
				style={{
					height:
						maxHeight === "auto"
							? "calc(100vh - 300px)" // Auto fills viewport minus header/player
							: Math.min(songs.length * ROW_HEIGHT, maxHeight),
					minHeight: ROW_HEIGHT * 5, // At least 5 rows visible
				}}
			>
				<div
					style={{
						height: virtualizer.getTotalSize(),
						width: "100%",
						position: "relative",
					}}
				>
					{virtualizer.getVirtualItems().map((virtualRow) => {
						const song = songs[virtualRow.index];
						return (
							<div
								key={song.id}
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									width: "100%",
									height: `${virtualRow.size}px`,
									transform: `translateY(${virtualRow.start}px)`,
								}}
								className="border-b border-border last:border-b-0"
							>
								<SongRow
									song={song}
									index={virtualRow.index}
									songs={songs}
									showAlbum={showAlbum}
									showArtist={showArtist}
									isCurrentTrack={song.id === currentTrack?.id}
									isPlaying={isPlaying}
									onPlay={() => handlePlay(song, virtualRow.index)}
								/>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
