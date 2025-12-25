import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";

import type { Album, Artist, Song } from "@/lib/api";
import { star, unstar } from "@/lib/api";
import { cn } from "@/lib/utils";

interface StarButtonProps {
	id: string;
	type: "song" | "album" | "artist";
	isStarred: boolean;
	size?: "sm" | "md" | "lg";
	className?: string;
}

// Helper to update starred field in an album within any cache
function updateAlbumStarredInCache(
	albums: Album[] | undefined,
	albumId: string,
	starred: string | undefined,
): Album[] | undefined {
	if (!albums) return undefined;
	return albums.map((album) =>
		album.id === albumId ? { ...album, starred } : album,
	);
}

// Helper to update starred field in an artist within any cache
function updateArtistStarredInCache(
	artists: Artist[] | undefined,
	artistId: string,
	starred: string | undefined,
): Artist[] | undefined {
	if (!artists) return undefined;
	return artists.map((artist) =>
		artist.id === artistId ? { ...artist, starred } : artist,
	);
}

// Helper to update starred field in songs within any cache
function updateSongStarredInCache(
	songs: Song[] | undefined,
	songId: string,
	starred: string | undefined,
): Song[] | undefined {
	if (!songs) return undefined;
	return songs.map((song) =>
		song.id === songId ? { ...song, starred } : song,
	);
}

