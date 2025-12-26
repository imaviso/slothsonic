# AGENTS.md

Instructions for AI agents working on this project.

## Project Overview

This is a web-based music player client for Subsonic/OpenSubsonic API servers (Navidrome, Airsonic, etc.). Built with React 19 and modern tooling.

## Tech Stack

- **Runtime**: Bun
- **Framework**: React 19
- **Routing**: TanStack Router (file-based routing)
- **State Management**: TanStack Query for server state
- **Forms**: TanStack Form with Valibot validation (native Standard Schema support)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Linter/Formatter**: Biome
- **Testing**: Vitest with React Testing Library

## Build/Lint/Test Commands

```bash
# Install dependencies
bun install

# Start dev server (runs on port 3000)
bun dev

# Production build
bun run build

# Type check only
bunx tsc --noEmit

# Run all tests
bun test

# Run a single test file
bun test path/to/file.test.ts

# Run tests matching a pattern
bun test -t "pattern"

# Lint and format check (use this before committing)
bun run check

# Format code (auto-fix)
bun run format

# Lint code (auto-fix)
bun run lint
```

## Code Style Guidelines

### Formatting (Biome)

This project uses **Biome** for linting and formatting. Do NOT use ESLint or Prettier.

- **Indentation**: Tabs (not spaces)
- **Quotes**: Double quotes for strings
- **Semicolons**: Required
- **Trailing commas**: Yes
- **Line width**: Default (80 characters soft limit)

### Import Organization

Imports are auto-organized by Biome. Follow this order:

1. External packages (react, tanstack, etc.)
2. Internal aliases (`@/` imports)
3. Relative imports

```typescript
// External packages first
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Music } from "lucide-react";

// Internal imports with @/ alias
import type { Album } from "@/lib/api";
import { getCoverArtUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

// Relative imports last
import { AlbumCard } from "./AlbumCard";
```

### Type Imports

Use `import type` for type-only imports (enforced by Biome):

```typescript
// Correct
import type { Album, Song } from "@/lib/api";
import { getAlbum } from "@/lib/api";

// Also correct (mixed)
import { type Album, getAlbum } from "@/lib/api";
```

### Naming Conventions

- **Components**: PascalCase (`AlbumCard`, `SongList`)
- **Files**: Match export name (`AlbumCard.tsx`, `use-mobile.ts`)
- **Hooks**: camelCase with `use` prefix (`useAuth`, `useIsMobile`)
- **Utilities**: camelCase (`formatDuration`, `buildApiUrl`)
- **Interfaces/Types**: PascalCase (`SubsonicCredentials`, `Album`)
- **Constants**: SCREAMING_SNAKE_CASE (`AUTH_STORAGE_KEY`)

### Component Structure

```typescript
// 1. Imports
import { useState } from "react";
import type { Album } from "@/lib/api";

// 2. Types/Interfaces
interface AlbumCardProps {
	album: Album;
	className?: string;
}

// 3. Component function
export function AlbumCard({ album, className }: AlbumCardProps) {
	// Hooks first
	const [coverUrl, setCoverUrl] = useState<string | null>(null);

	// Event handlers
	const handleClick = () => {};

	// Render
	return <div className={className}>{album.name}</div>;
}
```

### Error Handling

- API functions throw errors with descriptive messages
- Use try/catch in components or let TanStack Query handle errors
- Empty catch blocks are allowed for non-critical operations

```typescript
// API function pattern
if (data["subsonic-response"].status !== "ok") {
	throw new Error(
		data["subsonic-response"].error?.message || "Failed to fetch album",
	);
}

// Non-critical error handling
try {
	const stored = localStorage.getItem(key);
	return stored ? JSON.parse(stored) : null;
} catch {
	// Invalid stored data, return default
	return null;
}
```

### Async Patterns

- Use async/await (not .then() chains)
- All API functions are async and return Promises

### React Patterns

- Use function components (no class components)
- Prefer named exports over default exports
- Use `useSyncExternalStore` for external state (see `src/lib/auth.ts`)
- Use TanStack Query for server state management

## Project Structure

```
src/
├── components/
│   ├── ui/           # shadcn/ui base components (do not modify directly)
│   └── *.tsx         # Application components
├── hooks/            # Custom React hooks
├── integrations/     # Third-party integrations
├── lib/
│   ├── api.ts        # Subsonic API functions and types
│   ├── auth.ts       # Authentication state management
│   ├── player.ts     # Audio player state
│   ├── subsonic.ts   # Subsonic API utilities (URL building, auth)
│   ├── theme.ts      # Theme management
│   └── utils.ts      # Utility functions (cn, etc.)
├── routes/           # TanStack Router file-based routes
│   ├── __root.tsx    # Root layout with devtools
│   ├── index.tsx     # Login page
│   └── app/          # Authenticated routes
└── main.tsx          # App entry point
```

## Key Patterns

### Adding shadcn/ui Components

```bash
bunx shadcn@latest add <component-name>
```

### TanStack Router (File-Based Routing)

Routes are auto-generated. Create files in `src/routes/`:

```typescript
// src/routes/app/albums/index.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/albums/")({
	component: AlbumsPage,
});

function AlbumsPage() {
	return <div>Albums</div>;
}
```

### TanStack Query

```typescript
const { data, isLoading, error } = useQuery({
	queryKey: ["album", albumId],
	queryFn: () => getAlbum(albumId),
});
```

### Form Validation with Valibot

```typescript
import { useForm } from "@tanstack/react-form";
import * as v from "valibot";

const schema = v.object({
	field: v.pipe(v.string(), v.nonEmpty("Required")),
});

const form = useForm({
	defaultValues: { field: "" },
	validators: { onBlur: schema },
	onSubmit: async ({ value }) => {},
});
```

### Styling with Tailwind + cn()

```typescript
import { cn } from "@/lib/utils";

<div className={cn(
	"base-classes",
	conditional && "conditional-classes",
	className,
)} />
```

## Subsonic API Reference

- API Docs: https://www.subsonic.org/pages/api.jsp
- OpenSubsonic Docs: https://opensubsonic.netlify.app/

### Authentication

Uses MD5 token authentication. See `src/lib/subsonic.ts` for implementation.

## Files to Avoid Modifying

- `src/components/ui/*` - shadcn/ui components (regenerated by CLI)
- `src/routeTree.gen.ts` - Auto-generated by TanStack Router
- `src/styles.css` - Base Tailwind styles
