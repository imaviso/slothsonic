import { useNavigate } from "@tanstack/react-router";
import { Disc3, Loader2, type LucideIcon, Music, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import type { Album as AlbumType, Artist, Song } from "@/lib/api";
import { search } from "@/lib/api";
import { playSong } from "@/lib/player";

interface SearchResultItem {
	id: string;
	title: string;
	subtitle?: string;
	type: "song" | "album" | "artist";
	icon: LucideIcon;
	data: Song | AlbumType | Artist;
}

export function GlobalSearch() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<SearchResultItem[]>([]);
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();

	// Handle Cmd/Ctrl+K hotkey
	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen((open) => !open);
			}
		};

		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, []);

	// Auto close when navigation occurs
	useEffect(() => {
		setOpen(false);
	}, []);

	// Search with debounce
	useEffect(() => {
		if (!query.trim()) {
			setResults([]);
			return;
		}

		setLoading(true);
		const timer = setTimeout(async () => {
			try {
				const searchResults = await search(query);

				const items: SearchResultItem[] = [];

				// Add songs
				searchResults.songs.forEach((song) => {
					items.push({
						id: song.id,
						title: song.title,
						subtitle: song.artist,
						type: "song",
						icon: Music,
						data: song,
					});
				});

				// Add albums
				searchResults.albums.forEach((album) => {
					items.push({
						id: album.id,
						title: album.name,
						subtitle: album.artist,
						type: "album",
						icon: Disc3,
						data: album,
					});
				});

				// Add artists
				searchResults.artists.forEach((artist) => {
					items.push({
						id: artist.id,
						title: artist.name,
						subtitle: `${artist.albumCount ?? 0} albums`,
						type: "artist",
						icon: User,
						data: artist,
					});
				});

				setResults(items);
			} catch (error) {
				console.error("Search error:", error);
				toast.error("Search failed");
			} finally {
				setLoading(false);
			}
		}, 300);

		return () => clearTimeout(timer);
	}, [query]);

	const handleSelect = (item: SearchResultItem) => {
		setOpen(false);

		switch (item.type) {
			case "song": {
				const song = item.data as Song;
				playSong(song);
				toast.success(`Playing "${song.title}"`);
				break;
			}
			case "album": {
				const album = item.data as AlbumType;
				navigate({
					to: "/app/albums/$albumId",
					params: { albumId: album.id },
				});
				break;
			}
			case "artist": {
				const artist = item.data as Artist;
				navigate({
					to: "/app/artists/$artistId",
					params: { artistId: artist.id },
				});
				break;
			}
		}
	};

	// Group results by type
	const groupedResults = {
		songs: results.filter((r) => r.type === "song"),
		albums: results.filter((r) => r.type === "album"),
		artists: results.filter((r) => r.type === "artist"),
	};

	return (
		<CommandDialog
			open={open}
			onOpenChange={setOpen}
			title="Search"
			description="Search for songs, albums, and artists"
		>
			<CommandInput
				placeholder="Search songs, albums, artists... (Cmd+K)"
				value={query}
				onValueChange={setQuery}
			/>
			<CommandList>
				{loading && (
					<div className="flex items-center justify-center py-6">
						<Loader2 className="h-4 w-4 animate-spin" />
					</div>
				)}

				{!loading && !query && (
					<CommandEmpty>
						<div className="text-center text-sm text-muted-foreground">
							<p>Type to search for songs, albums, and artists</p>
							<p className="text-xs mt-2">
								Press <kbd className="bg-muted px-1 rounded">Cmd</kbd> +{" "}
								<kbd className="bg-muted px-1 rounded">K</kbd> to focus
							</p>
						</div>
					</CommandEmpty>
				)}

				{!loading && query && results.length === 0 && (
					<CommandEmpty>No results found for "{query}"</CommandEmpty>
				)}

				{/* Songs Section */}
				{groupedResults.songs.length > 0 && (
					<CommandGroup heading="Songs">
						{groupedResults.songs.map((item) => (
							<CommandItem
								key={`${item.type}-${item.id}`}
								onSelect={() => handleSelect(item)}
								value={item.id}
							>
								<Music className="h-4 w-4" />
								<div className="flex-1">
									<div className="font-medium">{item.title}</div>
									<div className="text-xs text-muted-foreground">
										{item.subtitle}
									</div>
								</div>
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{/* Albums Section */}
				{groupedResults.albums.length > 0 && (
					<CommandGroup heading="Albums">
						{groupedResults.albums.map((item) => (
							<CommandItem
								key={`${item.type}-${item.id}`}
								onSelect={() => handleSelect(item)}
								value={item.id}
							>
								<Disc3 className="h-4 w-4" />
								<div className="flex-1">
									<div className="font-medium">{item.title}</div>
									<div className="text-xs text-muted-foreground">
										{item.subtitle}
									</div>
								</div>
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{/* Artists Section */}
				{groupedResults.artists.length > 0 && (
					<CommandGroup heading="Artists">
						{groupedResults.artists.map((item) => (
							<CommandItem
								key={`${item.type}-${item.id}`}
								onSelect={() => handleSelect(item)}
								value={item.id}
							>
								<User className="h-4 w-4" />
								<div className="flex-1">
									<div className="font-medium">{item.title}</div>
									<div className="text-xs text-muted-foreground">
										{item.subtitle}
									</div>
								</div>
							</CommandItem>
						))}
					</CommandGroup>
				)}
			</CommandList>
		</CommandDialog>
	);
}
