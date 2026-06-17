# Strmly

Strmly is a desktop IPTV player built with Electron, React, TypeScript, Vite, and Tailwind CSS. It is designed for managing user-provided M3U and Xtream Codes playlists with live TV, movies, series, favorites, profiles, watch history, TMDB metadata, and a custom media player.

## Features

- M3U URL, local M3U file, and Xtream Codes playlist support
- Live TV, movie, and series views
- Multi-profile local configuration
- Favorites, recently watched items, and watch progress
- TMDB metadata, posters, cast, and episode images
- Built-in player with subtitles, audio tracks, speed controls, PiP, fullscreen, and external player support
- Playlist diagnostics and auto-update intervals
- Electron packaging with Windows NSIS support

## Legal Notice

Strmly does not provide, host, sell, or redistribute any TV channels, movies, series, streams, playlists, or IPTV subscriptions. Users are responsible for adding their own legal playlist sources and for complying with the laws and terms that apply to their content providers.

## Requirements

- Node.js 20 or newer
- npm

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file if you want TMDB metadata to work by default:

```bash
cp .env.example .env
```

Then set:

```bash
VITE_TMDB_API_KEY=your_tmdb_v3_api_key
```

You can also enter or change the TMDB API key inside the app settings.

## Development

Run the Vite development server:

```bash
npm run dev
```

Run the Electron app with the dev server:

```bash
npm run electron:dev
```

## Build

Create the production web build:

```bash
npm run build
```

Package the desktop app:

```bash
npm run dist
```

Linux packaging:

```bash
npm run dist:linux
```

## Local Data

Runtime data such as profiles, playlists, cache files, packaged builds, local environment files, and scratch files are ignored by Git. Do not commit real playlist URLs, Xtream credentials, generated installers, or personal profile data.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
