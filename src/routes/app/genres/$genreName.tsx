import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Music, Play, Shuffle, Tags } from "lucide-react";
import { useEffect, useRef } from "react";

import { SongList } from "@/components/SongList";
import { Button } from "@/components/ui/button";
import { getSongsByGenre } from "@/lib/api";
import { playAlbum } from "@/lib/player";

export const Route = createFileRoute("/app/genres/$genreName")({
	component: GenreDetailPage,
});

function GenreDetailPage() {
	const { genreName } = Route.useParams();
	const decodedGenreName = decodeURIComponent(genreName);
	const loadMoreRef = useRef<HTMLDivElement>(null);

	const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
		useInfiniteQuery({
			queryKey: ["genre-songs", decodedGenreName],
			queryFn: ({ pageParam = 0 }) =>
				getSongsByGenre(decodedGenreName, 50, pageParam),
			getNextPageParam: (lastPage, allPages) => {
				if (lastPage.length < 50) return undefined;
				return allPages.length * 50;
			},
			initialPageParam: 0,
			staleTime: 5 * 60 * 1000, // 5 minutes
			gcTime: 30 * 60 * 1000, // 30 minutes
		});

	const songs = data?.pages.flat() ?? [];

	// Intersection observer for infinite scroll
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
					fetchNextPage();
				}
			},
			{ threshold: 0.1 },
		);

		const currentRef = loadMoreRef.current;
		if (currentRef) {
			observer.observe(currentRef);
		}

		return () => {
			if (currentRef) {
				observer.unobserve(currentRef);
			}
		};
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	// Generate a consistent color based on genre name
	const hue =
		decodedGenreName
			.split("")
			.reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;

	const handlePlayAll = () => {
		if (songs.length > 0) {
			playAlbum(songs, 0);
		}
	};

	const handleShufflePlay = () => {
		if (songs.length > 0) {
			const shuffled = [...songs].sort(() => Math.random() - 0.5);
			playAlbum(shuffled, 0);
		}
	};

	return (
		<div className="p-6 space-y-6">
			{/* Back button */}
			<Link
				to="/app/genres"
				className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				<ArrowLeft className="w-4 h-4" />
				Back to Genres
			</Link>

			{/* Genre header */}
			<div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
				{/* Genre icon */}
				<div
					className="w-32 h-32 sm:w-48 sm:h-48 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg"
					style={{
						background: `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${(hue + 40) % 360}, 70%, 40%))`,
					}}
				>
					<Music className="w-16 h-16 sm:w-24 sm:h-24 text-white drop-shadow-md" />
				</div>

				{/* Genre info */}
				<div className="flex flex-col justify-end space-y-2 text-center sm:text-left items-center sm:items-start">
					<p className="text-sm text-muted-foreground uppercase tracking-wide">
						Genre
					</p>
					<h1 className="text-2xl sm:text-4xl font-bold text-foreground">
						{decodedGenreName}
					</h1>
					<p className="text-muted-foreground">
						{songs.length} song{songs.length !== 1 ? "s" : ""}
						{hasNextPage && "+"}
					</p>
					<div className="pt-4 flex items-center gap-3">
						<Button
							size="lg"
							className="gap-2"
							onClick={handlePlayAll}
							disabled={songs.length === 0}
						>
							<Play className="w-5 h-5" />
							Play All
						</Button>
						<Button
							variant="outline"
							size="lg"
							className="gap-2"
							onClick={handleShufflePlay}
							disabled={songs.length === 0}
						>
							<Shuffle className="w-5 h-5" />
							Shuffle
						</Button>
					</div>
				</div>
			</div>

			{/* Songs list */}
			{isLoading ? (
				<SongList songs={[]} isLoading />
			) : songs.length === 0 ? (
				<div className="text-center py-12">
					<Tags className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
					<p className="text-muted-foreground">No songs in this genre</p>
				</div>
			) : (
				<>
					<SongList songs={songs} showAlbum showArtist maxHeight={500} />

					{/* Load more trigger */}
					<div
						ref={loadMoreRef}
						className="h-10 flex items-center justify-center"
					>
						{isFetchingNextPage && (
							<p className="text-sm text-muted-foreground">Loading more...</p>
						)}
					</div>
				</>
			)}
		</div>
	);
}
