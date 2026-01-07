import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ArtistCard } from "@/components/ArtistCard";
import { Input } from "@/components/ui/input";
import type { Artist } from "@/lib/api";
import { getArtists } from "@/lib/api";

export const Route = createFileRoute("/app/artists/")({
	component: ArtistsPage,
});

const GAP = 16; // gap-4 = 1rem = 16px
const CARD_PADDING = 24; // p-3 top + bottom = 12px * 2
const CARD_COVER_MARGIN = 12; // mb-3 between cover and text
const TEXT_HEIGHT = 48; // Artist name + album count (slightly less than albums)

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
function getRowHeight(containerWidth: number, columnCount: number): number {
	const cardWidth = (containerWidth - GAP * (columnCount - 1)) / columnCount;
	const coverHeight = cardWidth - CARD_PADDING;
	return CARD_PADDING + coverHeight + CARD_COVER_MARGIN + TEXT_HEIGHT + GAP;
}

interface VirtualizedArtistGridProps {
	artists: Artist[];
}

function VirtualizedArtistGrid({ artists }: VirtualizedArtistGridProps) {
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

	// Group artists into rows
	const rows = useMemo(() => {
		const result: Artist[][] = [];
		for (let i = 0; i < artists.length; i += columnCount) {
			result.push(artists.slice(i, i + columnCount));
		}
		return result;
	}, [artists, columnCount]);

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

	if (artists.length === 0) {
		return (
			<div className="text-center py-12">
				<User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
				<p className="text-muted-foreground">No artists found</p>
			</div>
		);
	}

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
					const rowArtists = rows[virtualRow.index];
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
								{rowArtists.map((artist) => (
									<ArtistCard key={artist.id} artist={artist} />
								))}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function ArtistsSkeleton() {
	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
			{Array.from({ length: 12 }).map((_, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholder
					key={i}
					className="rounded-lg bg-card p-3 animate-pulse"
				>
					<div className="aspect-square rounded-full bg-muted mb-3" />
					<div className="h-4 bg-muted rounded w-3/4 mx-auto mb-2" />
					<div className="h-3 bg-muted rounded w-1/2 mx-auto" />
				</div>
			))}
		</div>
	);
}

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
			{isLoading ? (
				<ArtistsSkeleton />
			) : (
				<VirtualizedArtistGrid artists={filteredArtists} />
			)}
		</div>
	);
}
