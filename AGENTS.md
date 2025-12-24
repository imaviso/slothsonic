# AGENTS.md

Instructions for AI agents working on this project.

## Project Overview

This is a web-based music player client for Subsonic/OpenSubsonic API servers (Navidrome, Airsonic, etc.). Built with React and modern tooling.

## Tech Stack

- **Runtime**: Bun
- **Framework**: React 19
- **Routing**: TanStack Router (file-based routing)
- **State Management**: TanStack Query for server state
- **Forms**: TanStack Form with Valibot validation (native Standard Schema support)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Linter/Formatter**: Biome

## Development

```bash
# Install dependencies
bun install

# Start dev server (runs on port 3000)
bun dev

# Type check
bunx tsc --noEmit

# Lint and format check
bun run check

# Format code
bun run format

# Lint code
bun run lint
```

## Linting & Formatting (Biome)

This project uses **Biome** for linting and formatting. Do NOT use ESLint or Prettier.

### Biome Configuration

- Indent style: tabs
- Quote style: double quotes
- Recommended rules enabled
- Auto organize imports

### Commands

```bash
# Check for lint and format issues
bun run check

# Format files
bun run format

# Lint files
bun run lint
```

### Key Rules

- Use `import type` for type-only imports
- Prefer const over let when possible
- No unused variables
- No explicit `any` types

## Project Structure

```
src/
├── components/
│   └── ui/           # shadcn/ui components
├── hooks/            # Custom React hooks
├── lib/
│   ├── auth.ts       # Authentication state management
│   ├── subsonic.ts   # Subsonic API utilities
│   └── utils.ts      # Utility functions (cn, etc.)
├── routes/           # TanStack Router file-based routes
│   ├── __root.tsx    # Root layout
│   └── index.tsx     # Home/Login page
└── main.tsx          # App entry point
```

## Key Patterns

### Adding shadcn/ui Components

```bash
bunx shadcn@latest add <component-name>
```

### Subsonic API Calls

Use the utilities in `src/lib/subsonic.ts`:

```typescript
import { buildApiUrl, ping } from "@/lib/subsonic"

// Test connection
const result = await ping(credentials)

// Build authenticated API URL
const url = await buildApiUrl("getArtists")
```

### Authentication

Use the `useAuth` hook from `src/lib/auth.ts`:

```typescript
import { useAuth } from "@/lib/auth"

const { isAuthenticated, credentials, login, logout } = useAuth()
```

### Form Validation with Valibot

TanStack Form supports Valibot natively via Standard Schema:

```typescript
import { useForm } from "@tanstack/react-form"
import * as v from "valibot"

const schema = v.object({
  field: v.pipe(v.string(), v.nonEmpty("Required")),
})

const form = useForm({
  defaultValues: { field: "" },
  validators: {
    onBlur: schema,
  },
  onSubmit: async ({ value }) => {
    // handle submit
  },
})
```

### Adding New Routes

Create a new file in `src/routes/`. TanStack Router auto-generates the route tree.

```typescript
// src/routes/albums.tsx
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/albums")({
  component: AlbumsPage,
})

function AlbumsPage() {
  return <div>Albums</div>
}
```

## CORS Handling

In development, a Vite plugin proxies requests to avoid CORS issues. The proxy intercepts `/subsonic-proxy/{encodedServerUrl}/rest/...` and forwards to the actual server.

For production, the Subsonic server must have CORS enabled, or deploy behind a reverse proxy.

## Subsonic API Reference

- API Docs: https://www.subsonic.org/pages/api.jsp
- OpenSubsonic Docs: https://opensubsonic.netlify.app/

### Authentication

Uses MD5 token authentication:
- `u`: username
- `t`: MD5(password + salt)
- `s`: random salt
- `v`: API version (1.16.1)
- `c`: client identifier
- `f`: response format (json)
