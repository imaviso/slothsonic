import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ArtistGrid } from "@/components/ArtistCard";
import { Input } from "@/components/ui/input";
import { getArtists } from "@/lib/api";

export const Route = createFileRoute("/app/artists/")({
	component: ArtistsPage,
});

function ArtistsPage() {
	const [filter, setFilter] = useState("");

	const { data: artists, isLoading } = useQuery({
		queryKey: ["artists"],
		queryFn: getArtists,
		staleTime: 10 * 60 * 1000, // 10 minutes - artist list rarely changes
		gcTime: 60 * 60 * 1000, // 1 hour
	});

	const filteredArtists =
		artists?.filter((artist) =>
			artist.name.toLowerCase().includes(filter.toLowerCase()),
		) ?? [];

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold text-foreground">Artists</h1>
					<p className="text-muted-foreground mt-1">
						{artists?.length ?? 0} artists in your library
					</p>
				</div>
				<Input
					type="search"
					placeholder="Filter artists..."
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					className="sm:w-64"
				/>
			</div>

			{/* Artist Grid */}
			<ArtistGrid artists={filteredArtists} isLoading={isLoading} />
		</div>
	);
}
