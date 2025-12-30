import { useQuery } from "@tanstack/react-query";
import { getCoverArtUrl } from "@/lib/api";

/**
 * Custom hook for fetching cover art URLs with caching.
 * This centralizes cover art fetching and caches URLs to reduce API calls.
 *
 * @param coverArtId - The cover art ID from the Subsonic API
 * @param size - The desired size of the cover art (default: 300)
 * @returns Query result with the cover art URL
 */
export function useCoverArt(coverArtId: string | undefined, size = 300) {
	return useQuery({
		queryKey: ["coverArt", coverArtId, size],
		queryFn: () => getCoverArtUrl(coverArtId as string, size),
		enabled: !!coverArtId,
		staleTime: Number.POSITIVE_INFINITY, // Cover art URLs don't change
		gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
	});
}
