import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Disc3, Music, Play, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import type { Album, Artist, Song } from "@/lib/api";
import { search } from "@/lib/api";
import { playSong } from "@/lib/player";

export function GlobalSearch() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const navigate = useNavigate();

	// Debounced search query
	const [debouncedQuery, setDebouncedQuery] = useState("");

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(query);
		}, 300);
		return () => clearTimeout(timer);
	}, [query]);

	// Search API call
	const { data: searchResults, isLoading } = useQuery({
		queryKey: ["search", debouncedQuery],
		queryFn: () => search(debouncedQuery),
		enabled: debouncedQuery.length >= 2,
		staleTime: 30000,
	});

	// Keyboard shortcut to open search
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Cmd+K (Mac) or Ctrl+K (Windows/Linux)
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setOpen((prev) => !prev);
			}
			// Also support "/" key when not in input
			if (e.key === "/" && !open) {
				const target = e.target as HTMLElement;
				const isInputFocused =
					target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable;
				if (!isInputFocused) {
					e.preventDefault();
					setOpen(true);
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [open]);

	// Reset query when dialog closes
	useEffect(() => {
		if (!open) {
			setQuery("");
			setDebouncedQuery("");
		}
	}, [open]);

	const handleSelectArtist = useCallback(
		(artist: Artist) => {
			setOpen(false);
			navigate({
				to: "/app/artists/$artistId",
				params: { artistId: artist.id },
			});
		},
		[navigate],
	);

	const handleSelectAlbum = useCallback(
		(album: Album) => {
			setOpen(false);
			navigate({
				to: "/app/albums/$albumId",
				params: { albumId: album.id },
			});
		},
		[navigate],
	);

	const handleSelectSong = useCallback((song: Song) => {
		setOpen(false);
		playSong(song);
		toast.success(`Playing "${song.title}"`);
	}, []);

	const hasResults =
		searchResults &&
		(searchResults.artists.length > 0 ||
			searchResults.albums.length > 0 ||
			searchResults.songs.length > 0);

	return (
		<CommandDialog
			open={open}
			onOpenChange={setOpen}
			title="Search"
			description="Search for artists, albums, and songs"
		>
			<CommandInput
				placeholder="Search artists, albums, songs..."
				value={query}
				onValueChange={setQuery}
			/>
			<CommandList>
				{debouncedQuery.length < 2 && (
					<CommandEmpty>
						<div className="text-muted-foreground">
							<p>Type at least 2 characters to search</p>
							<p className="text-xs mt-2">
								Press{" "}
								<kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">⌘K</kbd>{" "}
								or{" "}
								<kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">/</kbd>{" "}
								to open search
							</p>
						</div>
					</CommandEmpty>
				)}

				{debouncedQuery.length >= 2 && isLoading && (
					<CommandEmpty>Searching...</CommandEmpty>
				)}

				{debouncedQuery.length >= 2 && !isLoading && !hasResults && (
					<CommandEmpty>No results found for "{debouncedQuery}"</CommandEmpty>
				)}

				{searchResults && searchResults.artists.length > 0 && (
					<CommandGroup heading="Artists">
						{searchResults.artists.slice(0, 5).map((artist) => (
							<CommandItem
								key={artist.id}
								value={`artist-${artist.id}-${artist.name}`}
								onSelect={() => handleSelectArtist(artist)}
							>
								<User className="mr-2 h-4 w-4 text-muted-foreground" />
								<span className="flex-1 truncate">{artist.name}</span>
								{artist.albumCount !== undefined && (
									<span className="text-xs text-muted-foreground">
										{artist.albumCount} album
										{artist.albumCount !== 1 ? "s" : ""}
									</span>
								)}
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{searchResults &&
					searchResults.artists.length > 0 &&
					searchResults.albums.length > 0 && <CommandSeparator />}

				{searchResults && searchResults.albums.length > 0 && (
					<CommandGroup heading="Albums">
						{searchResults.albums.slice(0, 5).map((album) => (
							<CommandItem
								key={album.id}
								value={`album-${album.id}-${album.name}`}
								onSelect={() => handleSelectAlbum(album)}
							>
								<Disc3 className="mr-2 h-4 w-4 text-muted-foreground" />
								<div className="flex-1 min-w-0">
									<span className="truncate block">{album.name}</span>
									{album.artist && (
										<span className="text-xs text-muted-foreground truncate block">
											{album.artist}
										</span>
									)}
								</div>
								{album.year && (
									<span className="text-xs text-muted-foreground">
										{album.year}
									</span>
								)}
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{searchResults &&
					searchResults.albums.length > 0 &&
					searchResults.songs.length > 0 && <CommandSeparator />}

				{searchResults && searchResults.songs.length > 0 && (
					<CommandGroup heading="Songs">
						{searchResults.songs.slice(0, 5).map((song) => (
							<CommandItem
								key={song.id}
								value={`song-${song.id}-${song.title}`}
								onSelect={() => handleSelectSong(song)}
							>
								<Music className="mr-2 h-4 w-4 text-muted-foreground" />
								<div className="flex-1 min-w-0">
									<span className="truncate block">{song.title}</span>
									{song.artist && (
										<span className="text-xs text-muted-foreground truncate block">
											{song.artist}
											{song.album && ` • ${song.album}`}
										</span>
									)}
								</div>
								<Play className="h-3 w-3 text-muted-foreground" />
							</CommandItem>
						))}
					</CommandGroup>
				)}
			</CommandList>
		</CommandDialog>
	);
}
