import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AlbumCard } from "@/components/AlbumCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type AlbumListType, getAlbumList, search } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/albums/")({
	component: AlbumsPage,
});

const sortOptions: { value: AlbumListType; label: string }[] = [
	{ value: "newest", label: "Newest" },
	{ value: "random", label: "Random" },
	{ value: "frequent", label: "Most Played" },
	{ value: "recent", label: "Recently Played" },
	{ value: "alphabeticalByName", label: "A-Z (Album)" },
	{ value: "alphabeticalByArtist", label: "A-Z (Artist)" },
];

const PAGE_SIZE = 50;

function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState(value);

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedValue(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);

	return debouncedValue;
}

function AlbumsPage() {
	const [sortType, setSortType] = useState<AlbumListType>("newest");
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedSearch = useDebounce(searchQuery, 300);
	const loadMoreRef = useRef<HTMLDivElement>(null);

	const isSearching = debouncedSearch.trim().length > 0;

	// Server-side search query
	const { data: searchResults, isLoading: isSearchLoading } = useQuery({
		queryKey: ["search", "albums", debouncedSearch],
		queryFn: () => search(debouncedSearch),
		enabled: isSearching,
	});

	// Infinite scroll for browsing albums
	const {
		data,
		isLoading: isBrowseLoading,
		isFetchingNextPage,
		hasNextPage,
		fetchNextPage,
	} = useInfiniteQuery({
		queryKey: ["albums", sortType, "infinite"],
		queryFn: ({ pageParam = 0 }) =>
			getAlbumList(sortType, PAGE_SIZE, pageParam),
		getNextPageParam: (lastPage, allPages) => {
			if (lastPage.length < PAGE_SIZE) {
				return undefined;
			}
			return allPages.length * PAGE_SIZE;
		},
		initialPageParam: 0,
		enabled: !isSearching,
	});

	// Flatten all pages into a single array
	const allAlbums = useMemo(() => {
		return data?.pages.flat() ?? [];
	}, [data?.pages]);

	// Use search results or browse results
	const displayAlbums = isSearching ? (searchResults?.albums ?? []) : allAlbums;

	const isLoading = isSearching ? isSearchLoading : isBrowseLoading;

	// Intersection Observer for infinite scrolling
	const handleObserver = useCallback(
		(entries: IntersectionObserverEntry[]) => {
			const [target] = entries;
			if (
				target.isIntersecting &&
				hasNextPage &&
				!isFetchingNextPage &&
				!isSearching
			) {
				fetchNextPage();
			}
		},
		[fetchNextPage, hasNextPage, isFetchingNextPage, isSearching],
	);

	useEffect(() => {
		const element = loadMoreRef.current;
		if (!element) return;

		const observer = new IntersectionObserver(handleObserver, {
			root: null,
			rootMargin: "100px",
			threshold: 0,
		});

		observer.observe(element);

		return () => observer.disconnect();
	}, [handleObserver]);

	return (
		<div className="p-6 space-y-6">
			{/* Header with search */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold text-foreground">Albums</h1>
					<p className="text-muted-foreground mt-1">
						{isSearching
							? `${displayAlbums.length} result${displayAlbums.length !== 1 ? "s" : ""} for "${debouncedSearch}"`
							: `${allAlbums.length}${hasNextPage ? "+" : ""} albums in your library`}
					</p>
				</div>
				<Input
					type="search"
					placeholder="Search albums..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="sm:w-64"
				/>
			</div>

			{/* Sort options - only show when not searching */}
			{!isSearching && (
				<div className="flex flex-wrap gap-2">
					{sortOptions.map((option) => (
						<Button
							key={option.value}
							variant={sortType === option.value ? "default" : "outline"}
							size="sm"
							onClick={() => setSortType(option.value)}
							className={cn(sortType === option.value && "pointer-events-none")}
						>
							{option.label}
						</Button>
					))}
				</div>
			)}

			{/* Album Grid */}
			{isLoading ? (
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
					{Array.from({ length: 12 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholder
							key={i}
							className="rounded-lg bg-card p-3 animate-pulse"
						>
							<div className="aspect-square rounded-md bg-muted mb-3" />
							<div className="h-4 bg-muted rounded w-3/4 mb-2" />
							<div className="h-3 bg-muted rounded w-1/2" />
						</div>
					))}
				</div>
			) : displayAlbums.length === 0 ? (
				<div className="text-center py-12">
					<p className="text-muted-foreground">
						{isSearching ? "No albums match your search" : "No albums found"}
					</p>
				</div>
			) : (
				<>
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
						{displayAlbums.map((album) => (
							<AlbumCard key={album.id} album={album} />
						))}
					</div>

					{/* Load more trigger - only for browsing, not search */}
					{!isSearching && (
						<div ref={loadMoreRef} className="flex justify-center py-4">
							{isFetchingNextPage ? (
								<div className="flex items-center gap-2 text-muted-foreground">
									<Loader2 className="w-4 h-4 animate-spin" />
									<span>Loading more...</span>
								</div>
							) : hasNextPage ? (
								<span className="text-muted-foreground text-sm">
									Scroll for more
								</span>
							) : allAlbums.length > 0 ? (
								<span className="text-muted-foreground text-sm">
									All {allAlbums.length} albums loaded
								</span>
							) : null}
						</div>
					)}
				</>
			)}
		</div>
	);
}
