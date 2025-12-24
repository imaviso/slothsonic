import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Disc3, Music, Users } from "lucide-react";

import { AlbumGrid } from "@/components/AlbumCard";
import { getAlbumList, getArtists, getRandomSongs } from "@/lib/api";

export const Route = createFileRoute("/app/")({
	component: AppHome,
});

function AppHome() {
	const { data: recentAlbums, isLoading: loadingAlbums } = useQuery({
		queryKey: ["albums", "newest"],
		queryFn: () => getAlbumList("newest", 12),
	});

	const { data: artists } = useQuery({
		queryKey: ["artists"],
		queryFn: getArtists,
	});

	const { data: songs } = useQuery({
		queryKey: ["randomSongs"],
		queryFn: () => getRandomSongs(1),
	});

	return (
		<div className="p-6 space-y-8">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold text-foreground">Welcome back</h1>
				<p className="text-muted-foreground mt-1">
					Here's what's in your library
				</p>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<StatCard
					icon={Disc3}
					label="Albums"
					value={recentAlbums?.length ? "12+" : "—"}
				/>
				<StatCard
					icon={Users}
					label="Artists"
					value={artists?.length?.toString() ?? "—"}
				/>
				<StatCard
					icon={Music}
					label="Songs"
					value={songs?.length ? "Many" : "—"}
				/>
			</div>

			{/* Recent Albums */}
			<section>
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-xl font-semibold text-foreground">
						Recently Added
					</h2>
				</div>
				<AlbumGrid albums={recentAlbums ?? []} isLoading={loadingAlbums} />
			</section>
		</div>
	);
}

function StatCard({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
}) {
	return (
		<div className="bg-card rounded-lg border p-4">
			<div className="flex items-center gap-3">
				<div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
					<Icon className="w-5 h-5 text-primary" />
				</div>
				<div>
					<p className="text-2xl font-bold text-foreground">{value}</p>
					<p className="text-sm text-muted-foreground">{label}</p>
				</div>
			</div>
		</div>
	);
}
