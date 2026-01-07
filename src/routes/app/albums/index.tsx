import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AlbumCard } from "@/components/AlbumCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Album, AlbumListType } from "@/lib/api";
import { getAlbumList, search } from "@/lib/api";
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
const GAP = 16; // gap-4 = 1rem = 16px
const CARD_PADDING = 24; // p-3 top + bottom = 12px * 2
const CARD_COVER_MARGIN = 12; // mb-3 between cover and text
const TEXT_HEIGHT = 60; // Approximate height of title + artist + year

// Breakpoints matching Tailwind's responsive prefixes
const BREAKPOINTS = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
};

function getColumnCount(width: number): number {
	if (width >= BREAKPOINTS.xl) return 6;
	if (width >= BREAKPOINTS.lg) return 5;
	if (width >= BREAKPOINTS.md) return 4;
	if (width >= BREAKPOINTS.sm) return 3;
	return 2;
}

// Calculate row height based on container width and column count
// Card height = padding + aspect-square cover + margin + text + gap
function getRowHeight(containerWidth: number, columnCount: number): number {
	const cardWidth = (containerWidth - GAP * (columnCount - 1)) / columnCount;
	const coverHeight = cardWidth - CARD_PADDING; // Cover is square, minus horizontal padding
	return CARD_PADDING + coverHeight + CARD_COVER_MARGIN + TEXT_HEIGHT + GAP;
}

interface VirtualizedAlbumGridProps {
	albums: Album[];
	onLoadMore?: () => void;
	hasNextPage?: boolean;
	isFetchingNextPage?: boolean;
}

function VirtualizedAlbumGrid({
	albums,
	onLoadMore,
	hasNextPage,
	isFetchingNextPage,
}: VirtualizedAlbumGridProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [columnCount, setColumnCount] = useState(6);
	const [containerWidth, setContainerWidth] = useState(1200);

	// Track container width to determine column count and row height
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const updateDimensions = () => {
			const width = container.offsetWidth;
			setContainerWidth(width);
			setColumnCount(getColumnCount(width));
		};

		updateDimensions();

		const resizeObserver = new ResizeObserver(updateDimensions);
		resizeObserver.observe(container);

		return () => resizeObserver.disconnect();
	}, []);

	const rowHeight = useMemo(
		() => getRowHeight(containerWidth, columnCount),
		[containerWidth, columnCount],
	);

	// Group albums into rows
	const rows = useMemo(() => {
		const result: Album[][] = [];
		for (let i = 0; i < albums.length; i += columnCount) {
			result.push(albums.slice(i, i + columnCount));
		}
		return result;
	}, [albums, columnCount]);

	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => containerRef.current,
		estimateSize: () => rowHeight,
		overscan: 3,
	});

	// Recalculate virtual items when row height changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: rowHeight change should trigger remeasure
	useEffect(() => {
		virtualizer.measure();
	}, [rowHeight]);

	// Trigger load more when scrolling near the bottom
	useEffect(() => {
		const container = containerRef.current;
		if (!container || !onLoadMore || !hasNextPage || isFetchingNextPage) return;

		const handleScroll = () => {
			const { scrollTop, scrollHeight, clientHeight } = container;
			// Load more when within 200px of bottom
			if (scrollHeight - scrollTop - clientHeight < 200) {
				onLoadMore();
			}
		};

		container.addEventListener("scroll", handleScroll, { passive: true });
		return () => container.removeEventListener("scroll", handleScroll);
	}, [onLoadMore, hasNextPage, isFetchingNextPage]);

	return (
		<div
			ref={containerRef}
			className="h-[calc(100vh-280px)] overflow-auto"
			style={{ contain: "strict" }}
		>
			<div
				style={{
					height: virtualizer.getTotalSize(),
					width: "100%",
					position: "relative",
				}}
			>
				{virtualizer.getVirtualItems().map((virtualRow) => {
					const rowAlbums = rows[virtualRow.index];
					return (
						<div
							key={virtualRow.key}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								height: virtualRow.size,
								transform: `translateY(${virtualRow.start}px)`,
							}}
						>
							<div
								className="grid gap-4"
								style={{
									gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
								}}
							>
								{rowAlbums.map((album) => (
									<AlbumCard key={album.id} album={album} />
								))}
							</div>
						</div>
					);
				})}
			</div>
			{/* Load more indicator at bottom */}
			{isFetchingNextPage && (
				<div className="flex justify-center py-4">
					<div className="flex items-center gap-2 text-muted-foreground">
						<Loader2 className="w-4 h-4 animate-spin" />
						<span>Loading more...</span>
					</div>
				</div>
			)}
			{!hasNextPage && albums.length > 0 && (
				<div className="flex justify-center py-4">
					<span className="text-muted-foreground text-sm">
						All {albums.length} albums loaded
					</span>
				</div>
			)}
		</div>
	);
}

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

	const isSearching = debouncedSearch.trim().length > 0;

	// Server-side search query
	const { data: searchResults, isLoading: isSearchLoading } = useQuery({
		queryKey: ["search", "albums", debouncedSearch],
		queryFn: () => search(debouncedSearch),
		enabled: isSearching,
		staleTime: 2 * 60 * 1000, // 2 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
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
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 30 * 60 * 1000, // 30 minutes
	});

	// Flatten all pages into a single array
	const allAlbums = useMemo(() => {
		return data?.pages.flat() ?? [];
	}, [data?.pages]);

	// Use search results or browse results
	const displayAlbums = isSearching ? (searchResults?.albums ?? []) : allAlbums;

	const isLoading = isSearching ? isSearchLoading : isBrowseLoading;

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
				<VirtualizedAlbumGrid
					albums={displayAlbums}
					onLoadMore={isSearching ? undefined : fetchNextPage}
					hasNextPage={isSearching ? false : hasNextPage}
					isFetchingNextPage={isFetchingNextPage}
				/>
			)}
		</div>
	);
}
