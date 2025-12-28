import { Link, useLocation } from "@tanstack/react-router";
import {
	ChevronDown,
	ChevronUp,
	Disc3,
	FileText,
	ListMusic,
	Loader2,
	Maximize2,
	Music,
	Pause,
	Play,
	Repeat,
	Repeat1,
	Shuffle,
	SkipBack,
	SkipForward,
	Trash2,
	Volume2,
	VolumeX,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AddToPlaylistButton } from "@/components/AddToPlaylistButton";
import { LyricsPanel } from "@/components/LyricsPanel";
import { QueueContextMenu } from "@/components/QueueContextMenu";
import { StarButton } from "@/components/StarButton";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import { useSidebar } from "@/components/ui/sidebar";
import { Slider } from "@/components/ui/slider";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Song } from "@/lib/api";
import { getTrackCoverUrl, restoreQueueState, usePlayer } from "@/lib/player";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
	if (!seconds || !Number.isFinite(seconds)) return "0:00";
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Queue item cover art component
function QueueItemCover({ song }: { song: Song }) {
	const [coverUrl, setCoverUrl] = useState<string | null>(null);

	useEffect(() => {
		if (song.coverArt) {
			getTrackCoverUrl(song.coverArt, 80).then(setCoverUrl);
		}
	}, [song.coverArt]);

	if (coverUrl) {
		return (
			<img
				src={coverUrl}
				alt={song.title}
				className="w-10 h-10 rounded object-cover flex-shrink-0"
			/>
		);
	}

	return (
		<div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
			<Music className="w-4 h-4 text-muted-foreground" />
		</div>
	);
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
		removeFromQueue,
		clearQueue,
		toggleShuffle,
		toggleRepeat,
	} = usePlayer();

	const isMobile = useIsMobile();
	const { state: sidebarState } = useSidebar();
	const [coverUrl, setCoverUrl] = useState<string | null>(null);
	const [largeCoverUrl, setLargeCoverUrl] = useState<string | null>(null);
	const [coverLoaded, setCoverLoaded] = useState(false);
	const [largeCoverLoaded, setLargeCoverLoaded] = useState(false);
	const [isSeeking, setIsSeeking] = useState(false);
	const [seekValue, setSeekValue] = useState(0);
	const [prevVolume, setPrevVolume] = useState(1);
	const [showQueue, setShowQueue] = useState(false);
	const [showLyrics, setShowLyrics] = useState(false);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [mobileTab, setMobileTab] = useState<"player" | "queue" | "lyrics">(
		"player",
	);
	const [isExpanded, setIsExpanded] = useState(false);
	const [expandedTab, setExpandedTab] = useState<"queue" | "lyrics">("queue");

	const volumeControlRef = useRef<HTMLDivElement>(null);
	const volumeControlExpandedRef = useRef<HTMLDivElement>(null);

	// Handle wheel events for volume control with non-passive listener
	useEffect(() => {
		const handleWheel = (e: WheelEvent) => {
			e.preventDefault();
			const delta = e.deltaY > 0 ? -0.05 : 0.05;
			setVolume(Math.max(0, Math.min(1, volume + delta)));
		};

		const element = volumeControlRef.current;
		const expandedElement = volumeControlExpandedRef.current;

		if (element) {
			element.addEventListener("wheel", handleWheel, { passive: false });
		}
		if (expandedElement) {
			expandedElement.addEventListener("wheel", handleWheel, {
				passive: false,
			});
		}

		return () => {
			if (element) {
				element.removeEventListener("wheel", handleWheel);
			}
			if (expandedElement) {
				expandedElement.removeEventListener("wheel", handleWheel);
			}
		};
	}, [volume, setVolume]);

	useEffect(() => {
		setCoverLoaded(false);
		setLargeCoverLoaded(false);
		if (currentTrack?.coverArt) {
			getTrackCoverUrl(currentTrack.coverArt, 100).then(setCoverUrl);
			getTrackCoverUrl(currentTrack.coverArt, 500).then(setLargeCoverUrl);
		} else {
			setCoverUrl(null);
			setLargeCoverUrl(null);
		}
	}, [currentTrack?.coverArt]);

	// Close expanded player on route change or navigation click
	const location = useLocation();
	const prevPathnameRef = useRef(location.pathname);
	useEffect(() => {
		if (prevPathnameRef.current !== location.pathname) {
			setIsExpanded(false);
			prevPathnameRef.current = location.pathname;
		}
	}, [location.pathname]);

	// Close expanded player when clicking navigation links (handles same-route clicks like Home -> Home)
	useEffect(() => {
		if (!isExpanded) return;

		const handleClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			// Check if click is inside the sidebar navigation area
			const isInSidebar = target.closest("[data-sidebar='sidebar']");
			const isNavLink = target.closest("a[href]");
			// Check if click is on a context menu navigation item
			const isContextMenuItem = target.closest(
				"[data-slot='context-menu-item']",
			);

			if ((isInSidebar && isNavLink) || isContextMenuItem) {
				setIsExpanded(false);
			}
		};

		// Use capture phase to catch clicks before they're handled
		document.addEventListener("click", handleClick, true);
		return () => document.removeEventListener("click", handleClick, true);
	}, [isExpanded]);

	// Close expanded player on ESC key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isExpanded) {
				setIsExpanded(false);
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isExpanded]);

	// Don't render if no track
	if (!currentTrack) {
		return null;
	}

	const handleSeekChange = (value: number[]) => {
		if (!isSeeking) {
			setIsSeeking(true);
		}
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

	// Queue panel content (shared between desktop and mobile)
	const queueContent = (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between px-4 py-3 border-b">
				<h3 className="font-semibold">Queue ({queue.length})</h3>
				<div className="flex items-center gap-1">
					{queue.length > 1 && (
						<Button
							variant="ghost"
							size="icon"
							className="w-8 h-8"
							onClick={() => {
								const previousState = clearQueue();
								if (previousState && previousState.previousQueue.length > 1) {
									toast.success("Queue cleared", {
										action: {
											label: "Undo",
											onClick: () => {
												restoreQueueState(previousState);
												toast.success("Queue restored");
											},
										},
									});
								}
							}}
							title="Clear queue"
						>
							<Trash2 className="w-4 h-4" />
						</Button>
					)}
					{!isMobile && (
						<Button
							variant="ghost"
							size="icon"
							className="w-8 h-8"
							onClick={() => setShowQueue(false)}
						>
							<X className="w-4 h-4" />
						</Button>
					)}
				</div>
			</div>
			<div className="overflow-y-auto flex-1 scrollbar-thin">
				{queue.length === 0 ? (
					<div className="p-4 text-center text-sm text-muted-foreground">
						Queue is empty
					</div>
				) : (
					<div className="divide-y">
						{queue.map((song, index) => (
							<QueueContextMenu
								key={`${song.id}-${index}`}
								song={song}
								index={index}
								isCurrentTrack={index === queueIndex}
								onRemove={() => removeFromQueue(index)}
							>
								<button
									type="button"
									onClick={() => playSong(song, queue, index)}
									className={cn(
										"w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/50 transition-colors text-left",
										index === queueIndex && "bg-muted/30",
									)}
								>
									<span
										className={cn(
											"w-5 text-xs text-muted-foreground text-center",
											index === queueIndex && "text-primary font-medium",
										)}
									>
										{index + 1}
									</span>
									<QueueItemCover song={song} />
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
							</QueueContextMenu>
						))}
					</div>
				)}
			</div>
		</div>
	);

	// Mobile expanded player content
	const mobileExpandedPlayer = (
		<div className="flex flex-col h-full bg-background">
			{/* Header with close button */}
			<div className="flex items-center justify-between p-4">
				<Button
					variant="ghost"
					size="icon"
					className="w-10 h-10"
					onClick={() => setDrawerOpen(false)}
				>
					<ChevronDown className="w-6 h-6" />
				</Button>
				<DrawerTitle className="text-sm font-medium text-muted-foreground">
					Now Playing
				</DrawerTitle>
				<div className="w-10" /> {/* Spacer for centering */}
			</div>

			{/* Tab switcher */}
			<div className="flex justify-center gap-1 px-4 pb-2">
				<Button
					variant={mobileTab === "player" ? "secondary" : "ghost"}
					size="sm"
					onClick={() => setMobileTab("player")}
					className="text-xs"
				>
					Player
				</Button>
				<Button
					variant={mobileTab === "lyrics" ? "secondary" : "ghost"}
					size="sm"
					onClick={() => setMobileTab("lyrics")}
					className="text-xs"
				>
					Lyrics
				</Button>
				<Button
					variant={mobileTab === "queue" ? "secondary" : "ghost"}
					size="sm"
					onClick={() => setMobileTab("queue")}
					className="text-xs"
				>
					Queue
				</Button>
			</div>

			{/* Content based on selected tab */}
			{mobileTab === "player" && (
				<div className="flex-1 flex flex-col px-6 pb-6">
					{/* Large album art */}
					<div className="flex-1 flex items-center justify-center py-4">
						<Link
							to={currentTrack.albumId ? "/app/albums/$albumId" : "/"}
							params={
								currentTrack.albumId ? { albumId: currentTrack.albumId } : {}
							}
							onClick={() => setDrawerOpen(false)}
							className="w-full max-w-[280px] aspect-square rounded-xl overflow-hidden bg-muted shadow-2xl"
						>
							{largeCoverUrl ? (
								<img
									src={largeCoverUrl}
									alt={currentTrack.title}
									className={cn(
										"w-full h-full object-cover transition-opacity duration-300",
										largeCoverLoaded ? "opacity-100" : "opacity-0",
									)}
									onLoad={() => setLargeCoverLoaded(true)}
								/>
							) : (
								<div className="w-full h-full flex items-center justify-center">
									<Disc3 className="w-24 h-24 text-muted-foreground" />
								</div>
							)}
						</Link>
					</div>

					{/* Track info */}
					<div className="space-y-1 text-center mb-6">
						<Link
							to={currentTrack.albumId ? "/app/albums/$albumId" : "/"}
							params={
								currentTrack.albumId ? { albumId: currentTrack.albumId } : {}
							}
							onClick={() => setDrawerOpen(false)}
							className="font-semibold text-lg text-foreground hover:text-primary transition-colors line-clamp-1"
						>
							{currentTrack.title}
						</Link>
						<Link
							to={currentTrack.artistId ? "/app/artists/$artistId" : "/"}
							params={
								currentTrack.artistId ? { artistId: currentTrack.artistId } : {}
							}
							onClick={() => setDrawerOpen(false)}
							className="text-muted-foreground hover:text-primary transition-colors block"
						>
							{currentTrack.artist}
						</Link>
					</div>

					{/* Progress bar */}
					<div className="space-y-2 mb-6">
						<Slider
							value={[isSeeking ? seekValue : currentTime]}
							min={0}
							max={duration || 100}
							step={1}
							onValueChange={handleSeekChange}
							onValueCommit={handleSeekEnd}
							className={cn(!duration && "opacity-50")}
							disabled={!duration}
						/>
						<div className="flex justify-between text-xs text-muted-foreground">
							<span>{formatTime(isSeeking ? seekValue : currentTime)}</span>
							<span>{formatTime(duration)}</span>
						</div>
					</div>

					{/* Main controls */}
					<div className="flex items-center justify-center gap-4 mb-6">
						<Button
							variant="ghost"
							size="icon"
							className={cn("w-12 h-12", shuffle && "text-primary")}
							onClick={toggleShuffle}
						>
							<Shuffle className="w-5 h-5" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="w-14 h-14"
							onClick={playPrevious}
						>
							<SkipBack className="w-7 h-7" />
						</Button>
						<Button
							variant="default"
							size="icon"
							className="w-16 h-16 rounded-full"
							onClick={togglePlayPause}
							disabled={isLoading}
						>
							{isLoading ? (
								<Loader2 className="w-8 h-8 animate-spin" />
							) : isPlaying ? (
								<Pause className="w-8 h-8" />
							) : (
								<Play className="w-8 h-8 ml-1" />
							)}
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="w-14 h-14"
							onClick={playNext}
						>
							<SkipForward className="w-7 h-7" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className={cn("w-12 h-12", repeat !== "off" && "text-primary")}
							onClick={toggleRepeat}
						>
							{repeat === "one" ? (
								<Repeat1 className="w-5 h-5" />
							) : (
								<Repeat className="w-5 h-5" />
							)}
						</Button>
					</div>

					{/* Secondary controls */}
					<div className="flex items-center justify-center gap-6">
						<StarButton
							id={currentTrack.id}
							type="song"
							isStarred={!!currentTrack.starred}
							size="lg"
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
							size="default"
							dropdownPosition="top"
						/>
					</div>
				</div>
			)}

			{mobileTab === "lyrics" && (
				<div className="flex-1 overflow-hidden">
					<LyricsPanel
						songId={currentTrack.id}
						songTitle={currentTrack.title}
						songArtist={currentTrack.artist ?? ""}
						currentTime={currentTime}
						onSeek={seek}
						onClose={() => setMobileTab("player")}
						showHeader={false}
					/>
				</div>
			)}

			{mobileTab === "queue" && (
				<div className="flex-1 overflow-hidden">{queueContent}</div>
			)}
		</div>
	);

	// Mobile mini player (the bar at the bottom)
	const mobilePlayer = (
		<Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
			<DrawerTrigger asChild>
				<div
					className="border-t bg-card cursor-pointer active:bg-muted/50 transition-colors"
					style={{ viewTransitionName: "player" }}
				>
					{/* Progress bar at top of mini player */}
					<div className="h-1 bg-muted">
						<div
							className="h-full bg-primary transition-all duration-200"
							style={{
								width: duration
									? `${((isSeeking ? seekValue : currentTime) / duration) * 100}%`
									: "0%",
							}}
						/>
					</div>
					<div className="px-3 py-2 flex items-center gap-3">
						{/* Track cover */}
						<div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
							{coverUrl ? (
								<img
									src={coverUrl}
									alt={currentTrack.title}
									className={cn(
										"w-full h-full object-cover transition-opacity duration-200",
										coverLoaded ? "opacity-100" : "opacity-0",
									)}
									onLoad={() => setCoverLoaded(true)}
								/>
							) : (
								<div className="w-full h-full flex items-center justify-center">
									<Disc3 className="w-5 h-5 text-muted-foreground" />
								</div>
							)}
						</div>

						{/* Track info */}
						<div className="min-w-0 flex-1">
							<p className="font-medium text-sm text-foreground truncate">
								{currentTrack.title}
							</p>
							<p className="text-xs text-muted-foreground truncate">
								{currentTrack.artist}
							</p>
						</div>

						{/* Controls */}
						<div className="flex items-center">
							<Button
								variant="ghost"
								size="icon"
								className="w-12 h-12"
								onClick={(e) => {
									e.stopPropagation();
									togglePlayPause();
								}}
								disabled={isLoading}
							>
								{isLoading ? (
									<Loader2 className="w-6 h-6 animate-spin" />
								) : isPlaying ? (
									<Pause className="w-6 h-6" />
								) : (
									<Play className="w-6 h-6 ml-0.5" />
								)}
							</Button>
						</div>
					</div>
				</div>
			</DrawerTrigger>
			<DrawerContent className="h-[100dvh] max-h-[100dvh] rounded-none">
				{mobileExpandedPlayer}
			</DrawerContent>
		</Drawer>
	);

	// Expanded desktop player content
	const expandedDesktopPlayer = (
		<div
			className={cn(
				"fixed top-0 right-0 bottom-0 bg-card flex flex-col z-50 transition-all duration-300 ease-out",
				sidebarState === "collapsed"
					? "left-[var(--sidebar-width-icon)]"
					: "left-[var(--sidebar-width)]",
				isExpanded
					? "opacity-100 translate-y-0 pointer-events-auto"
					: "opacity-0 translate-y-full pointer-events-none",
			)}
		>
			{/* Main content area */}
			<div className="flex-1 flex overflow-hidden">
				{/* Left side - Album art and controls */}
				<div className="flex-1 flex flex-col items-center justify-center p-8 min-w-0 relative">
					{/* Header with collapse button */}
					<div className="absolute top-4 left-4">
						<Button
							variant="ghost"
							size="icon"
							className="w-10 h-10"
							onClick={() => setIsExpanded(false)}
							title="Collapse player"
						>
							<ChevronDown className="w-6 h-6" />
						</Button>
					</div>

					{/* Large album art */}
					<Link
						to={currentTrack.albumId ? "/app/albums/$albumId" : "/"}
						params={
							currentTrack.albumId ? { albumId: currentTrack.albumId } : {}
						}
						className="w-full max-w-sm aspect-square rounded-xl overflow-hidden bg-muted shadow-2xl mb-6 block hover:opacity-90 transition-opacity"
					>
						{largeCoverUrl ? (
							<img
								src={largeCoverUrl}
								alt={currentTrack.title}
								className={cn(
									"w-full h-full object-cover transition-opacity duration-300",
									largeCoverLoaded ? "opacity-100" : "opacity-0",
								)}
								onLoad={() => setLargeCoverLoaded(true)}
							/>
						) : (
							<div className="w-full h-full flex items-center justify-center">
								<Disc3 className="w-24 h-24 text-muted-foreground" />
							</div>
						)}
					</Link>

					{/* Track info */}
					<div className="text-center mb-6 max-w-sm w-full">
						<Link
							to={currentTrack.albumId ? "/app/albums/$albumId" : "/"}
							params={
								currentTrack.albumId ? { albumId: currentTrack.albumId } : {}
							}
							className="font-bold text-xl text-foreground hover:text-primary transition-colors line-clamp-1 block"
						>
							{currentTrack.title}
						</Link>
						<Link
							to={currentTrack.artistId ? "/app/artists/$artistId" : "/"}
							params={
								currentTrack.artistId ? { artistId: currentTrack.artistId } : {}
							}
							className="text-base text-muted-foreground hover:text-primary transition-colors block mt-1"
						>
							{currentTrack.artist}
						</Link>
					</div>

					{/* Progress bar */}
					<div className="w-full max-w-sm space-y-2 mb-6">
						<Slider
							value={[isSeeking ? seekValue : currentTime]}
							min={0}
							max={duration || 100}
							step={1}
							onValueChange={handleSeekChange}
							onValueCommit={handleSeekEnd}
							className={cn(!duration && "opacity-50")}
							disabled={!duration}
						/>
						<div className="flex justify-between text-sm text-muted-foreground">
							<span>{formatTime(isSeeking ? seekValue : currentTime)}</span>
							<span>{formatTime(duration)}</span>
						</div>
					</div>

					{/* Main controls */}
					<div className="flex items-center justify-center gap-4 mb-6">
						<Button
							variant="ghost"
							size="icon"
							className={cn("w-10 h-10", shuffle && "text-primary")}
							onClick={toggleShuffle}
							title="Shuffle"
						>
							<Shuffle className="w-5 h-5" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="w-12 h-12"
							onClick={playPrevious}
						>
							<SkipBack className="w-7 h-7" />
						</Button>
						<Button
							variant="default"
							size="icon"
							className="w-16 h-16 rounded-full"
							onClick={togglePlayPause}
							disabled={isLoading}
						>
							{isLoading ? (
								<Loader2 className="w-8 h-8 animate-spin" />
							) : isPlaying ? (
								<Pause className="w-8 h-8" />
							) : (
								<Play className="w-8 h-8 ml-1" />
							)}
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="w-12 h-12"
							onClick={playNext}
						>
							<SkipForward className="w-7 h-7" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className={cn("w-10 h-10", repeat !== "off" && "text-primary")}
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
								<Repeat1 className="w-5 h-5" />
							) : (
								<Repeat className="w-5 h-5" />
							)}
						</Button>
					</div>

					{/* Secondary controls */}
					<div className="flex items-center justify-center gap-3">
						<StarButton
							id={currentTrack.id}
							type="song"
							isStarred={!!currentTrack.starred}
							size="lg"
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
							size="default"
							dropdownPosition="top"
						/>
						<div
							ref={volumeControlExpandedRef}
							className="flex items-center gap-2 ml-2"
						>
							<Button
								variant="ghost"
								size="icon"
								className="w-9 h-9"
								onClick={toggleMute}
							>
								{volume === 0 ? (
									<VolumeX className="w-5 h-5" />
								) : (
									<Volume2 className="w-5 h-5" />
								)}
							</Button>
							<Slider
								value={[volume]}
								min={0}
								max={1}
								step={0.01}
								onValueChange={(value) => setVolume(value[0])}
								className="w-28"
							/>
						</div>
					</div>
				</div>

				{/* Right side - Tabbed Queue/Lyrics panel */}
				<div className="w-[28rem] border-l flex flex-col shrink-0 bg-background/50">
					{/* Tab header */}
					<div className="flex items-center border-b shrink-0">
						<button
							type="button"
							onClick={() => setExpandedTab("queue")}
							className={cn(
								"flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
								expandedTab === "queue"
									? "text-primary border-b-2 border-primary bg-muted/30"
									: "text-muted-foreground hover:text-foreground hover:bg-muted/20",
							)}
						>
							<ListMusic className="w-4 h-4" />
							Queue ({queue.length})
						</button>
						<button
							type="button"
							onClick={() => setExpandedTab("lyrics")}
							className={cn(
								"flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
								expandedTab === "lyrics"
									? "text-primary border-b-2 border-primary bg-muted/30"
									: "text-muted-foreground hover:text-foreground hover:bg-muted/20",
							)}
						>
							<FileText className="w-4 h-4" />
							Lyrics
						</button>
					</div>

					{/* Tab content */}
					<div className="flex-1 overflow-hidden">
						{expandedTab === "queue" && (
							<div className="flex flex-col h-full">
								{queue.length > 1 && (
									<div className="flex items-center justify-end px-4 py-2 border-b">
										<Button
											variant="ghost"
											size="sm"
											className="h-8 text-xs text-muted-foreground hover:text-foreground"
											onClick={() => {
												const previousState = clearQueue();
												if (
													previousState &&
													previousState.previousQueue.length > 1
												) {
													toast.success("Queue cleared", {
														action: {
															label: "Undo",
															onClick: () => {
																restoreQueueState(previousState);
																toast.success("Queue restored");
															},
														},
													});
												}
											}}
										>
											<Trash2 className="w-3.5 h-3.5 mr-1.5" />
											Clear
										</Button>
									</div>
								)}
								<div className="overflow-y-auto flex-1 scrollbar-thin">
									{queue.length === 0 ? (
										<div className="p-8 text-center text-sm text-muted-foreground">
											Queue is empty
										</div>
									) : (
										<div className="divide-y">
											{queue.map((song, index) => (
												<QueueContextMenu
													key={`${song.id}-${index}`}
													song={song}
													index={index}
													isCurrentTrack={index === queueIndex}
													onRemove={() => removeFromQueue(index)}
												>
													<button
														type="button"
														onClick={() => playSong(song, queue, index)}
														className={cn(
															"w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left",
															index === queueIndex && "bg-primary/10",
														)}
													>
														<span
															className={cn(
																"w-5 text-xs text-muted-foreground text-center",
																index === queueIndex &&
																	"text-primary font-medium",
															)}
														>
															{index + 1}
														</span>
														<QueueItemCover song={song} />
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
												</QueueContextMenu>
											))}
										</div>
									)}
								</div>
							</div>
						)}

						{expandedTab === "lyrics" && (
							<LyricsPanel
								songId={currentTrack.id}
								songTitle={currentTrack.title}
								songArtist={currentTrack.artist ?? ""}
								currentTime={currentTime}
								onSeek={seek}
								onClose={() => setExpandedTab("queue")}
								showHeader={false}
							/>
						)}
					</div>
				</div>
			</div>
		</div>
	);

	// Desktop player - always render both, animate expanded
	const desktopPlayer = (
		<>
			{/* Collapsed player bar - hide when expanded */}
			<div
				className={cn(
					"border-t bg-card px-4 h-20 flex items-center gap-4 transition-all duration-300",
					isExpanded && "opacity-0 pointer-events-none",
				)}
				style={{ viewTransitionName: "player" }}
			>
				{/* Track info */}
				<div className="flex items-center gap-3 w-48 shrink-0 min-w-0 lg:w-auto lg:flex-1 lg:basis-0">
					<button
						type="button"
						onClick={() => setIsExpanded(true)}
						className="w-14 h-14 rounded-md overflow-hidden bg-muted flex-shrink-0 block hover:opacity-80 transition-opacity relative group"
						title="Expand player"
					>
						{coverUrl ? (
							<img
								src={coverUrl}
								alt={currentTrack.title}
								className={cn(
									"w-full h-full object-cover transition-opacity duration-200",
									coverLoaded ? "opacity-100" : "opacity-0",
								)}
								onLoad={() => setCoverLoaded(true)}
							/>
						) : (
							<div className="w-full h-full flex items-center justify-center">
								<Disc3 className="w-6 h-6 text-muted-foreground" />
							</div>
						)}
						<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
							<ChevronUp className="w-6 h-6 text-white" />
						</div>
					</button>
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
				</div>

				{/* Player controls */}
				<div className="flex flex-col items-center gap-1 flex-1 min-w-0 max-w-md lg:max-w-xl">
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

					{/* Progress bar */}
					<div className="w-full flex items-center gap-2">
						<span className="text-xs text-muted-foreground w-10 text-right">
							{formatTime(isSeeking ? seekValue : currentTime)}
						</span>
						<Slider
							value={[isSeeking ? seekValue : currentTime]}
							min={0}
							max={duration || 100}
							step={1}
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

				{/* Right side controls */}
				<div className="flex items-center justify-end gap-2 shrink-0 lg:flex-1 lg:basis-0">
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
						dropdownPosition="top"
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
					<div ref={volumeControlRef} className="flex items-center gap-1">
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
					<Button
						variant="ghost"
						size="icon"
						className="w-8 h-8"
						onClick={() => setIsExpanded(true)}
						title="Expand player"
					>
						<Maximize2 className="w-4 h-4" />
					</Button>
				</div>
			</div>

			{/* Expanded player overlay */}
			{expandedDesktopPlayer}
		</>
	);

	// Desktop drawers for queue and lyrics
	const desktopDrawers = (
		<>
			{/* Queue Drawer */}
			<Drawer open={showQueue} onOpenChange={setShowQueue} direction="right">
				<DrawerContent className="h-full w-[28rem] rounded-none">
					<div className="flex flex-col h-full">
						<div className="flex items-center justify-between px-4 py-3 border-b">
							<DrawerTitle className="font-semibold">
								Queue ({queue.length})
							</DrawerTitle>
							<div className="flex items-center gap-1">
								{queue.length > 1 && (
									<Button
										variant="ghost"
										size="icon"
										className="w-8 h-8"
										onClick={() => {
											const previousState = clearQueue();
											if (
												previousState &&
												previousState.previousQueue.length > 1
											) {
												toast.success("Queue cleared", {
													action: {
														label: "Undo",
														onClick: () => {
															restoreQueueState(previousState);
															toast.success("Queue restored");
														},
													},
												});
											}
										}}
										title="Clear queue"
									>
										<Trash2 className="w-4 h-4" />
									</Button>
								)}
							</div>
						</div>
						<div className="overflow-y-auto flex-1 scrollbar-thin">
							{queue.length === 0 ? (
								<div className="p-4 text-center text-sm text-muted-foreground">
									Queue is empty
								</div>
							) : (
								<div className="divide-y">
									{queue.map((song, index) => (
										<QueueContextMenu
											key={`${song.id}-${index}`}
											song={song}
											index={index}
											isCurrentTrack={index === queueIndex}
											onRemove={() => removeFromQueue(index)}
										>
											<button
												type="button"
												onClick={() => playSong(song, queue, index)}
												className={cn(
													"w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/50 transition-colors text-left",
													index === queueIndex && "bg-muted/30",
												)}
											>
												<span
													className={cn(
														"w-5 text-xs text-muted-foreground text-center",
														index === queueIndex && "text-primary font-medium",
													)}
												>
													{index + 1}
												</span>
												<QueueItemCover song={song} />
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
										</QueueContextMenu>
									))}
								</div>
							)}
						</div>
					</div>
				</DrawerContent>
			</Drawer>

			{/* Lyrics Drawer */}
			<Drawer open={showLyrics} onOpenChange={setShowLyrics} direction="right">
				<DrawerContent className="h-full w-[28rem] rounded-none">
					<div className="flex flex-col h-full">
						<div className="flex items-center justify-between px-4 py-3 border-b">
							<DrawerTitle className="font-semibold flex items-center gap-2">
								<FileText className="w-4 h-4" />
								Lyrics
							</DrawerTitle>
						</div>
						<div className="flex-1 overflow-hidden">
							<LyricsPanel
								songId={currentTrack.id}
								songTitle={currentTrack.title}
								songArtist={currentTrack.artist ?? ""}
								currentTime={currentTime}
								onSeek={seek}
								onClose={() => setShowLyrics(false)}
								showHeader={false}
							/>
						</div>
					</div>
				</DrawerContent>
			</Drawer>
		</>
	);

	return isMobile ? (
		mobilePlayer
	) : (
		<>
			{desktopPlayer}
			{!isExpanded && desktopDrawers}
		</>
	);
}
