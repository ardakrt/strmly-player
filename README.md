<div align="center">

  <h1>Strmly</h1>

  <p><strong>Next-Generation Desktop IPTV & Media Streaming Client</strong></p>

  <p>
    A lightweight, performance-focused desktop media application for managing and playing M3U and Xtream Codes IPTV playlists. Powered by Electron, React, TypeScript, and HLS.js.
  </p>

  <p>
    <a href="https://electronjs.org"><img src="https://img.shields.io/badge/Electron-v42.0-1C1C1E?style=flat-square&logo=electron" alt="Electron" /></a>
    <a href="https://react.dev"><img src="https://img.shields.io/badge/React-v19.0-1C1C1E?style=flat-square&logo=react" alt="React" /></a>
    <a href="https://vite.dev"><img src="https://img.shields.io/badge/Vite-v8.0-1C1C1E?style=flat-square&logo=vite" alt="Vite" /></a>
    <a href="https://typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-v6.0-1C1C1E?style=flat-square&logo=typescript" alt="TypeScript" /></a>
    <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-v4.3-1C1C1E?style=flat-square&logo=tailwindcss" alt="Tailwind CSS" /></a>
    <a href="https://github.com/ardakrt/strmly-player/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-1C1C1E?style=flat-square" alt="License" /></a>
  </p>

  <br />

</div>

---

### Overview

Strmly is a modern, cross-platform desktop IPTV player designed for seamless streaming performance and elegant media organization. It provides full support for user-supplied M3U playlists and Xtream Codes servers, featuring rich TMDB metadata integration, local profile isolation, and a custom HLS media engine.

---

### Key Features

- **Playlist Integration** — Native parsing for M3U URLs, local `.m3u`/`.m3u8` files, and Xtream Codes API credentials.
- **Categorized Media Engine** — Dedicated interfaces for Live TV channels, Video-on-Demand (Movies), and TV Series with episode indexing.
- **TMDB Metadata Pipeline** — Automatic enrichment for posters, backdrops, episode guides, cast information, and plot summaries.
- **Custom HLS Player** — Advanced playback controls supporting multi-audio tracks, subtitle selection, playback speed adjustment, Picture-in-Picture (PiP), and external player delegation.
- **Multi-Profile Management** — Isolated local configuration profiles with independent watch histories, progress tracking, and favorites.
- **Cross-Platform Desktop Bundles** — Optimized builds for Windows (NSIS Installer) and Linux (AppImage).

---

### Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Shell & Core** | Electron (v42), Node.js (v24), ffmpeg-static |
| **Frontend Framework** | React (v19), TypeScript (v6), Vite (v8) |
| **Styling & Icons** | Tailwind CSS (v4), Lucide React |
| **Media Playback** | HLS.js, Custom HTML5 Video Interface |
| **Metadata Engine** | The Movie Database (TMDB v3 API) |
| **Build & Packaging** | Electron Builder, Vite, PostCSS |

---

### Project Structure

```
strmly-player/
├── electron/                # Main process, IPC handlers, and window management
├── src/                     # React application source code
│   ├── components/          # UI components (Player, Catalog, Profile Manager, Navigation)
│   ├── hooks/               # Custom hooks for HLS playback, data fetching, and state
│   ├── lib/                 # Playlist parsers, TMDB client, and storage utilities
│   ├── services/            # Xtream API and M3U sync services
│   └── styles/              # Global styles and Tailwind CSS imports
├── scripts/                 # Automated test suites (Security, Catalog, Migration, A11y)
└── build/                   # Packaging assets and icons
```

---

### Getting Started

#### Prerequisites

- Node.js (v20 or higher)
- npm (v10 or higher)

#### 1. Repository Setup

```bash
git clone https://github.com/ardakrt/strmly-player.git
cd strmly-player
npm install
```

#### 2. Environment Configuration

Create a `.env` file in the root directory to enable TMDB metadata enrichment:

```bash
cp .env.example .env
```

Define your TMDB API key:

```env
VITE_TMDB_API_KEY=your_tmdb_v3_api_key
```

*Note: You can also configure or update your TMDB API key directly within the application settings.*

#### 3. Development Mode

Launch Vite dev server:

```bash
npm run dev
```

Launch Electron desktop application connected to dev server:

```bash
npm run electron:dev
```

---

### Build & Distribution

Compile the web application assets:

```bash
npm run build
```

Package executable desktop binaries:

```bash
# Windows (NSIS Installer)
npm run dist

# Linux (AppImage)
npm run dist:linux
```

---

### Quality Assurance & Verification

Run the full verification suite (linting, type checking, security audits, and regression tests):

```bash
npm run verify
```

---

### Legal Notice

> [!IMPORTANT]
> Strmly does **not** host, provide, sell, or redistribute any TV channels, streams, movies, or IPTV subscriptions. Users are solely responsible for supplying their own legal content streams and adhering to the licensing agreements of their respective providers.

---

### License

Distributed under the MIT License. See `LICENSE` for details.

<div align="center">
  <br />
  <sub>Maintained by <a href="https://github.com/ardakrt">@ardakrt</a></sub>
</div>
