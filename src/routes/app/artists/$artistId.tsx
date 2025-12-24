import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, User } from "lucide-react";
import { useEffect, useState } from "react";

import { AlbumGrid } from "@/components/AlbumCard";
import { Button } from "@/components/ui/button";
import { getArtist, getCoverArtUrl } from "@/lib/api";

export const Route = createFileRoute("/app/artists/$artistId")({
	component: ArtistDetailPage,
});

function ArtistDetailPage() {
	const { artistId } = Route.useParams();
	const [coverUrl, setCoverUrl] = useState<string | null>(null);
	const [imageError, setImageError] = useState(false);

	const { data, isLoading, error } = useQuery({
		queryKey: ["artist", artistId],
		queryFn: () => getArtist(artistId),
	});

	useEffect(() => {
		if (data?.artist.coverArt) {
			getCoverArtUrl(data.artist.coverArt, 500).then(setCoverUrl);
		}
	}, [data?.artist.coverArt]);

	if (isLoading) {
		return (
			<div className="p-6">
				<div className="animate-pulse">
					<div className="flex gap-6">
						<div className="w-48 h-48 bg-muted rounded-full" />
						<div className="flex-1 space-y-4">
							<div className="h-8 bg-muted rounded w-1/3" />
							<div className="h-4 bg-muted rounded w-1/4" />
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className="p-6">
				<div className="text-center py-12">
					<p className="text-destructive">Failed to load artist</p>
					<Link to="/app/artists">
						<Button variant="outline" className="mt-4">
							Back to Artists
						</Button>
					</Link>
				</div>
			</div>
		);
	}

	const { artist, albums } = data;

	return (
		<div className="p-6 space-y-6">
			{/* Back button */}
			<Link
				to="/app/artists"
				className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				<ArrowLeft className="w-4 h-4" />
				Back to Artists
			</Link>

			{/* Artist header */}
			<div className="flex flex-col md:flex-row gap-6 items-center md:items-end">
				{/* Artist image */}
				<div className="w-48 h-48 rounded-full overflow-hidden bg-muted flex-shrink-0 shadow-lg">
					{coverUrl && !imageError ? (
						<img
							src={coverUrl}
							alt={artist.name}
							className="w-full h-full object-cover"
							onError={() => setImageError(true)}
						/>
					) : (
						<div className="w-full h-full flex items-center justify-center">
							<User className="w-20 h-20 text-muted-foreground" />
						</div>
					)}
				</div>

				{/* Artist info */}
				<div className="flex flex-col items-center md:items-start space-y-2">
					<p className="text-sm text-muted-foreground uppercase tracking-wide">
						Artist
					</p>
					<h1 className="text-4xl font-bold text-foreground">{artist.name}</h1>
					<p className="text-muted-foreground">
						{albums.length} album{albums.length !== 1 ? "s" : ""}
					</p>
				</div>
			</div>

			{/* Albums */}
			{albums.length > 0 && (
				<section>
					<h2 className="text-xl font-semibold text-foreground mb-4">Albums</h2>
					<AlbumGrid albums={albums} />
				</section>
			)}
		</div>
	);
}