export function StarButton({
	id,
	type,
	isStarred,
	size = "md",
	className,
}: StarButtonProps) {
	const queryClient = useQueryClient();

	const starMutation = useMutation({
		mutationFn: async (shouldStar: boolean) => {
			const options =
				type === "song"
					? { id }
					: type === "album"
						? { albumId: id }
						: { artistId: id };

			if (shouldStar) {
				await star(options);
			} else {
				await unstar(options);
			}
		},
		onMutate: async (shouldStar) => {
			const starredValue = shouldStar ? new Date().toISOString() : undefined;

			// Optimistically update album caches
			if (type === "album") {
				// Cancel outgoing refetches
				await queryClient.cancelQueries({ queryKey: ["album"] });
				await queryClient.cancelQueries({ queryKey: ["albums"] });
				await queryClient.cancelQueries({ queryKey: ["starred"] });

				// Update single album cache
				const previousAlbum = queryClient.getQueryData<{
					album: Album;
					songs: Song[];
				}>(["album", id]);

				if (previousAlbum) {
					queryClient.setQueryData(["album", id], {
						...previousAlbum,
						album: { ...previousAlbum.album, starred: starredValue },
					});
				}

				// Update all album list caches (home page, etc.)
				const albumListQueries = queryClient.getQueriesData<Album[]>({
					queryKey: ["albums"],
				});

				const previousAlbumLists: Array<{
					queryKey: readonly unknown[];
					data: Album[] | undefined;
				}> = [];

				for (const [queryKey, data] of albumListQueries) {
					previousAlbumLists.push({ queryKey, data });
					const updated = updateAlbumStarredInCache(data, id, starredValue);
					if (updated) {
						queryClient.setQueryData(queryKey, updated);
					}
				}

				// Update starred cache
				const previousStarred = queryClient.getQueryData<{
					albums: Album[];
					artists: Artist[];
					songs: Song[];
				}>(["starred"]);

				if (previousStarred) {
					if (shouldStar && previousAlbum) {
						// Add to starred
						queryClient.setQueryData(["starred"], {
							...previousStarred,
							albums: [
								{ ...previousAlbum.album, starred: starredValue },
								...previousStarred.albums,
							],
						});
					} else {
						// Remove from starred
						queryClient.setQueryData(["starred"], {
							...previousStarred,
							albums: previousStarred.albums.filter((a) => a.id !== id),
						});
					}
				}

				return { previousAlbum, previousAlbumLists, previousStarred };
			}

			// Optimistically update artist caches
			if (type === "artist") {
				await queryClient.cancelQueries({ queryKey: ["artist"] });
				await queryClient.cancelQueries({ queryKey: ["artists"] });
				await queryClient.cancelQueries({ queryKey: ["starred"] });

				// Update single artist cache
				const previousArtist = queryClient.getQueryData<{
					artist: Artist;
					albums: Album[];
				}>(["artist", id]);

				if (previousArtist) {
					queryClient.setQueryData(["artist", id], {
						...previousArtist,
						artist: { ...previousArtist.artist, starred: starredValue },
					});
				}

				// Update artist list caches
				const artistListQueries = queryClient.getQueriesData<Artist[]>({
					queryKey: ["artists"],
				});

				const previousArtistLists: Array<{
					queryKey: readonly unknown[];
					data: Artist[] | undefined;
				}> = [];

				for (const [queryKey, data] of artistListQueries) {
					previousArtistLists.push({ queryKey, data });
					const updated = updateArtistStarredInCache(data, id, starredValue);
					if (updated) {
						queryClient.setQueryData(queryKey, updated);
					}
				}

				// Update starred cache
				const previousStarred = queryClient.getQueryData<{
					albums: Album[];
					artists: Artist[];
					songs: Song[];
				}>(["starred"]);

				if (previousStarred) {
					if (shouldStar && previousArtist) {
						queryClient.setQueryData(["starred"], {
							...previousStarred,
							artists: [
								{ ...previousArtist.artist, starred: starredValue },
								...previousStarred.artists,
							],
						});
					} else {
						queryClient.setQueryData(["starred"], {
							...previousStarred,
							artists: previousStarred.artists.filter((a) => a.id !== id),
						});
					}
				}

				return { previousArtist, previousArtistLists, previousStarred };
			}

			// Optimistically update song caches
			if (type === "song") {
				await queryClient.cancelQueries({ queryKey: ["starred"] });
				await queryClient.cancelQueries({ queryKey: ["randomSongs"] });

				// Update starred cache
				const previousStarred = queryClient.getQueryData<{
					albums: Album[];
					artists: Artist[];
					songs: Song[];
				}>(["starred"]);

				// Update random songs cache
				const previousRandomSongs = queryClient.getQueryData<Song[]>([
					"randomSongs",
				]);

				if (previousRandomSongs) {
					queryClient.setQueryData(
						["randomSongs"],
						updateSongStarredInCache(previousRandomSongs, id, starredValue),
					);
				}

				// Update album song lists
				const albumQueries = queryClient.getQueriesData<{
					album: Album;
					songs: Song[];
				}>({ queryKey: ["album"] });

				const previousAlbumSongs: Array<{
					queryKey: readonly unknown[];
					data: { album: Album; songs: Song[] } | undefined;
				}> = [];

				for (const [queryKey, data] of albumQueries) {
					if (data?.songs) {
						previousAlbumSongs.push({ queryKey, data });
						const updatedSongs = updateSongStarredInCache(
							data.songs,
							id,
							starredValue,
						);
						if (updatedSongs) {
							queryClient.setQueryData(queryKey, {
								...data,
								songs: updatedSongs,
							});
						}
					}
				}

				// Update playlist song lists
				const playlistQueries = queryClient.getQueriesData<{
					entry?: Song[];
				}>({ queryKey: ["playlist"] });

				const previousPlaylistSongs: Array<{
					queryKey: readonly unknown[];
					data: { entry?: Song[] } | undefined;
				}> = [];

				for (const [queryKey, data] of playlistQueries) {
					if (data?.entry) {
						previousPlaylistSongs.push({ queryKey, data });
						const updatedSongs = updateSongStarredInCache(
							data.entry,
							id,
							starredValue,
						);
						if (updatedSongs) {
							queryClient.setQueryData(queryKey, {
								...data,
								entry: updatedSongs,
							});
						}
					}
				}

				if (previousStarred) {
					if (shouldStar) {
						// Find the song from any cache to add to starred
						let songToAdd: Song | undefined;
						for (const { data } of previousAlbumSongs) {
							songToAdd = data?.songs.find((s) => s.id === id);
							if (songToAdd) break;
						}
						if (!songToAdd) {
							songToAdd = previousRandomSongs?.find((s) => s.id === id);
						}

						if (songToAdd) {
							queryClient.setQueryData(["starred"], {
								...previousStarred,
								songs: [
									{ ...songToAdd, starred: starredValue },
									...previousStarred.songs,
								],
							});
						}
					} else {
						queryClient.setQueryData(["starred"], {
							...previousStarred,
							songs: previousStarred.songs.filter((s) => s.id !== id),
						});
					}
				}

				return {
					previousStarred,
					previousRandomSongs,
					previousAlbumSongs,
					previousPlaylistSongs,
				};
			}

			return {};
		},
		onError: (_err, _shouldStar, context) => {
			if (!context) return;

			// Revert album cache updates
			if (type === "album") {
				if ("previousAlbum" in context) {
					queryClient.setQueryData(["album", id], context.previousAlbum);
				}
				if ("previousAlbumLists" in context) {
					for (const { queryKey, data } of context.previousAlbumLists as Array<{
						queryKey: readonly unknown[];
						data: Album[] | undefined;
					}>) {
						queryClient.setQueryData(queryKey, data);
					}
				}
				if ("previousStarred" in context) {
					queryClient.setQueryData(["starred"], context.previousStarred);
				}
			}

			// Revert artist cache updates
			if (type === "artist") {
				if ("previousArtist" in context) {
					queryClient.setQueryData(["artist", id], context.previousArtist);
				}
				if ("previousArtistLists" in context) {
					for (const {
						queryKey,
						data,
					} of context.previousArtistLists as Array<{
						queryKey: readonly unknown[];
						data: Artist[] | undefined;
					}>) {
						queryClient.setQueryData(queryKey, data);
					}
				}
				if ("previousStarred" in context) {
					queryClient.setQueryData(["starred"], context.previousStarred);
				}
			}

			// Revert song cache updates
			if (type === "song") {
				if ("previousStarred" in context) {
					queryClient.setQueryData(["starred"], context.previousStarred);
				}
				if ("previousRandomSongs" in context) {
					queryClient.setQueryData(
						["randomSongs"],
						context.previousRandomSongs,
					);
				}
				if ("previousAlbumSongs" in context) {
					for (const { queryKey, data } of context.previousAlbumSongs as Array<{
						queryKey: readonly unknown[];
						data: { album: Album; songs: Song[] } | undefined;
					}>) {
						queryClient.setQueryData(queryKey, data);
					}
				}
				if ("previousPlaylistSongs" in context) {
					for (const {
						queryKey,
						data,
					} of context.previousPlaylistSongs as Array<{
						queryKey: readonly unknown[];
						data: { entry?: Song[] } | undefined;
					}>) {
						queryClient.setQueryData(queryKey, data);
					}
				}
			}
		},
		onSettled: () => {
			// Refetch to ensure consistency with server
			queryClient.invalidateQueries({ queryKey: ["starred"] });
			if (type === "album") {
				queryClient.invalidateQueries({ queryKey: ["album", id] });
				queryClient.invalidateQueries({ queryKey: ["albums"] });
			} else if (type === "artist") {
				queryClient.invalidateQueries({ queryKey: ["artist", id] });
				queryClient.invalidateQueries({ queryKey: ["artists"] });
			} else if (type === "song") {
				queryClient.invalidateQueries({ queryKey: ["randomSongs"] });
			}
		},
	});

	const sizeClasses = {
		sm: "w-4 h-4",
		md: "w-5 h-5",
		lg: "w-6 h-6",
	};

	const buttonSizeClasses = {
		sm: "p-1",
		md: "p-1.5",
		lg: "p-2",
	};

	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		starMutation.mutate(!isStarred);
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={starMutation.isPending}
			className={cn(
				"rounded-full transition-colors hover:bg-muted",
				buttonSizeClasses[size],
				starMutation.isPending && "opacity-50",
				className,
			)}
			aria-label={isStarred ? "Remove from favorites" : "Add to favorites"}
		>
			<Heart
				className={cn(
					sizeClasses[size],
					"transition-colors",
					isStarred
						? "fill-red-500 text-red-500"
						: "text-muted-foreground hover:text-foreground",
				)}
			/>
		</button>
	);
}
