import { useQuery } from "@tanstack/react-query";
import { FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getLyrics } from "@/lib/api";

interface LyricsPanelProps {
	songTitle: string;
	songArtist: string;
	onClose: () => void;
	showHeader?: boolean;
}

export function LyricsPanel({
	songTitle,
	songArtist,
	onClose,
	showHeader = true,
}: LyricsPanelProps) {
	const { data: lyrics, isLoading } = useQuery({
		queryKey: ["lyrics", songArtist, songTitle],
		queryFn: () => getLyrics(songArtist, songTitle),
		enabled: !!songArtist && !!songTitle,
	});

	const lyricsText = lyrics?.value ?? lyrics?.lyrics?.[0]?.value;

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
