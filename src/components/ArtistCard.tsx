import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import { memo, useCallback, useState } from "react";

import { useCoverArt } from "@/hooks/use-cover-art";
import type { Artist } from "@/lib/api";
import { getArtist } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ArtistContextMenu } from "./ArtistContextMenu";
import { StarButton } from "./StarButton";

interface ArtistCardProps {
	artist: Artist;
	className?: string;
}

export const ArtistCard = memo(
	function ArtistCard({ artist, className }: ArtistCardProps) {
		const { data: coverUrl } = useCoverArt(artist.coverArt, 300);
		const [imageError, setImageError] = useState(false);
		const [imageLoaded, setImageLoaded] = useState(false);
		const queryClient = useQueryClient();

		// Prefetch artist details on hover
		const handleMouseEnter = useCallback(() => {
			queryClient.prefetchQuery({
				queryKey: ["artist", artist.id],
				queryFn: () => getArtist(artist.id),
				staleTime: 10 * 60 * 1000, // 10 minutes
			});
		}, [queryClient, artist.id]);

		return (
			<ArtistContextMenu artist={artist}>
				<Link
					to="/app/artists/$artistId"
					params={{ artistId: artist.id }}
					onMouseEnter={handleMouseEnter}
					className={cn(
						"group block rounded-lg bg-card p-3 transition-colors hover:bg-accent",
						className,
					)}
				>
					{/* Artist Image */}
					<div className="aspect-square rounded-full overflow-hidden bg-muted mb-3 relative">
						{coverUrl && !imageError ? (
							<img
								src={coverUrl}
								alt={artist.name}
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
								<User className="w-12 h-12 text-muted-foreground" />
							</div>
						)}
						{/* Star button overlay */}
						<div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
							<StarButton
								id={artist.id}
								type="artist"
								isStarred={!!artist.starred}
								size="sm"
							/>
						</div>
					</div>

					{/* Artist Info */}
					<div className="text-center">
						<h3 className="font-medium text-sm text-foreground truncate group-hover:text-primary">
							{artist.name}
						</h3>
						{artist.albumCount !== undefined && (
							<p className="text-xs text-muted-foreground">
								{artist.albumCount} album{artist.albumCount !== 1 ? "s" : ""}
							</p>
						)}
					</div>
				</Link>
			</ArtistContextMenu>
		);
	},
	(prevProps, nextProps) => {
		return (
			prevProps.artist.id === nextProps.artist.id &&
			prevProps.artist.starred === nextProps.artist.starred &&
			prevProps.artist.name === nextProps.artist.name &&
			prevProps.artist.coverArt === nextProps.artist.coverArt &&
			prevProps.artist.albumCount === nextProps.artist.albumCount &&
			prevProps.className === nextProps.className
		);
	},
);

interface ArtistGridProps {
	artists: Artist[];
	isLoading?: boolean;
}

export function ArtistGrid({ artists, isLoading }: ArtistGridProps) {
	if (isLoading) {
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

	if (artists.length === 0) {
		return (
			<div className="text-center py-12">
				<User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
				<p className="text-muted-foreground">No artists found</p>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
			{artists.map((artist) => (
				<ArtistCard key={artist.id} artist={artist} />
			))}
		</div>
	);
}
