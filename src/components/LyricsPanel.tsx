import { useQuery } from "@tanstack/react-query";
import { FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getLyrics, getLyricsBySongId } from "@/lib/api";

interface LyricsPanelProps {
	songId?: string;
	songTitle: string;
	songArtist: string;
	onClose: () => void;
	showHeader?: boolean;
}

export function LyricsPanel({
	songId,
	songTitle,
	songArtist,
	onClose,
	showHeader = true,
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

	// Extract lyrics text from either API response
	let lyricsText: string | undefined;

	if (structuredLyrics && structuredLyrics.length > 0) {
		// Use structured lyrics from getLyricsBySongId
		// Prefer unsynced lyrics, or use the first available
		const preferredLyrics =
			structuredLyrics.find((l) => !l.synced) ?? structuredLyrics[0];
		lyricsText = preferredLyrics.line.map((l) => l.value).join("\n");
	} else if (lyrics) {
		// Use lyrics from getLyrics
		lyricsText = lyrics.value ?? lyrics.lyrics?.[0]?.value;
	}

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
				<div className="animate-pulse space-y-3">
					<div className="h-4 bg-muted rounded w-3/4" />
					<div className="h-4 bg-muted rounded w-1/2" />
					<div className="h-4 bg-muted rounded w-2/3" />
					<div className="h-4 bg-muted rounded w-full" />
					<div className="h-4 bg-muted rounded w-1/2" />
				</div>
			) : !lyricsText ? (
				<p className="text-sm text-muted-foreground">
					No lyrics available for this song
				</p>
			) : (
				<div className="prose prose-sm dark:prose-invert flex-1 overflow-y-auto scrollbar-thin">
					<p className="whitespace-pre-wrap">{lyricsText}</p>
				</div>
			)}
		</div>
	);
}
