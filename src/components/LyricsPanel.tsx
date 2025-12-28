import { useQuery } from "@tanstack/react-query";
import { FileText, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { getLyrics, getLyricsBySongId, type StructuredLyrics } from "@/lib/api";
import { cn } from "@/lib/utils";

interface LyricsPanelProps {
	songId?: string;
	songTitle: string;
	songArtist: string;
	currentTime?: number; // Current playback time in seconds
	onClose: () => void;
	showHeader?: boolean;
	onSeek?: (time: number) => void; // Callback to seek to a specific time
}

// Component for synced lyrics with animation
function SyncedLyrics({
	lyrics,
	currentTime,
	onSeek,
}: {
	lyrics: StructuredLyrics;
	currentTime: number;
	onSeek?: (time: number) => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const activeLineRef = useRef<HTMLButtonElement>(null);

	// Find the current line based on playback time
	const currentTimeMs = currentTime * 1000;
	let currentLineIndex = -1;

	for (let i = 0; i < lyrics.line.length; i++) {
		const line = lyrics.line[i];
		const nextLine = lyrics.line[i + 1];

		if (line.start === undefined) continue;

		const lineStart = line.start + (lyrics.offset ?? 0);
		const lineEnd = nextLine?.start
			? nextLine.start + (lyrics.offset ?? 0)
			: Number.POSITIVE_INFINITY;

		if (currentTimeMs >= lineStart && currentTimeMs < lineEnd) {
			currentLineIndex = i;
			break;
		}
	}

	// Auto-scroll to keep the active line centered
	// biome-ignore lint/correctness/useExhaustiveDependencies: currentLineIndex is derived from currentTime but we need to trigger scroll when line changes
	useEffect(() => {
		if (activeLineRef.current && containerRef.current) {
			const container = containerRef.current;
			const activeLine = activeLineRef.current;

			const containerHeight = container.clientHeight;
			const lineTop = activeLine.offsetTop;
			const lineHeight = activeLine.clientHeight;

			// Scroll to center the active line
			const scrollTo = lineTop - containerHeight / 2 + lineHeight / 2;

			container.scrollTo({
				top: scrollTo,
				behavior: "smooth",
			});
		}
	}, [currentLineIndex]);

	const handleLineClick = (startTime: number | undefined) => {
		if (startTime !== undefined && onSeek) {
			// Convert milliseconds to seconds and account for offset
			const seekTime = (startTime + (lyrics.offset ?? 0)) / 1000;
			onSeek(seekTime);
		}
	};

	return (
		<div
			ref={containerRef}
			className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin py-8"
		>
			<div className="space-y-4 px-4">
				{lyrics.line.map((line, index) => {
					const isActive = index === currentLineIndex;
					const isPast = currentLineIndex > -1 && index < currentLineIndex;
					const hasTimestamp = line.start !== undefined;

					return (
						<button
							key={`${line.start}-${index}`}
							ref={isActive ? activeLineRef : null}
							type="button"
							onClick={() => handleLineClick(line.start)}
							disabled={!hasTimestamp || !onSeek}
							className={cn(
								"block w-full text-left transition-all duration-300 ease-out",
								hasTimestamp && onSeek && "cursor-pointer hover:opacity-80",
								!hasTimestamp && "cursor-default",
								isActive
									? "text-primary text-xl font-bold"
									: isPast
										? "text-muted-foreground/50 text-base"
										: "text-foreground/70 text-base",
							)}
						>
							{line.value || <span className="opacity-0">♪</span>}
						</button>
					);
				})}
			</div>
		</div>
	);
}

// Component for static (unsynced) lyrics
function StaticLyrics({ text }: { text: string }) {
	return (
		<div className="flex-1 overflow-y-auto scrollbar-thin">
			<p className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
				{text}
			</p>
		</div>
	);
}

export function LyricsPanel({
	songId,
	songTitle,
	songArtist,
	currentTime = 0,
	onClose,
	showHeader = true,
	onSeek,
}: LyricsPanelProps) {
	// Try getLyricsBySongId first (OpenSubsonic extension)
	const {
		data: structuredLyrics,
		isLoading: isLoadingById,
		isError: isErrorById,
	} = useQuery({
		queryKey: ["lyricsBySongId", songId],
		queryFn: () => getLyricsBySongId(songId as string),
		enabled: !!songId,
	});

	// Fall back to getLyrics (standard Subsonic API) if getLyricsBySongId fails or returns empty
	const shouldFallback =
		!songId ||
		isErrorById ||
		(structuredLyrics?.length === 0 && !isLoadingById);

	const { data: lyrics, isLoading: isLoadingByTitle } = useQuery({
		queryKey: ["lyrics", songArtist, songTitle],
		queryFn: () => getLyrics(songArtist, songTitle),
		enabled: shouldFallback && !!songArtist && !!songTitle,
	});

	const isLoading = isLoadingById || (shouldFallback && isLoadingByTitle);

	// Determine which lyrics to display and how
	let syncedLyrics: StructuredLyrics | null = null;
	let staticLyricsText: string | undefined;

	if (structuredLyrics && structuredLyrics.length > 0) {
		// Prefer synced lyrics if available
		const synced = structuredLyrics.find((l) => l.synced);
		if (synced) {
			syncedLyrics = synced;
		} else {
			// Use unsynced structured lyrics as static text
			const unsynced = structuredLyrics[0];
			staticLyricsText = unsynced.line.map((l) => l.value).join("\n");
		}
	} else if (lyrics) {
		// Use lyrics from getLyrics
		staticLyricsText = lyrics.value ?? lyrics.lyrics?.[0]?.value;
	}

	const hasLyrics = syncedLyrics || staticLyricsText;

	return (
		<div className="p-6 space-y-4 h-full flex flex-col">
			{showHeader && (
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<FileText className="w-5 h-5" />
						<h2 className="font-semibold">Lyrics</h2>
					</div>
					<Button
						variant="ghost"
						size="icon"
						className="w-8 h-8"
						onClick={onClose}
					>
						<X className="w-4 h-4" />
					</Button>
				</div>
			)}

			{isLoading ? (
				<div className="animate-pulse space-y-3 flex-1">
					<div className="h-4 bg-muted rounded w-3/4" />
					<div className="h-4 bg-muted rounded w-1/2" />
					<div className="h-4 bg-muted rounded w-2/3" />
					<div className="h-4 bg-muted rounded w-full" />
					<div className="h-4 bg-muted rounded w-1/2" />
				</div>
			) : !hasLyrics ? (
				<p className="text-sm text-muted-foreground">
					No lyrics available for this song
				</p>
			) : syncedLyrics ? (
				<SyncedLyrics
					lyrics={syncedLyrics}
					currentTime={currentTime}
					onSeek={onSeek}
				/>
			) : (
				<StaticLyrics text={staticLyricsText ?? ""} />
			)}
		</div>
	);
}
