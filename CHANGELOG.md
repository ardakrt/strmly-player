# Changelog

## 1.5.24 - 2026-06-28

### Updates

- Added player quality/source controls, remembered playback preferences, and configurable next-episode autoplay.
- Restored simple pause/resume behavior while keeping playback controls and catalog performance improvements.

## 1.5.23 - 2026-06-28

### Fixes

- Refresh paused VOD streams from the current timestamp after a long pause to avoid decode/source errors when resuming series episodes.

## 1.5.22 - 2026-06-26

### Fixes

- Wait for FFmpeg to produce stream output before handing the proxy URL to the player.
- Surface early FFmpeg exit and startup timeout errors more clearly.

## 1.5.21 - 2026-06-26

### Fixes

- Fixed FFmpeg discovery and startup validation in packaged Linux builds.
- Bundled the FFmpeg static binary as an explicit release resource.
- Improved transcoding fallback errors when FFmpeg cannot start.

## 1.5.20 - 2026-06-26

### Fixes

- Fixed Linux TMDB cached image loading when app-file URLs are parsed without the home directory prefix.
- Fixed unreadable update download button text when the active accent color is white.

## 1.5.19 - 2026-06-26

### Fixes

- Fixed TMDB poster and backdrop loading from the local image cache on Linux builds.

## 1.5.2 - 2026-06-21

### Highlights

- Introduced a redesigned cinematic home showcase with TMDB backdrop-aware composition, smooth crossfades, subtle zoom motion, responsive title sizing, and poster-safe fallback layouts.
- Refreshed the main navigation with a responsive liquid-glass surface, compact scrolling state, clearer active navigation, streamlined profile controls, and improved keyboard/remote focus behavior.
- Redesigned home media cards with integrated titles and metadata, cleaner hover interactions, dynamic content badges, and improved visual hierarchy.

### Performance

- Deferred HLS and player UI loading until playback begins, reducing the initial application bundle and startup work.
- Isolated player state updates from the main application render tree for smoother playback controls and timeline updates.
- Moved playlist decoding and preprocessing into the worker pipeline and transferred playlist payloads as `ArrayBuffer` data.
- Added IndexedDB playlist storage for browser builds and optimized Electron configuration writes with memory caching and batched persistence.
- Added TMDB request deduplication, concurrency limits, and persistent cache expiration.

### Navigation and Accessibility

- Added spatial navigation support for keyboard and TV remote directional controls.
- Added consistent focus targets across live TV, movie, series, category, search, and navigation controls.
- Improved ARIA labels, active navigation state, and reduced-motion behavior.

### Visual Improvements

- Added backdrop color grading, restrained vignette and grain effects, staggered showcase copy animation, and carousel navigation controls.
- Improved TMDB image fitting by prioritizing backdrop artwork and using blurred background composition when only portrait artwork is available.
- Simplified the profile dropdown by removing nonessential playlist and item statistics.
- Improved responsive spacing, section transitions, CTA consistency, and liquid-glass contrast across the home experience.

### Fixes

- Fixed low-contrast media type badges when the active accent color is white.
- Removed excessive CTA glow and overly dark compact-navbar styling.
- Fixed duplicate playlist preprocessing and improved cached playlist type consistency.
