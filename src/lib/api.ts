import { buildApiUrl } from "./subsonic";

// Subsonic API Types
export interface Album {
	id: string;
	name: string;
	artist?: string;
	artistId?: string;
	coverArt?: string;
	songCount?: number;
	duration?: number;
	year?: number;
	genre?: string;
	created?: string;
	starred?: string; // ISO date string if starred
}

export interface Artist {
	id: string;
	name: string;
	coverArt?: string;
	albumCount?: number;
	starred?: string; // ISO date string if starred
}

export interface Song {
	id: string;
	title: string;
	album?: string;
	albumId?: string;
	artist?: string;
	artistId?: string;
	coverArt?: string;
	duration?: number;
	track?: number;
	year?: number;
	genre?: string;
	size?: number;
	contentType?: string;
	suffix?: string;
	path?: string;
	starred?: string; // ISO date string if starred
}

export interface SubsonicResponse<T> {
	"subsonic-response": {
		status: "ok" | "failed";
		version: string;
		type: string;
		serverVersion: string;
		openSubsonic: boolean;
		error?: {
			code: number;
			message: string;
		};
	} & T;
}

export type AlbumListType =
	| "random"
	| "newest"
	| "highest"
	| "frequent"
	| "recent"
	| "alphabeticalByName"
	| "alphabeticalByArtist"
	| "starred"
	| "byYear"
	| "byGenre";

// API Functions

export async function getAlbumList(
	type: AlbumListType = "newest",
	size = 50,
	offset = 0,
): Promise<Album[]> {
	const url = await buildApiUrl("getAlbumList2", {
		type,
		size: size.toString(),
		offset: offset.toString(),
	});

	const response = await fetch(url);
	const data: SubsonicResponse<{ albumList2?: { album?: Album[] } }> =
		await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to fetch albums",
		);
	}

	return data["subsonic-response"].albumList2?.album ?? [];
}

export async function getAlbum(id: string): Promise<{
	album: Album;
	songs: Song[];
}> {
	const url = await buildApiUrl("getAlbum", { id });

	const response = await fetch(url);
	const data: SubsonicResponse<{ album?: Album & { song?: Song[] } }> =
		await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to fetch album",
		);
	}

	const albumData = data["subsonic-response"].album;
	if (!albumData) {
		throw new Error("Album not found");
	}

	const { song, ...album } = albumData;
	return {
		album,
		songs: song ?? [],
	};
}

export async function getArtists(): Promise<Artist[]> {
	const url = await buildApiUrl("getArtists");

	const response = await fetch(url);
	const data: SubsonicResponse<{
		artists?: { index?: Array<{ artist?: Artist[] }> };
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to fetch artists",
		);
	}

	const indexes = data["subsonic-response"].artists?.index ?? [];
	return indexes.flatMap((index) => index.artist ?? []);
}

export async function getRandomSongs(size = 50): Promise<Song[]> {
	const url = await buildApiUrl("getRandomSongs", {
		size: size.toString(),
	});

	const response = await fetch(url);
	const data: SubsonicResponse<{ randomSongs?: { song?: Song[] } }> =
		await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to fetch songs",
		);
	}

	return data["subsonic-response"].randomSongs?.song ?? [];
}

export async function getArtist(id: string): Promise<{
	artist: Artist;
	albums: Album[];
}> {
	const url = await buildApiUrl("getArtist", { id });

	const response = await fetch(url);
	const data: SubsonicResponse<{ artist?: Artist & { album?: Album[] } }> =
		await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to fetch artist",
		);
	}

	const artistData = data["subsonic-response"].artist;
	if (!artistData) {
		throw new Error("Artist not found");
	}

	const { album, ...artist } = artistData;
	return {
		artist,
		albums: album ?? [],
	};
}

export interface SearchResult {
	artists: Artist[];
	albums: Album[];
	songs: Song[];
}

export async function search(query: string): Promise<SearchResult> {
	const url = await buildApiUrl("search3", {
		query,
		artistCount: "20",
		albumCount: "20",
		songCount: "20",
	});

	const response = await fetch(url);
	const data: SubsonicResponse<{
		searchResult3?: {
			artist?: Artist[];
			album?: Album[];
			song?: Song[];
		};
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Search failed",
		);
	}

	const result = data["subsonic-response"].searchResult3;
	return {
		artists: result?.artist ?? [],
		albums: result?.album ?? [],
		songs: result?.song ?? [],
	};
}

