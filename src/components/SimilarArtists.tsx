import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { ArtistCard } from "@/components/ArtistCard";
import { type Artist, getSimilarArtists } from "@/lib/api";

interface SimilarArtistsProps {
	artistId?: string;
}

export function SimilarArtists({ artistId }: SimilarArtistsProps) {
	const { data: artists, isLoading } = useQuery({
		queryKey: ["similar-artists", artistId],
		queryFn: () => (artistId ? getSimilarArtists(artistId) : []),
		enabled: !!artistId,
	});

	if (!artistId) {
		return null;
	}

	if (isLoading) {
		return (
			<div className="space-y-4">
				<div className="flex items-center gap-3">
					<Users className="w-6 h-6 text-muted-foreground" />
					<h2 className="text-lg font-semibold">Similar Artists</h2>
				</div>
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
					{Array.from({ length: 6 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton placeholders never reorder
						<div key={i} className="rounded-lg bg-card p-4 animate-pulse">
							<div className="aspect-square rounded-full bg-muted mb-3" />
							<div className="h-4 bg-muted rounded w-3/4 mb-2" />
							<div className="h-3 bg-muted rounded w-1/2" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (!artists || artists.length === 0) {
		return null;
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3">
				<Users className="w-6 h-6 text-muted-foreground" />
				<h2 className="text-lg font-semibold">Similar Artists</h2>
				<span className="text-sm text-muted-foreground">
					({artists.length})
				</span>
			</div>
			<ArtistGrid artists={artists} />
		</div>
	);
}

interface ArtistGridProps {
	artists: Artist[];
}

function ArtistGrid({ artists }: ArtistGridProps) {
	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
			{artists.map((artist) => (
				<ArtistCard key={artist.id} artist={artist} />
			))}
		</div>
	);
}
