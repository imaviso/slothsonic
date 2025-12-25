import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useState } from "react";

import { star, unstar } from "@/lib/api";
import { cn } from "@/lib/utils";

interface StarButtonProps {
	id: string;
	type: "song" | "album" | "artist";
	isStarred: boolean;
	size?: "sm" | "md" | "lg";
	className?: string;
}

export function StarButton({
	id,
	type,
	isStarred: initialStarred,
	size = "md",
	className,
}: StarButtonProps) {
	const queryClient = useQueryClient();
	const [isStarred, setIsStarred] = useState(initialStarred);

	const starMutation = useMutation({
		mutationFn: async () => {
			const options =
				type === "song"
					? { id }
					: type === "album"
						? { albumId: id }
						: { artistId: id };

			if (isStarred) {
				await unstar(options);
			} else {
				await star(options);
			}
		},
		onMutate: () => {
			// Optimistic update
			setIsStarred(!isStarred);
		},
		onError: () => {
			// Revert on error
			setIsStarred(isStarred);
		},
		onSuccess: () => {
			// Invalidate relevant queries
			queryClient.invalidateQueries({ queryKey: ["starred"] });
			if (type === "album") {
				queryClient.invalidateQueries({ queryKey: ["album", id] });
				queryClient.invalidateQueries({ queryKey: ["albums"] });
			} else if (type === "artist") {
				queryClient.invalidateQueries({ queryKey: ["artist", id] });
				queryClient.invalidateQueries({ queryKey: ["artists"] });
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

	return (
		<button
			type="button"
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				starMutation.mutate();
			}}
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