// Get starred/favorite items
export interface StarredResult {
	artists: Artist[];
	albums: Album[];
	songs: Song[];
}

export async function getStarred(): Promise<StarredResult> {
	const url = await buildApiUrl("getStarred2");

	const response = await fetch(url);
	const data: SubsonicResponse<{
		starred2?: {
			artist?: Artist[];
			album?: Album[];
			song?: Song[];
		};
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to fetch starred",
		);
	}

	const result = data["subsonic-response"].starred2;
	return {
		artists: result?.artist ?? [],
		albums: result?.album ?? [],
		songs: result?.song ?? [],
	};
}

// URL builders for media

export async function getCoverArtUrl(
	coverArtId: string,
	size?: number,
): Promise<string> {
	const params: Record<string, string> = { id: coverArtId };
	if (size) {
		params.size = size.toString();
	}
	return buildApiUrl("getCoverArt", params);
}

export async function getStreamUrl(songId: string): Promise<string> {
	return buildApiUrl("stream", { id: songId });
}

// Star/Unstar items
export async function star(options: {
	id?: string;
	albumId?: string;
	artistId?: string;
}): Promise<void> {
	const params: Record<string, string> = {};
	if (options.id) params.id = options.id;
	if (options.albumId) params.albumId = options.albumId;
	if (options.artistId) params.artistId = options.artistId;

	const url = await buildApiUrl("star", params);
	const response = await fetch(url);
	const data: SubsonicResponse<Record<string, never>> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to star item",
		);
	}
}

export async function unstar(options: {
	id?: string;
	albumId?: string;
	artistId?: string;
}): Promise<void> {
	const params: Record<string, string> = {};
	if (options.id) params.id = options.id;
	if (options.albumId) params.albumId = options.albumId;
	if (options.artistId) params.artistId = options.artistId;

	const url = await buildApiUrl("unstar", params);
	const response = await fetch(url);
	const data: SubsonicResponse<Record<string, never>> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to unstar item",
		);
	}
}

// Scrobble - report playback to server
export async function scrobble(
	id: string,
	options?: { submission?: boolean },
): Promise<void> {
	const params: Record<string, string> = { id };
	// submission=true means the song has finished playing (or played enough to count)
	// submission=false means "now playing" update
	if (options?.submission !== undefined) {
		params.submission = options.submission.toString();
	}

	const url = await buildApiUrl("scrobble", params);
	const response = await fetch(url);
	const data: SubsonicResponse<Record<string, never>> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to scrobble",
		);
	}
}

// Genre types and API functions
export interface Genre {
	value: string; // Genre name
	songCount: number;
	albumCount: number;
}

export interface Lyrics {
	artist: string;
	title: string;
	structured?: boolean;
	value?: string; // Plain text lyrics
	lyrics?: Array<{ value: string; lang?: string }>; // Structured lyrics
}

export async function getLyrics(
	artist: string,
	title: string,
): Promise<Lyrics | null> {
	const url = await buildApiUrl("getLyrics", { artist, title });

	const response = await fetch(url);
	const data: SubsonicResponse<{
		lyrics?: Lyrics;
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		return null;
	}

	return data["subsonic-response"].lyrics ?? null;
}

export async function getSimilarSongs2(
	id: string,
	count = 50,
): Promise<Song[]> {
	const url = await buildApiUrl("getSimilarSongs2", {
		id,
		count: count.toString(),
	});

	const response = await fetch(url);
	const data: SubsonicResponse<{
		similarSongs2?: { song?: Song[] };
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		return [];
	}

	return data["subsonic-response"].similarSongs2?.song ?? [];
}

export async function getSimilarArtists(
	id: string,
	count = 20,
): Promise<Artist[]> {
	const url = await buildApiUrl("getSimilarArtists2", {
		id,
		count: count.toString(),
	});

	const response = await fetch(url);
	const data: SubsonicResponse<{
		similarArtists2?: { artist?: Artist[] };
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		return [];
	}

	return data["subsonic-response"].similarArtists2?.artist ?? [];
}

export async function getArtistAlbums(artistId: string): Promise<Album[]> {
	const url = await buildApiUrl("getArtist", { id: artistId });

	const response = await fetch(url);
	const data: SubsonicResponse<{
		artist?: Artist & { album?: Album[] };
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		return [];
	}

	return data["subsonic-response"].artist?.album ?? [];
}

