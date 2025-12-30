import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Disc3 } from "lucide-react";
import { memo, useCallback, useState } from "react";

import { useCoverArt } from "@/hooks/use-cover-art";
import type { Album } from "@/lib/api";
import { getAlbum } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AlbumContextMenu } from "./AlbumContextMenu";
import { StarButton } from "./StarButton";

interface AlbumCardProps {
	album: Album;
	className?: string;
}

export const AlbumCard = memo(
	function AlbumCard({ album, className }: AlbumCardProps) {
		const { data: coverUrl } = useCoverArt(album.coverArt, 300);
		const [imageError, setImageError] = useState(false);
		const [imageLoaded, setImageLoaded] = useState(false);
		const queryClient = useQueryClient();

		// Prefetch album details on hover
		const handleMouseEnter = useCallback(() => {
			queryClient.prefetchQuery({
				queryKey: ["album", album.id],
				queryFn: () => getAlbum(album.id),
				staleTime: 10 * 60 * 1000, // 10 minutes
			});
		}, [queryClient, album.id]);

		return (
			<AlbumContextMenu album={album}>
				<Link
					to="/app/albums/$albumId"
					params={{ albumId: album.id }}
					onMouseEnter={handleMouseEnter}
					className={cn(
						"group block rounded-lg bg-card p-3 transition-colors hover:bg-accent",
						className,
					)}
				>
					{/* Album Cover */}
					<div className="aspect-square rounded-md overflow-hidden bg-muted mb-3 relative">
						{coverUrl && !imageError ? (
							<img
								src={coverUrl}
								alt={album.name}
								loading="lazy"
								className={cn(
									"w-full h-full object-cover transition-all duration-200 group-hover:scale-105",
									imageLoaded ? "opacity-100" : "opacity-0",
								)}
								onLoad={() => setImageLoaded(true)}
								onError={() => setImageError(true)}
							/>
						) : (
							<div className="w-full h-full flex items-center justify-center">
								<Disc3 className="w-12 h-12 text-muted-foreground" />
							</div>
						)}
						{/* Star button overlay */}
						<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
							<StarButton
								id={album.id}
								type="album"
								isStarred={!!album.starred}
								size="sm"
							/>
						</div>
					</div>

					{/* Album Info */}
					<div className="space-y-1">
						<h3 className="font-medium text-sm text-foreground truncate group-hover:text-primary">
							{album.name}
						</h3>
						{album.artist && (
							<p className="text-xs text-muted-foreground truncate">
								{album.artist}
							</p>
						)}
						{album.year && (
							<p className="text-xs text-muted-foreground">{album.year}</p>
						)}
					</div>
				</Link>
			</AlbumContextMenu>
		);
	},
	(prevProps, nextProps) => {
		return (
			prevProps.album.id === nextProps.album.id &&
			prevProps.album.starred === nextProps.album.starred &&
			prevProps.album.name === nextProps.album.name &&
			prevProps.album.coverArt === nextProps.album.coverArt &&
			prevProps.className === nextProps.className
		);
	},
);

interface AlbumGridProps {
	albums: Album[];
	isLoading?: boolean;
}

export function AlbumGrid({ albums, isLoading }: AlbumGridProps) {
	if (isLoading) {
		return (
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
		);
	}

	if (albums.length === 0) {
		return (
			<div className="text-center py-12">
				<Disc3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
				<p className="text-muted-foreground">No albums found</p>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
			{albums.map((album) => (
				<AlbumCard key={album.id} album={album} />
			))}
		</div>
	);
}
