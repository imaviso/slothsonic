import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";
import { useState } from "react";

import { AlbumGrid } from "@/components/AlbumCard";
import { ArtistGrid } from "@/components/ArtistCard";
import { SongList } from "@/components/SongList";
import { Input } from "@/components/ui/input";
import { search } from "@/lib/api";

export const Route = createFileRoute("/app/search")({
	validateSearch: (searchParams: Record<string, unknown>) => {
		return {
			q: (searchParams.q as string) || "",
		};
	},
	component: SearchPage,
});

function SearchPage() {
	const { q } = Route.useSearch();
	const navigate = useNavigate();
	const [inputValue, setInputValue] = useState(q);

	const { data, isLoading, isFetching } = useQuery({
		queryKey: ["search", q],
		queryFn: () => search(q),
		enabled: q.length > 0,
	});

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		if (inputValue.trim()) {
			navigate({
				to: "/app/search",
				search: { q: inputValue.trim() },
			});
		}
	};

	const hasResults =
		data &&
		(data.artists.length > 0 ||
			data.albums.length > 0 ||
			data.songs.length > 0);

	return (
		<div className="p-6 space-y-6">
			{/* Search Header */}
			<div>
				<h1 className="text-3xl font-bold text-foreground mb-4">Search</h1>
				<form onSubmit={handleSearch} className="max-w-xl">
					<div className="relative">
						<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
						<Input
							type="search"
							placeholder="Search for artists, albums, or songs..."
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							className="pl-10 h-12 text-lg"
							autoFocus
						/>
					</div>
				</form>
			</div>

			{/* Loading */}
			{(isLoading || isFetching) && q && (
				<div className="text-center py-12">
					<div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
					<p className="text-muted-foreground mt-4">Searching...</p>
				</div>
			)}

			{/* No query */}
			{!q && (
				<div className="text-center py-12">
					<SearchIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
					<p className="text-muted-foreground">
						Enter a search term to find music
					</p>
				</div>
			)}

			{/* No results */}
			{q && !isLoading && !isFetching && !hasResults && (
				<div className="text-center py-12">
					<SearchIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
					<p className="text-muted-foreground">No results found for "{q}"</p>
				</div>
			)}

			{/* Results */}
			{hasResults && (
				<div className="space-y-8">
					{/* Artists */}
					{data.artists.length > 0 && (
						<section>
							<h2 className="text-xl font-semibold text-foreground mb-4">
								Artists ({data.artists.length})
							</h2>
							<ArtistGrid artists={data.artists.slice(0, 6)} />
						</section>
					)}

					{/* Albums */}
					{data.albums.length > 0 && (
						<section>
							<h2 className="text-xl font-semibold text-foreground mb-4">
								Albums ({data.albums.length})
							</h2>
							<AlbumGrid albums={data.albums.slice(0, 6)} />
						</section>
					)}

					{/* Songs */}
					{data.songs.length > 0 && (
						<section>
							<h2 className="text-xl font-semibold text-foreground mb-4">
								Songs ({data.songs.length})
							</h2>
							<SongList songs={data.songs} showHeader />
						</section>
					)}
				</div>
			)}
		</div>
	);
}
