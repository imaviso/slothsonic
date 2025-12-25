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