export async function getGenres(): Promise<Genre[]> {
	const url = await buildApiUrl("getGenres");

	const response = await fetch(url);
	const data: SubsonicResponse<{
		genres?: { genre?: Genre[] };
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to fetch genres",
		);
	}

	return data["subsonic-response"].genres?.genre ?? [];
}

export async function getSongsByGenre(
	genre: string,
	count = 50,
	offset = 0,
): Promise<Song[]> {
	const url = await buildApiUrl("getSongsByGenre", {
		genre,
		count: count.toString(),
		offset: offset.toString(),
	});

	const response = await fetch(url);
	const data: SubsonicResponse<{
		songsByGenre?: { song?: Song[] };
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message ||
				"Failed to fetch songs by genre",
		);
	}

	return data["subsonic-response"].songsByGenre?.song ?? [];
}

// ============================================================================
// Playlist Types and Functions
// ============================================================================

export interface Playlist {
	id: string;
	name: string;
	comment?: string;
	owner?: string;
	public?: boolean;
	songCount: number;
	duration: number;
	created?: string;
	changed?: string;
	coverArt?: string;
}

export interface PlaylistWithSongs extends Playlist {
	entry?: Song[];
}

export async function getPlaylists(): Promise<Playlist[]> {
	const url = await buildApiUrl("getPlaylists");

	const response = await fetch(url);
	const data: SubsonicResponse<{
		playlists?: { playlist?: Playlist[] };
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to fetch playlists",
		);
	}

	return data["subsonic-response"].playlists?.playlist ?? [];
}

export async function getPlaylist(id: string): Promise<PlaylistWithSongs> {
	const url = await buildApiUrl("getPlaylist", { id });

	const response = await fetch(url);
	const data: SubsonicResponse<{
		playlist?: PlaylistWithSongs;
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to fetch playlist",
		);
	}

	const playlist = data["subsonic-response"].playlist;
	if (!playlist) {
		throw new Error("Playlist not found");
	}

	return playlist;
}

export async function createPlaylist(options: {
	name: string;
	songId?: string[];
}): Promise<PlaylistWithSongs> {
	const params: Record<string, string> = { name: options.name };

	const url = await buildApiUrl("createPlaylist", params);

	// Add song IDs as multiple parameters
	const urlObj = new URL(url);
	if (options.songId) {
		for (const id of options.songId) {
			urlObj.searchParams.append("songId", id);
		}
	}

	const response = await fetch(urlObj.toString());
	const data: SubsonicResponse<{
		playlist?: PlaylistWithSongs;
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to create playlist",
		);
	}

	return (
		data["subsonic-response"].playlist ?? {
			id: "",
			name: options.name,
			songCount: 0,
			duration: 0,
		}
	);
}

export async function updatePlaylist(options: {
	playlistId: string;
	name?: string;
	comment?: string;
	public?: boolean;
	songIdToAdd?: string[];
	songIndexToRemove?: number[];
}): Promise<void> {
	const params: Record<string, string> = { playlistId: options.playlistId };
	if (options.name) params.name = options.name;
	if (options.comment !== undefined) params.comment = options.comment;
	if (options.public !== undefined) params.public = options.public.toString();

	const url = await buildApiUrl("updatePlaylist", params);

	// Add arrays as multiple parameters
	const urlObj = new URL(url);
	if (options.songIdToAdd) {
		for (const id of options.songIdToAdd) {
			urlObj.searchParams.append("songIdToAdd", id);
		}
	}
	if (options.songIndexToRemove) {
		for (const idx of options.songIndexToRemove) {
			urlObj.searchParams.append("songIndexToRemove", idx.toString());
		}
	}

	const response = await fetch(urlObj.toString());
	const data: SubsonicResponse<Record<string, never>> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to update playlist",
		);
	}
}

export async function deletePlaylist(id: string): Promise<void> {
	const url = await buildApiUrl("deletePlaylist", { id });

	const response = await fetch(url);
	const data: SubsonicResponse<Record<string, never>> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to delete playlist",
		);
	}
}

// ============================================================================
// Play Queue (for cross-device sync)
// ============================================================================

export interface PlayQueue {
	entry?: Song[];
	current?: string; // ID of the currently playing song
	position?: number; // Position in milliseconds within the current song
	username?: string;
	changed?: string;
	changedBy?: string;
}

