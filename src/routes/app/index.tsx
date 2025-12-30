import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Disc3,
	Heart,
	History,
	Keyboard,
	Music,
	TrendingUp,
	Users,
} from "lucide-react";

import { AlbumGrid } from "@/components/AlbumCard";
import { SongList } from "@/components/SongList";
import { getAlbumList, getLibraryStats, getStarred } from "@/lib/api";

export const Route = createFileRoute("/app/")({
	component: AppHome,
});

function AppHome() {
	const { data: recentAlbums, isLoading: loadingAlbums } = useQuery({
		queryKey: ["albums", "newest"],
		queryFn: () => getAlbumList("newest", 12),
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 30 * 60 * 1000, // 30 minutes
	});

	// Library stats (albums, artists, songs counts)
	const { data: libraryStats } = useQuery({
		queryKey: ["libraryStats"],
		queryFn: getLibraryStats,
		staleTime: 5 * 60 * 1000, // Cache for 5 minutes
	});

	// Starred/Favorites
	const { data: starred, isLoading: loadingStarred } = useQuery({
		queryKey: ["starred"],
		queryFn: getStarred,
		staleTime: 1 * 60 * 1000, // 1 minute
		gcTime: 10 * 60 * 1000, // 10 minutes
	});

	// Most played albums
	const { data: frequentAlbums, isLoading: loadingFrequent } = useQuery({
		queryKey: ["albums", "frequent"],
		queryFn: () => getAlbumList("frequent", 12),
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 30 * 60 * 1000, // 30 minutes
	});

	// Recently played albums
	const { data: recentlyPlayedAlbums, isLoading: loadingRecentlyPlayed } =
		useQuery({
			queryKey: ["albums", "recent"],
			queryFn: () => getAlbumList("recent", 12),
			staleTime: 2 * 60 * 1000, // 2 minutes (changes more frequently)
			gcTime: 15 * 60 * 1000, // 15 minutes
		});

	const formatNumber = (num: number) => {
		if (num >= 1000) {
			return `${(num / 1000).toFixed(1)}k`;
		}
		return num.toString();
	};

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
					value={libraryStats ? formatNumber(libraryStats.albumCount) : "—"}
				/>
				<StatCard
					icon={Users}
					label="Artists"
					value={libraryStats ? formatNumber(libraryStats.artistCount) : "—"}
				/>
				<StatCard
					icon={Music}
					label="Songs"
					value={libraryStats ? formatNumber(libraryStats.songCount) : "—"}
				/>
			</div>

			{/* Keyboard Shortcuts */}
			<section className="bg-card rounded-lg border p-4">
				<div className="flex items-center gap-2 mb-3">
					<Keyboard className="w-4 h-4 text-primary" />
					<h3 className="text-sm font-medium text-foreground">
						Keyboard Shortcuts
					</h3>
				</div>
				<div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
					<ShortcutHint keys={["⌘", "K"]} description="Search" />
					<ShortcutHint keys={["⌘", "B"]} description="Sidebar" />
					<ShortcutHint keys={["Space"]} description="Play / Pause" />
					<ShortcutHint keys={["←", "→"]} description="Seek ±10s" />
					<ShortcutHint keys={["↑", "↓"]} description="Volume" />
				</div>
			</section>

			{/* Favorites/Starred Songs */}
			{(loadingStarred || (starred?.songs && starred.songs.length > 0)) && (
				<section>
					<div className="flex items-center gap-2 mb-4">
						<Heart className="w-5 h-5 text-primary" />
						<h2 className="text-xl font-semibold text-foreground">
							Favorite Songs
						</h2>
					</div>
					<SongList
						songs={starred?.songs?.slice(0, 5) ?? []}
						isLoading={loadingStarred}
						showHeader={false}
					/>
				</section>
			)}

			{/* Starred Albums */}
			{(loadingStarred || (starred?.albums && starred.albums.length > 0)) && (
				<section>
					<div className="flex items-center gap-2 mb-4">
						<Heart className="w-5 h-5 text-primary" />
						<h2 className="text-xl font-semibold text-foreground">
							Favorite Albums
						</h2>
					</div>
					<AlbumGrid
						albums={starred?.albums?.slice(0, 12) ?? []}
						isLoading={loadingStarred}
					/>
				</section>
			)}

			{/* Most Played */}
			{(loadingFrequent || (frequentAlbums && frequentAlbums.length > 0)) && (
				<section>
					<div className="flex items-center gap-2 mb-4">
						<TrendingUp className="w-5 h-5 text-primary" />
						<h2 className="text-xl font-semibold text-foreground">
							Most Played
						</h2>
					</div>
					<AlbumGrid
						albums={frequentAlbums ?? []}
						isLoading={loadingFrequent}
					/>
				</section>
			)}

			{/* Recently Played */}
			{(loadingRecentlyPlayed ||
				(recentlyPlayedAlbums && recentlyPlayedAlbums.length > 0)) && (
				<section>
					<div className="flex items-center gap-2 mb-4">
						<History className="w-5 h-5 text-primary" />
						<h2 className="text-xl font-semibold text-foreground">
							Recently Played
						</h2>
					</div>
					<AlbumGrid
						albums={recentlyPlayedAlbums ?? []}
						isLoading={loadingRecentlyPlayed}
					/>
				</section>
			)}

			{/* Recently Added Albums */}
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

function ShortcutHint({
	keys,
	description,
}: {
	keys: string[];
	description: string;
}) {
	return (
		<div className="flex items-center gap-2">
			<div className="flex items-center gap-1">
				{keys.map((key) => (
					<kbd
						key={key}
						className="px-1.5 py-0.5 text-xs bg-muted rounded border border-border font-mono"
					>
						{key}
					</kbd>
				))}
			</div>
			<span className="text-muted-foreground">{description}</span>
		</div>
	);
}
