import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Music, Tags } from "lucide-react";
import { useState } from "react";

import { GenreContextMenu } from "@/components/GenreContextMenu";
import { Input } from "@/components/ui/input";
import { getGenres } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/genres/")({
	component: GenresPage,
});

function GenresPage() {
	const [filter, setFilter] = useState("");

	const { data: genres, isLoading } = useQuery({
		queryKey: ["genres"],
		queryFn: getGenres,
		staleTime: 10 * 60 * 1000, // 10 minutes - genres rarely change
		gcTime: 60 * 60 * 1000, // 1 hour
	});

	const filteredGenres =
		genres?.filter((genre) =>
			genre.value.toLowerCase().includes(filter.toLowerCase()),
		) ?? [];

	// Sort by song count descending
	const sortedGenres = [...filteredGenres].sort(
		(a, b) => b.songCount - a.songCount,
	);

	return (
		<div className="p-6 space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-foreground">Genres</h1>
					<p className="text-muted-foreground">
						{genres?.length ?? 0} genre{genres?.length !== 1 ? "s" : ""}
					</p>
				</div>
				<Input
					type="search"
					placeholder="Filter genres..."
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					className="max-w-xs"
				/>
			</div>

			{isLoading ? (
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
					{Array.from({ length: 12 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholder
							key={i}
							className="rounded-lg bg-card p-4 animate-pulse"
						>
							<div className="aspect-square rounded-md bg-muted mb-3 flex items-center justify-center">
								<Tags className="w-8 h-8 text-muted-foreground/30" />
							</div>
							<div className="h-4 bg-muted rounded w-3/4 mb-2" />
							<div className="h-3 bg-muted rounded w-1/2" />
						</div>
					))}
				</div>
			) : sortedGenres.length === 0 ? (
				<div className="text-center py-12">
					<Tags className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
					<p className="text-muted-foreground">
						{filter ? "No genres match your filter" : "No genres found"}
					</p>
				</div>
			) : (
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
					{sortedGenres.map((genre) => (
						<GenreCard key={genre.value} genre={genre} />
					))}
				</div>
			)}
		</div>
	);
}

interface GenreCardProps {
	genre: {
		value: string;
		songCount: number;
		albumCount: number;
	};
}

function GenreCard({ genre }: GenreCardProps) {
	// Generate a consistent color based on genre name
	const hue =
		genre.value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
		360;

	return (
		<GenreContextMenu genreName={genre.value}>
			<Link
				to="/app/genres/$genreName"
				params={{ genreName: encodeURIComponent(genre.value) }}
				className={cn(
					"group block rounded-lg bg-card p-4 transition-colors hover:bg-accent",
				)}
			>
				{/* Genre icon with colored background */}
				<div
					className="aspect-square rounded-md mb-3 flex items-center justify-center transition-transform group-hover:scale-105"
					style={{
						background: `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${(hue + 40) % 360}, 70%, 40%))`,
					}}
				>
					<Music className="w-10 h-10 text-white drop-shadow-md" />
				</div>

				{/* Genre info */}
				<div className="space-y-1">
					<h3 className="font-medium text-sm text-foreground truncate group-hover:text-primary">
						{genre.value}
					</h3>
					<p className="text-xs text-muted-foreground">
						{genre.songCount} song{genre.songCount !== 1 ? "s" : ""}
					</p>
				</div>
			</Link>
		</GenreContextMenu>
	);
}
