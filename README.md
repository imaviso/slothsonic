# Slothsonic

<img src="./assets/slothsonic.png" alt="Slothsonic" width="400" />

A modern desktop music player client for Subsonic/OpenSubsonic API servers (Navidrome, Airsonic, etc.).

**Note:** This is a personal project.

## Features

- Cross-platform desktop app (Windows, macOS, Linux)
- MPV audio backend for high-quality gapless playback
- MPRIS integration on Linux for media key support
- Fallback to web audio when MPV is unavailable

## Requirements

- [MPV](https://mpv.io/) - Required for the native audio backend (optional, falls back to web audio)

## Tech Stack

- **Desktop**: Electron
- **Audio Backend**: MPV (via node-mpv)
- **Runtime**: Bun
- **Framework**: React 19
- **Routing**: TanStack Router (file-based routing)
- **State Management**: TanStack Query for server state
- **Forms**: TanStack Form with Valibot validation
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Linter/Formatter**: Biome
- **Testing**: Vitest with React Testing Library

## Getting Started

### Development

```bash
# Install dependencies
bun install

# Run the Electron app in development mode
bun run electron:dev
```

This starts both the Vite dev server and Electron concurrently.

### Development with Nix

```bash
# Enter the development shell (includes bun, node, electron, mpv, etc.)
nix develop

# Then run as usual
bun install
bun run electron:dev
```

### Web-only Development

```bash
# Start Vite dev server only (no Electron)
bun dev
```

The web app will be available at http://localhost:3000.

## Installation

### Nix (Flakes)

```bash
# Run directly
nix run github:imaviso/slothsonic

# Or install to profile
nix profile install github:imaviso/slothsonic
```

Add to your NixOS or Home Manager configuration:

```nix
# flake.nix inputs
inputs.slothsonic.url = "github:imaviso/slothsonic";

# In your configuration
environment.systemPackages = [ inputs.slothsonic.packages.${system}.default ];
# or for Home Manager
home.packages = [ inputs.slothsonic.packages.${system}.default ];
```

The Nix package includes MPV and all required dependencies.

### Other Platforms

Download pre-built packages from the [Releases](https://github.com/imaviso/slothsonic/releases) page:

- **Windows**: NSIS installer or portable executable
- **macOS**: DMG or ZIP
- **Linux**: AppImage

## Building for Production

```bash
# Build for current platform
bun run electron:build

# Build for specific platforms
bun run electron:build:win     # Windows (NSIS installer + portable)
bun run electron:build:mac     # macOS (DMG + ZIP)
bun run electron:build:linux   # Linux (AppImage)
```

Built packages are output to the `release/` directory.

## Available Commands

```bash
# Development
bun dev                  # Start Vite dev server only
bun run electron:dev     # Start Electron + Vite dev server

# Building
bun run build            # Build web assets
bun run electron:build   # Build Electron app for current platform

# Testing & Linting
bun test                 # Run all tests
bun run check            # Lint and format check (Biome)
bun run format           # Format code (auto-fix)
bun run lint             # Lint code (auto-fix)

# Type checking
bunx tsc --noEmit
```

## Project Structure

```
electron/
├── main.js              # Electron main process
├── mpris.js             # Linux MPRIS integration
└── preload.cjs          # Preload script for IPC
src/
├── components/
│   ├── ui/              # shadcn/ui base components
│   └── *.tsx            # Application components
├── hooks/               # Custom React hooks
├── integrations/        # Third-party integrations
├── lib/
│   ├── api.ts           # Subsonic API functions and types
│   ├── audio-backend.ts # MPV/Web audio abstraction
│   ├── auth.ts          # Authentication state management
│   ├── player.ts        # Audio player state
│   ├── subsonic.ts      # Subsonic API utilities
│   ├── theme.ts         # Theme management
│   └── utils.ts         # Utility functions
├── routes/              # TanStack Router file-based routes
└── main.tsx             # App entry point
```

## MPV Configuration

Slothsonic automatically detects MPV in common locations:

- **Linux**: `/usr/bin/mpv`, `/usr/local/bin/mpv`, NixOS paths
- **macOS**: Homebrew paths (`/opt/homebrew/bin/mpv`)
- **Windows**: `C:\Program Files\mpv\mpv.exe`

You can also configure a custom MPV path in the application settings.

## API Reference

- Subsonic API Docs: https://www.subsonic.org/pages/api.jsp
- OpenSubsonic Docs: https://opensubsonic.netlify.app/

## License

MIT
