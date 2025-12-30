import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ListMusic, Loader2, MoreHorizontal, Music, Plus } from "lucide-react";
import * as React from "react";
import { useEffect, useState } from "react";
import * as v from "valibot";

import { PlaylistContextMenu } from "@/components/PlaylistContextMenu";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	createPlaylist,
	getCoverArtUrl,
	getPlaylists,
	type Playlist,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const createPlaylistSchema = v.object({
	name: v.pipe(
		v.string(),
		v.nonEmpty("Playlist name is required"),
		v.minLength(1, "Playlist name is required"),
		v.maxLength(100, "Playlist name must be 100 characters or less"),
	),
});

export const Route = createFileRoute("/app/playlists/")({
	component: PlaylistsPage,
});

function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	if (hours > 0) {
		return `${hours}h ${mins}m`;
	}
	return `${mins} min`;
}

interface PlaylistCardProps {
	playlist: Playlist;
}

function PlaylistCard({ playlist }: PlaylistCardProps) {
	const [coverUrl, setCoverUrl] = useState<string | null>(null);
	const [imageLoaded, setImageLoaded] = useState(false);
	const cardRef = React.useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (playlist.coverArt) {
			getCoverArtUrl(playlist.coverArt, 200).then(setCoverUrl);
		}
	}, [playlist.coverArt]);

	const handleOpenContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		// Dispatch a context menu event on the card to trigger the PlaylistContextMenu
		if (cardRef.current) {
			const contextMenuEvent = new MouseEvent("contextmenu", {
				bubbles: true,
				cancelable: true,
				clientX: e.clientX,
				clientY: e.clientY,
			});
			cardRef.current.dispatchEvent(contextMenuEvent);
		}
	};

	return (
		<PlaylistContextMenu playlist={playlist}>
			<div
				ref={cardRef}
				className="group relative rounded-lg bg-card p-3 hover:bg-muted/50 transition-colors"
			>
				<Link
					to="/app/playlists/$playlistId"
					params={{ playlistId: playlist.id }}
					className="block"
				>
					<div className="aspect-square rounded-md overflow-hidden bg-muted mb-3">
						{coverUrl ? (
							<img
								src={coverUrl}
								alt={playlist.name}
								className={cn(
									"w-full h-full object-cover transition-opacity duration-200",
									imageLoaded ? "opacity-100" : "opacity-0",
								)}
								onLoad={() => setImageLoaded(true)}
							/>
						) : (
							<div className="w-full h-full flex items-center justify-center">
								<ListMusic className="w-12 h-12 text-muted-foreground" />
							</div>
						)}
					</div>
					<h3 className="font-medium text-sm truncate text-foreground">
						{playlist.name}
					</h3>
					<p className="text-xs text-muted-foreground truncate">
						{playlist.songCount} songs · {formatDuration(playlist.duration)}
					</p>
				</Link>
				<Button
					variant="ghost"
					size="icon"
					className="absolute top-2 right-2 w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-muted"
					onClick={handleOpenContextMenu}
					title="More options"
				>
					<MoreHorizontal className="w-4 h-4" />
				</Button>
			</div>
		</PlaylistContextMenu>
	);
}

function PlaylistsPage() {
	const [dialogOpen, setDialogOpen] = useState(false);
	const queryClient = useQueryClient();

	const { data: playlists, isLoading } = useQuery({
		queryKey: ["playlists"],
		queryFn: getPlaylists,
		staleTime: 2 * 60 * 1000, // 2 minutes
		gcTime: 15 * 60 * 1000, // 15 minutes
	});

	const createMutation = useMutation({
		mutationFn: (name: string) => createPlaylist({ name }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["playlists"] });
			setDialogOpen(false);
			form.reset();
		},
	});

	const form = useForm({
		defaultValues: {
			name: "",
		},
		validators: {
			onSubmit: createPlaylistSchema,
		},
		onSubmit: async ({ value }) => {
			createMutation.mutate(value.name.trim());
		},
	});

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold text-foreground">Playlists</h1>
					<p className="text-muted-foreground mt-1">
						{playlists?.length ?? 0} playlist
						{playlists?.length !== 1 ? "s" : ""}
					</p>
				</div>
				<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
					<DialogTrigger asChild>
						<Button>
							<Plus className="w-4 h-4 mr-2" />
							New Playlist
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Create New Playlist</DialogTitle>
							<DialogDescription>
								Enter a name for your new playlist.
							</DialogDescription>
						</DialogHeader>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								e.stopPropagation();
								form.handleSubmit();
							}}
						>
							<form.Field name="name">
								{(field) => (
									<Field data-invalid={field.state.meta.errors.length > 0}>
										<FieldLabel htmlFor={field.name}>Playlist Name</FieldLabel>
										<Input
											id={field.name}
											type="text"
											placeholder="My awesome playlist..."
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											autoFocus
										/>
										{field.state.meta.errors.length > 0 && (
											<FieldError
												errors={field.state.meta.errors.map((err) => ({
													message: typeof err === "string" ? err : err?.message,
												}))}
											/>
										)}
									</Field>
								)}
							</form.Field>
							<DialogFooter className="mt-6">
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setDialogOpen(false);
										form.reset();
									}}
								>
									Cancel
								</Button>
								<form.Subscribe
									selector={(state) => [state.canSubmit, state.isSubmitting]}
								>
									{([canSubmit, isSubmitting]) => (
										<Button
											type="submit"
											disabled={!canSubmit || createMutation.isPending}
										>
											{createMutation.isPending || isSubmitting ? (
												<>
													<Loader2 className="w-4 h-4 animate-spin mr-2" />
													Creating...
												</>
											) : (
												"Create Playlist"
											)}
										</Button>
									)}
								</form.Subscribe>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			{/* Playlist Grid */}
			{isLoading ? (
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
					{Array.from({ length: 6 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholder
							key={i}
							className="rounded-lg bg-card p-3 animate-pulse"
						>
							<div className="aspect-square rounded-md bg-muted mb-3" />
							<div className="h-4 bg-muted rounded w-3/4 mb-2" />
							<div className="h-3 bg-muted rounded w-1/2" />
						</div>
					))}
				</div>
			) : !playlists || playlists.length === 0 ? (
				<div className="text-center py-12">
					<Music className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
					<p className="text-muted-foreground mb-4">No playlists yet</p>
					<Button onClick={() => setDialogOpen(true)}>
						<Plus className="w-4 h-4 mr-2" />
						Create your first playlist
					</Button>
				</div>
			) : (
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
					{playlists.map((playlist) => (
						<PlaylistCard key={playlist.id} playlist={playlist} />
					))}
				</div>
			)}
		</div>
	);
}
