import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import { useEffect, useState } from "react";

import type { Artist } from "@/lib/api";
import { getCoverArtUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ArtistCardProps {
	artist: Artist;
	className?: string;
}

export function ArtistCard({ artist, className }: ArtistCardProps) {
	const [coverUrl, setCoverUrl] = useState<string | null>(null);
	const [imageError, setImageError] = useState(false);

	useEffect(() => {
		if (artist.coverArt) {
			getCoverArtUrl(artist.coverArt, 300).then(setCoverUrl);
		}
	}, [artist.coverArt]);

	return (
		<Link
			to="/app/artists/$artistId"
			params={{ artistId: artist.id }}
			className={cn(
				"group block rounded-lg bg-card p-3 transition-colors hover:bg-accent",
				className,
			)}
		>
			{/* Artist Image */}
			<div className="aspect-square rounded-full overflow-hidden bg-muted mb-3">
				{coverUrl && !imageError ? (
					<img
						src={coverUrl}
						alt={artist.name}
						className="w-full h-full object-cover transition-transform group-hover:scale-105"
						onError={() => setImageError(true)}
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center">
						<User className="w-12 h-12 text-muted-foreground" />
					</div>
				)}
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
	);
}

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
