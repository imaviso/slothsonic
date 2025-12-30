import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw, Shuffle } from "lucide-react";

import { SongList } from "@/components/SongList";
import { Button } from "@/components/ui/button";
import { getRandomSongs } from "@/lib/api";
import { playAlbum } from "@/lib/player";

export const Route = createFileRoute("/app/songs")({
	component: SongsPage,
});

function SongsPage() {
	const {
		data: songs,
		isLoading,
		refetch,
		isFetching,
	} = useQuery({
		queryKey: ["randomSongs"],
		queryFn: () => getRandomSongs(100),
		staleTime: 0, // Always refetch on mount (random songs should be fresh)
		gcTime: 5 * 60 * 1000, // 5 minutes
	});

	const handleShufflePlay = () => {
		if (songs && songs.length > 0) {
			const shuffled = [...songs].sort(() => Math.random() - 0.5);
			playAlbum(shuffled, 0);
		}
	};

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold text-foreground">Songs</h1>
					<p className="text-muted-foreground mt-1">
						Random songs from your library
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						onClick={() => refetch()}
						disabled={isFetching}
					>
						<RefreshCw
							className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
						/>
						Refresh
					</Button>
					<Button onClick={handleShufflePlay} disabled={!songs?.length}>
						<Shuffle className="w-4 h-4 mr-2" />
						Shuffle Play
					</Button>
				</div>
			</div>

			{/* Song List */}
			<SongList songs={songs ?? []} isLoading={isLoading} maxHeight="auto" />
		</div>
	);
}