export async function getPlayQueue(): Promise<PlayQueue | null> {
	const url = await buildApiUrl("getPlayQueue");

	const response = await fetch(url);
	const data: SubsonicResponse<{
		playQueue?: PlayQueue;
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		return null;
	}

	return data["subsonic-response"].playQueue ?? null;
}

export async function savePlayQueue(options: {
	id: string[]; // IDs of songs in the play queue
	current?: string; // ID of the currently playing song
	position?: number; // Position in milliseconds
}): Promise<void> {
	const params: Record<string, string> = {};
	if (options.current) params.current = options.current;
	if (options.position !== undefined)
		params.position = options.position.toString();

	const url = await buildApiUrl("savePlayQueue", params);

	// Add song IDs as multiple parameters
	const urlObj = new URL(url);
	for (const id of options.id) {
		urlObj.searchParams.append("id", id);
	}

	const response = await fetch(urlObj.toString());
	const data: SubsonicResponse<Record<string, never>> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to save play queue",
		);
	}
}

// ============================================================================
// Single Song / Top Songs
// ============================================================================

export async function getSong(id: string): Promise<Song> {
	const url = await buildApiUrl("getSong", { id });

	const response = await fetch(url);
	const data: SubsonicResponse<{
		song?: Song;
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to fetch song",
		);
	}

	const song = data["subsonic-response"].song;
	if (!song) {
		throw new Error("Song not found");
	}

	return song;
}

export async function getTopSongs(
	artistName: string,
	count = 50,
): Promise<Song[]> {
	const url = await buildApiUrl("getTopSongs", {
		artist: artistName,
		count: count.toString(),
	});

	const response = await fetch(url);
	const data: SubsonicResponse<{
		topSongs?: { song?: Song[] };
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		return [];
	}

	return data["subsonic-response"].topSongs?.song ?? [];
}

export async function getSimilarSongs(id: string, count = 50): Promise<Song[]> {
	const url = await buildApiUrl("getSimilarSongs", {
		id,
		count: count.toString(),
	});

	const response = await fetch(url);
	const data: SubsonicResponse<{
		similarSongs?: { song?: Song[] };
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		return [];
	}

	return data["subsonic-response"].similarSongs?.song ?? [];
}

// ============================================================================
// Ratings
// ============================================================================

export async function setRating(
	id: string,
	rating: 0 | 1 | 2 | 3 | 4 | 5,
): Promise<void> {
	const url = await buildApiUrl("setRating", {
		id,
		rating: rating.toString(),
	});

	const response = await fetch(url);
	const data: SubsonicResponse<Record<string, never>> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		throw new Error(
			data["subsonic-response"].error?.message || "Failed to set rating",
		);
	}
}

// ============================================================================
// Now Playing
// ============================================================================

export interface NowPlayingEntry extends Song {
	username?: string;
	minutesAgo?: number;
	playerId?: number;
	playerName?: string;
}

export async function getNowPlaying(): Promise<NowPlayingEntry[]> {
	const url = await buildApiUrl("getNowPlaying");

	const response = await fetch(url);
	const data: SubsonicResponse<{
		nowPlaying?: { entry?: NowPlayingEntry[] };
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		return [];
	}

	return data["subsonic-response"].nowPlaying?.entry ?? [];
}

// ============================================================================
// Lyrics by Song ID (OpenSubsonic extension)
// ============================================================================

export interface StructuredLyrics {
	displayArtist?: string;
	displayTitle?: string;
	lang: string;
	offset?: number;
	synced: boolean;
	line: Array<{
		start?: number; // Start time in milliseconds (for synced lyrics)
		value: string;
	}>;
}

export async function getLyricsBySongId(
	id: string,
): Promise<StructuredLyrics[]> {
	const url = await buildApiUrl("getLyricsBySongId", { id });

	const response = await fetch(url);
	const data: SubsonicResponse<{
		lyricsList?: { structuredLyrics?: StructuredLyrics[] };
	}> = await response.json();

	if (data["subsonic-response"].status !== "ok") {
		return [];
	}

	return data["subsonic-response"].lyricsList?.structuredLyrics ?? [];
}

// ============================================================================
// Download URL
// ============================================================================

export async function getDownloadUrl(id: string): Promise<string> {
	return buildApiUrl("download", { id });
}
