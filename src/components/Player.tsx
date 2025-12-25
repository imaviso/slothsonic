import { Link } from "@tanstack/react-router";
import {
	Disc3,
	FileText,
	ListMusic,
	Loader2,
	Pause,
	Play,
	Repeat,
	Repeat1,
	Shuffle,
	SkipBack,
	SkipForward,
	Volume2,
	VolumeX,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AddToPlaylistButton } from "@/components/AddToPlaylistButton";
import { LyricsPanel } from "@/components/LyricsPanel";
import { StarButton } from "@/components/StarButton";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { getTrackCoverUrl, usePlayer } from "@/lib/player";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
	if (!seconds || !Number.isFinite(seconds)) return "0:00";
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function Player() {
	const {
		currentTrack,
		queue,
		queueIndex,
		isPlaying,
		isLoading,
		currentTime,
		duration,
		volume,
		shuffle,
		repeat,
		togglePlayPause,
		playNext,
		playPrevious,
		seek,
		setVolume,
		playSong,
		toggleShuffle,
		toggleRepeat,
	} = usePlayer();

	const [coverUrl, setCoverUrl] = useState<string | null>(null);
	const [isSeeking, setIsSeeking] = useState(false);
	const [seekValue, setSeekValue] = useState(0);
	const [prevVolume, setPrevVolume] = useState(1);
	const [showQueue, setShowQueue] = useState(false);
	const [showLyrics, setShowLyrics] = useState(false);

	useEffect(() => {
		if (currentTrack?.coverArt) {
			getTrackCoverUrl(currentTrack.coverArt, 100).then(setCoverUrl);
		} else {
			setCoverUrl(null);
		}
	}, [currentTrack?.coverArt]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			const isInputFocused =
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable;

			if (isInputFocused) return;

			switch (e.code) {
				case "Space":
					e.preventDefault();
					togglePlayPause();
					break;
				case "ArrowLeft":
					e.preventDefault();
					seek(Math.max(0, currentTime - 10));
					break;
				case "ArrowRight":
					e.preventDefault();
					seek(Math.min(duration || 0, currentTime + 10));
					break;
				case "ArrowUp":
					e.preventDefault();
					setVolume(Math.min(1, volume + 0.1));
					break;
				case "ArrowDown":
					e.preventDefault();
					setVolume(Math.max(0, volume - 0.1));
					break;
				case "KeyN":
					e.preventDefault();
					playNext();
					break;
				case "KeyP":
					e.preventDefault();
					playPrevious();
					break;
				default:
					break;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		togglePlayPause,
		seek,
		playNext,
		playPrevious,
		setVolume,
		currentTime,
		duration,
		volume,
	]);

	// Don't render if no track
	if (!currentTrack) {
		return null;
	}

	const handleSeekStart = () => {
		setIsSeeking(true);
		setSeekValue(currentTime);
	};

	const handleSeekChange = (value: number[]) => {
		setSeekValue(value[0]);
	};

	const handleSeekEnd = (value: number[]) => {
		seek(value[0]);
		setIsSeeking(false);
	};

	const toggleMute = () => {
		if (volume > 0) {
			setPrevVolume(volume);
			setVolume(0);
		} else {
			setVolume(prevVolume);
		}
	};

	return (
		<div className="relative border-t bg-card px-3 py-2 sm:px-4 sm:py-0 sm:h-20 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
			{/* Mobile: Top row with track info and controls */}
			<div className="flex items-center gap-3 sm:flex-1 sm:basis-0 min-w-0">
				{/* Track cover - smaller on mobile */}
				<Link
					to={currentTrack.albumId ? "/app/albums/$albumId" : "/"}
					params={currentTrack.albumId ? { albumId: currentTrack.albumId } : {}}
					className="w-10 h-10 sm:w-14 sm:h-14 rounded-md overflow-hidden bg-muted flex-shrink-0 block hover:opacity-80 transition-opacity"
				>
					{coverUrl ? (
						<img
							src={coverUrl}
							alt={currentTrack.title}
							className="w-full h-full object-cover"
						/>
					) : (
						<div className="w-full h-full flex items-center justify-center">
							<Disc3 className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
						</div>
					)}
				</Link>
				<div className="min-w-0 flex-1">
					<Link
						to={currentTrack.albumId ? "/app/albums/$albumId" : "/"}
						params={
							currentTrack.albumId ? { albumId: currentTrack.albumId } : {}
						}
						className="font-medium text-sm text-foreground truncate hover:text-primary transition-colors block"
					>
						{currentTrack.title}
					</Link>
					<Link
						to={currentTrack.artistId ? "/app/artists/$artistId" : "/"}
						params={
							currentTrack.artistId ? { artistId: currentTrack.artistId } : {}
						}
						className="text-xs text-muted-foreground truncate hover:text-primary transition-colors block"
					>
						{currentTrack.artist}
					</Link>
				</div>

				{/* Mobile-only: Compact controls next to track info */}
				<div className="flex items-center gap-1 sm:hidden">
					<Button
						variant="ghost"
						size="icon"
						className="w-8 h-8"
						onClick={playPrevious}
					>
						<SkipBack className="w-4 h-4" />
					</Button>
					<Button
						variant="default"
						size="icon"
						className="w-10 h-10 rounded-full"
						onClick={togglePlayPause}
						disabled={isLoading}
					>
						{isLoading ? (
							<Loader2 className="w-5 h-5 animate-spin" />
						) : isPlaying ? (
							<Pause className="w-5 h-5" />
						) : (
							<Play className="w-5 h-5 ml-0.5" />
						)}
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="w-8 h-8"
						onClick={playNext}
					>
						<SkipForward className="w-4 h-4" />
					</Button>
				</div>
			</div>

			{/* Player controls - hidden on mobile, shown on sm+ */}
			<div className="hidden sm:flex flex-col items-center gap-1 w-full max-w-md lg:max-w-xl">
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						className={cn("w-8 h-8", shuffle && "text-primary")}
						onClick={toggleShuffle}
						title="Shuffle"
					>
						<Shuffle className="w-4 h-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="w-8 h-8"
						onClick={playPrevious}
					>
						<SkipBack className="w-4 h-4" />
					</Button>
					<Button
						variant="default"
						size="icon"
						className="w-10 h-10 rounded-full"
						onClick={togglePlayPause}
						disabled={isLoading}
					>
						{isLoading ? (
							<Loader2 className="w-5 h-5 animate-spin" />
						) : isPlaying ? (
							<Pause className="w-5 h-5" />
						) : (
							<Play className="w-5 h-5 ml-0.5" />
						)}
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="w-8 h-8"
						onClick={playNext}
					>
						<SkipForward className="w-4 h-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className={cn("w-8 h-8", repeat !== "off" && "text-primary")}
						onClick={toggleRepeat}
						title={
							repeat === "off"
								? "Repeat off"
								: repeat === "all"
									? "Repeat all"
									: "Repeat one"
						}
					>
						{repeat === "one" ? (
							<Repeat1 className="w-4 h-4" />
						) : (
							<Repeat className="w-4 h-4" />
						)}
					</Button>
				</div>

				{/* Progress bar - desktop */}
				<div className="w-full flex items-center gap-2">
					<span className="text-xs text-muted-foreground w-10 text-right">
						{formatTime(isSeeking ? seekValue : currentTime)}
					</span>
					<Slider
						value={[isSeeking ? seekValue : currentTime]}
						min={0}
						max={duration || 100}
						step={1}
						onPointerDown={handleSeekStart}
						onValueChange={handleSeekChange}
						onValueCommit={handleSeekEnd}
						className={cn("flex-1", !duration && "opacity-50")}
						disabled={!duration}
					/>
					<span className="text-xs text-muted-foreground w-10">
						{formatTime(duration)}
					</span>
				</div>
			</div>

			{/* Mobile: Progress bar */}
			<div className="flex sm:hidden items-center gap-2 w-full">
				<span className="text-xs text-muted-foreground w-8 text-right">
					{formatTime(isSeeking ? seekValue : currentTime)}
				</span>
				<Slider
					value={[isSeeking ? seekValue : currentTime]}
					min={0}
					max={duration || 100}
					step={1}
					onPointerDown={handleSeekStart}
					onValueChange={handleSeekChange}
					onValueCommit={handleSeekEnd}
					className={cn("flex-1", !duration && "opacity-50")}
					disabled={!duration}
				/>
				<span className="text-xs text-muted-foreground w-8">
					{formatTime(duration)}
				</span>
			</div>

			{/* Favorite, queue, and volume controls - hidden on mobile */}
			<div className="hidden sm:flex items-center justify-end gap-2 sm:flex-1 sm:basis-0">
				<StarButton
					id={currentTrack.id}
					type="song"
					isStarred={!!currentTrack.starred}
					size="sm"
				/>
				<AddToPlaylistButton
					songId={currentTrack.id}
					song={{
						id: currentTrack.id,
						title: currentTrack.title,
						artist: currentTrack.artist,
						album: currentTrack.album,
						albumId: currentTrack.albumId,
						duration: currentTrack.duration,
						coverArt: currentTrack.coverArt,
					}}
					size="sm"
				/>
				<Button
					variant="ghost"
					size="icon"
					className={cn("w-8 h-8", showLyrics && "text-primary")}
					onClick={() => {
						setShowQueue(false);
						setShowLyrics(!showLyrics);
					}}
					title="View lyrics"
				>
					<FileText className="w-4 h-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className={cn("w-8 h-8", showQueue && "text-primary")}
					onClick={() => {
						setShowLyrics(false);
						setShowQueue(!showQueue);
					}}
					title="View queue"
				>
					<ListMusic className="w-4 h-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="w-8 h-8"
					onClick={toggleMute}
				>
					{volume === 0 ? (
						<VolumeX className="w-4 h-4" />
					) : (
						<Volume2 className="w-4 h-4" />
					)}
				</Button>
				<Slider
					value={[volume]}
					min={0}
					max={1}
					step={0.01}
					onValueChange={(value) => setVolume(value[0])}
					className="w-24"
				/>
			</div>

			{/* Queue panel */}
			{showQueue && (
				<div className="absolute bottom-full right-0 mb-2 w-80 max-h-96 bg-card border rounded-lg shadow-lg overflow-hidden">
					<div className="flex items-center justify-between px-4 py-2 border-b">
						<h3 className="font-medium text-sm">Queue</h3>
						<Button
							variant="ghost"
							size="icon"
							className="w-6 h-6"
							onClick={() => setShowQueue(false)}
						>
							<X className="w-4 h-4" />
						</Button>
					</div>
					<div className="overflow-y-auto max-h-80 scrollbar-thin">
						{queue.length === 0 ? (
							<div className="p-4 text-center text-sm text-muted-foreground">
								Queue is empty
							</div>
						) : (
							<div className="divide-y">
								{queue.map((song, index) => (
									<button
										type="button"
										key={`${song.id}-${index}`}
										onClick={() => playSong(song, queue, index)}
										className={cn(
											"w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/50 transition-colors text-left",
											index === queueIndex && "bg-muted/30",
										)}
									>
										<span
											className={cn(
												"w-5 text-xs text-muted-foreground",
												index === queueIndex && "text-primary font-medium",
											)}
										>
											{index + 1}
										</span>
										<div className="min-w-0 flex-1">
											<p
												className={cn(
													"text-sm truncate",
													index === queueIndex
														? "text-primary font-medium"
														: "text-foreground",
												)}
											>
												{song.title}
											</p>
											<p className="text-xs text-muted-foreground truncate">
												{song.artist}
											</p>
										</div>
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			)}

			{/* Lyrics panel */}
			{showLyrics && (
				<div className="absolute bottom-full right-0 mb-2 w-96 max-h-[60vh] bg-card border rounded-lg shadow-lg overflow-hidden">
					<LyricsPanel
						songTitle={currentTrack.title}
						songArtist={currentTrack.artist ?? ""}
						onClose={() => setShowLyrics(false)}
					/>
				</div>
			)}
		</div>
	);
}
