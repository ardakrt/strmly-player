# Strmly

Strmly is a desktop IPTV player built with Electron, React, TypeScript, Vite, and Tailwind CSS. It plays user-provided M3U and Xtream Codes playlists and organizes live TV, movies, series, favorites, profiles, watch history, and TMDB metadata in one desktop app.

## Features

- M3U URL, local M3U file, and Xtream Codes playlist support
- Live TV, movie, and series views
- Multi-profile local configuration
- Favorites, recently watched items, and watch progress
- TMDB metadata, posters, cast, and episode images
- Built-in player with subtitles, audio tracks, speed controls, PiP, fullscreen, and external player support
- Playlist auto-update intervals
- Windows NSIS installer plus Linux AppImage and Debian (`.deb`) packages

## Legal Notice

Strmly does not provide, host, sell, or redistribute any TV channels, movies, series, streams, playlists, or IPTV subscriptions. Users are responsible for adding their own legal playlist sources and for complying with the laws and terms that apply to their content providers.

## Requirements

- Node.js 20 or newer
- npm
- A supported 64-bit Windows or Linux system

On Debian/Ubuntu, development dependencies can be installed with:

```bash
sudo apt install nodejs npm ffmpeg libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils
```

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

Package the desktop app for the current operating system:

```bash
npm run dist
```

The packages are written to `dist-electron/`. Explicit platform commands are
also available:

```bash
npm run dist:linux
npm run dist:win
```

Run the AppImage after making it executable:

```bash
chmod +x dist-electron/Strmly-*-linux-*.AppImage
./dist-electron/Strmly-*-linux-*.AppImage
```

Or install the Debian package:

```bash
sudo apt install ./dist-electron/Strmly-*-linux-*.deb
```

VLC and MPV are optional. Install either application if you want to use the
external-player feature. The built-in compatibility player uses the system
FFmpeg on Linux and falls back to the bundled binary only when necessary.

## Local Data

Runtime data such as profiles, playlists, cache files, packaged builds, local environment files, and scratch files are ignored by Git. Do not commit real playlist URLs, Xtream credentials, generated installers, or personal profile data.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
