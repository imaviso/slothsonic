import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AlbumGrid } from "@/components/AlbumCard";
import { Button } from "@/components/ui/button";
import { type AlbumListType, getAlbumList } from "@/lib/api";
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

function AlbumsPage() {
	const [sortType, setSortType] = useState<AlbumListType>("newest");

	const { data: albums, isLoading } = useQuery({
		queryKey: ["albums", sortType],
		queryFn: () => getAlbumList(sortType, 100),
	});

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold text-foreground">Albums</h1>
				<p className="text-muted-foreground mt-1">Browse your album library</p>
			</div>

			{/* Sort options */}
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

			{/* Album Grid */}
			<AlbumGrid albums={albums ?? []} isLoading={isLoading} />
		</div>
	);
}
