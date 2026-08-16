# Canlı TV "Channel Deck" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Canlı TV sayfasını, spec (`docs/superpowers/specs/2026-08-08-live-tv-channel-deck-design.md`) doğrultusunda "Channel Deck" kompozisyonuyla (son izlenenler + favoriler rafları, kategori rafları, drawer, sanallaştırılmış ızgara) sıfırdan inşa etmek.

**Architecture:** SeriesView kabuk deseni (full-bleed scrollport + statik header + SeriesScrollbar + sağ drawer) yeniden kullanılır; içerik katmanı kanal odaklı yeni bileşenlerden oluşur: `LiveChannelTile`, `LiveRail`, `LiveCategoryDrawer`. Veri akışı `useAppProvider`'a eklenen memoize `allLiveItems` + mevcut `uniqueRecentlyWatched` ile beslenir.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS 4, lucide-react, Vite/Electron. Test altyapısı yok — doğrulama `npm run typecheck` / `npm run verify` + manuel QA ile yapılır.

**Spec:** `docs/superpowers/specs/2026-08-08-live-tv-channel-deck-design.md`

---

## File Structure

| Dosya | Sorumluluk |
|---|---|
| Create `src/components/live/channelHelpers.ts` | `getQualityBadge` + `cleanChannelName` (LiveTvView'den taşınır) |
| Create `src/components/live/LiveChannelCard.tsx` | Eski liste kartı — FavoritesView kullanmaya devam eder |
| Create `src/components/live/LiveChannelTile.tsx` | Yeni 16:9 kanal tile'ı (raf + ızgara) |
| Create `src/components/live/LiveRail.tsx` | Yatay kanal rafı (ok butonları, skeleton, stagger) |
| Create `src/components/live/LiveCategoryDrawer.tsx` | Sağ kategori yönetim drawer'ı + `LiveCategoryManager` tipi |
| Modify `src/components/FavoritesView.tsx` | `LiveChannelCard` import yolu güncellenir |
| Modify `src/components/LiveTvView.tsx` | Tam yeniden yazım (shell + raflar + ızgara + drawer) |
| Modify `src/hooks/useAppProvider.ts` | `allLiveItems` memo + catalog'a ekleme |
| Modify `src/components/MainViewRouter.tsx` | Yeni prop'ları geçirir |

---

### Task 1: channelHelpers + LiveChannelCard taşıma

**Files:**
- Create: `src/components/live/channelHelpers.ts`
- Create: `src/components/live/LiveChannelCard.tsx`
- Modify: `src/components/FavoritesView.tsx:10`
- Modify: `src/components/LiveTvView.tsx` (yerel tanımları sil, import et)

- [ ] **Step 1: `src/components/live/channelHelpers.ts` oluştur**

```ts
// Shared helpers for live TV channel cards and tiles.

// Helper to extract stream quality from channel names
export const getQualityBadge = (name: string): string | null => {
  const upper = name.toUpperCase();
  if (/\b(4K|UHD|ULTRA\s*HD)\b/.test(upper)) return '4K';
  if (/\b(1080P?|FHD|FULL\s*HD)\b/.test(upper)) return 'FHD';
  if (/\b(720P?|HD)\b/.test(upper)) return 'HD';
  if (/\b(SD|480P?|576P?)\b/.test(upper)) return 'SD';
  return null;
};

// Helper to clean resolution garbage from names for display
export const cleanChannelName = (name: string): string => {
  return name
    .replace(/\[\s*(4K|UHD|ULTRA\s*HD|FHD|FULL\s*HD|HD|SD|1080P?|720P?|576P?|480P?|50FPS|60FPS|HEVC|H265|RAW)\s*\]/gi, '')
    .replace(/\(\s*(4K|UHD|ULTRA\s*HD|FHD|FULL\s*HD|HD|SD|1080P?|720P?|576P?|480P?|50FPS|60FPS|HEVC|H265|RAW)\s*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};
```

- [ ] **Step 2: `src/components/live/LiveChannelCard.tsx` oluştur**

Mevcut `LiveTvView.tsx` içindeki `LiveChannelCard` bileşenini (satır 58-143) **birebir** taşı; yalnızca import'lar değişir:

```tsx
import React from 'react';
import { Heart, Tv } from 'lucide-react';
import type { PlaylistItem } from '../../utils/m3uParser';
import { useSettings } from '../../context/SettingsContext';
import { getQualityBadge, cleanChannelName } from './channelHelpers';

// 1. Compact Channel Row Card (List View) — used by FavoritesView.
export const LiveChannelCard = React.memo(({
  channel,
  onClick,
  isOnline,
  isFavorite,
  onToggleFavorite,
  onContextMenu,
  onActive,
  isActive
}: {
  channel: PlaylistItem;
  onClick: (item: PlaylistItem) => void;
  isOnline: 'online' | 'offline' | undefined;
  isFavorite: boolean;
  onToggleFavorite: (itemId: string, e: React.MouseEvent) => void;
  onContextMenu?: (event: React.MouseEvent, item: PlaylistItem) => void;
  onActive?: (channel: PlaylistItem) => void;
  isActive?: boolean;
}) => {
  const { language } = useSettings();
  const quality = getQualityBadge(channel.name);
  const cleanedName = cleanChannelName(channel.name);

  return (
    <div
      onClick={() => onClick(channel)}
      onContextMenu={(event) => onContextMenu?.(event, channel)}
      onMouseEnter={() => onActive?.(channel)}
      onFocus={() => onActive?.(channel)}
      role="button"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(channel); }}
      className={`group flex items-center justify-between p-2 pl-3.5 rounded-xl transition-all focusable-item cursor-pointer border ${
        isActive
          ? 'bg-white/[0.06] border-white/10 border-l-[3px] border-l-[var(--accent-color)] pl-[11px] shadow-md shadow-black/20 scale-[1.01]'
          : 'bg-neutral-900/30 hover:bg-white/5 border-transparent hover:border-white/10'
      }`}
      tabIndex={0}
      style={{ height: '56px' }}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-10 h-10 rounded-full bg-gradient-to-b from-neutral-900 to-neutral-950 border border-white/15 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
          {channel.logo ? (
            <img
              src={channel.logo}
              alt=""
              className="w-full h-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).src = ''; }}
            />
          ) : (
            <Tv size={14} className="text-neutral-500" />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="text-xs font-bold premium-card-title truncate">{cleanedName}</span>
            {quality && (
              <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-white/10 text-neutral-400 border border-white/5 uppercase tracking-wider shrink-0">
                {quality}
              </span>
            )}
          </div>
          <span className="text-[9px] font-semibold tracking-wider uppercase text-neutral-500 text-left truncate">{channel.group || (language === 'tr' ? 'Genel' : 'General')}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pr-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {isOnline && (
          <div
            className={`w-1.5 h-1.5 rounded-full border border-black/40 shadow-sm ${
              isOnline === 'online' ? 'bg-emerald-500' : 'bg-red-500'
            }`}
            title={isOnline === 'online' ? (language === 'tr' ? 'Çevrimiçi' : 'Online') : (language === 'tr' ? 'Çevrimdışı' : 'Offline')}
          />
        )}
        <button type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(channel.id, e); }}
          className="w-7 h-7 rounded-full bg-black/40 hover:bg-black border border-white/10 flex items-center justify-center text-neutral-300 hover:text-red-500 transition-all transform hover:scale-110 shadow-md cursor-pointer"
          title={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
          aria-label={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
        >
          <Heart size={12} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'text-red-500' : ''} />
        </button>
      </div>
    </div>
  );
});
```

- [ ] **Step 3: `FavoritesView.tsx` import'unu güncelle**

Satır 10'daki `import { LiveChannelCard } from './LiveTvView';` satırını şununla değiştir:

```ts
import { LiveChannelCard } from './live/LiveChannelCard';
```

- [ ] **Step 4: `LiveTvView.tsx` içinden taşınan kodu sil ve import et**

`LiveTvView.tsx`'de:
1. Satır 10-27'deki yerel `getQualityBadge` / `cleanChannelName` tanımlarını sil.
2. Satır 58-143'teki `LiveChannelCard` bileşen tanımını sil.
3. Import bloğuna ekle:

```ts
import { getQualityBadge, cleanChannelName } from './live/channelHelpers';
import { LiveChannelCard } from './live/LiveChannelCard';
```

(`LiveChannelGridCard` bu task'ta dokunulmadan kalır; Task 6'daki yeniden yazımda tamamen kalkar.)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: hatasız biter (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/components/live/channelHelpers.ts src/components/live/LiveChannelCard.tsx src/components/FavoritesView.tsx src/components/LiveTvView.tsx
git commit -m "refactor(live): extract channel helpers and LiveChannelCard into live/ folder"
```

---

### Task 2: LiveChannelTile

**Files:**
- Create: `src/components/live/LiveChannelTile.tsx`

- [ ] **Step 1: Bileşeni oluştur**

```tsx
import React from 'react';
import { Heart, Tv } from 'lucide-react';
import type { PlaylistItem } from '../../utils/m3uParser';
import { ImageWithFallback } from '../ImageWithFallback';
import { useSettings } from '../../context/SettingsContext';
import { getQualityBadge, cleanChannelName } from './channelHelpers';

/**
 * 16:9 glass channel tile used by showcase rails and the virtualized grid.
 * Name overlay reveals on hover/focus; badges (quality, online) stay visible.
 */
export const LiveChannelTile = React.memo(({
  channel,
  onClick,
  isOnline,
  isFavorite,
  onToggleFavorite,
  onContextMenu
}: {
  channel: PlaylistItem;
  onClick: (item: PlaylistItem) => void;
  isOnline: 'online' | 'offline' | undefined;
  isFavorite: boolean;
  onToggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  onContextMenu?: (event: React.MouseEvent, item: PlaylistItem) => void;
}) => {
  const { language } = useSettings();
  const quality = getQualityBadge(channel.name);
  const cleanedName = cleanChannelName(channel.name);

  return (
    <div
      onClick={() => onClick(channel)}
      onContextMenu={(event) => onContextMenu?.(event, channel)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(channel); } }}
      role="button"
      tabIndex={0}
      aria-label={cleanedName}
      className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-neutral-900/40 transition-all duration-200 focusable-item cursor-pointer hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.05] hover:shadow-[0_14px_40px_rgba(0,0,0,0.45)] focus-visible:-translate-y-0.5 focus-visible:border-white/[0.12]"
    >
      {/* Channel logo (playlist logo; live items never hit TMDB) */}
      {channel.logo ? (
        <ImageWithFallback src={channel.logo} name={cleanedName} itemType="live" aspect="landscape" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Tv size={22} className="text-neutral-600" />
        </div>
      )}

      {/* Quality badge */}
      {quality && (
        <span className="absolute left-2 top-2 z-20 rounded border border-white/5 bg-black/60 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider text-neutral-400">
          {quality}
        </span>
      )}

      {/* Online status + favorite action (top-right) */}
      <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5">
        {isOnline && (
          <span
            className={`h-1.5 w-1.5 rounded-full border border-black/40 shadow-sm ${
              isOnline === 'online' ? 'bg-emerald-500' : 'bg-red-500'
            }`}
            title={isOnline === 'online' ? (language === 'tr' ? 'Çevrimiçi' : 'Online') : (language === 'tr' ? 'Çevrimdışı' : 'Offline')}
          />
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(channel.id, e); }}
          className={`grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-black/65 text-neutral-300 shadow-md transition-all hover:scale-110 hover:text-red-500 focus-visible:opacity-100 cursor-pointer ${
            isFavorite ? 'opacity-100 text-red-500' : 'opacity-0 group-hover:opacity-100'
          }`}
          title={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
          aria-label={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
        >
          <Heart size={10} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'text-red-500' : ''} />
        </button>
      </div>

      {/* Name overlay — reveals on hover/focus */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-transparent p-2 pt-6 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="block w-full truncate text-center text-[10px] font-bold text-white/90">{cleanedName}</span>
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/live/LiveChannelTile.tsx
git commit -m "feat(live): add 16:9 glass LiveChannelTile card"
```

---

### Task 3: LiveRail

**Files:**
- Create: `src/components/live/LiveRail.tsx`

- [ ] **Step 1: Bileşeni oluştur**

`SeriesRail` iskeletinin kanal uyarlaması: sentinel lazy-mount, scroll-reveal stagger, `railArrowClass` ok butonları, skeleton placeholder.

```tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, History, Heart } from 'lucide-react';
import type { PlaylistItem } from '../../utils/m3uParser';
import { LiveChannelTile } from './LiveChannelTile';

export interface LiveRailProps {
  title: string;
  icon?: 'recent' | 'favorites';
  channels: PlaylistItem[];
  onChannelClick: (item: PlaylistItem) => void;
  favoritesSet: Set<string>;
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  openContextMenu: (event: React.MouseEvent, item: PlaylistItem) => void;
  checkedStatusMap: Record<string, 'online' | 'offline'>;
  seeAllCategory?: string;
  onSeeAll?: (category: string) => void;
  language: string;
  initialVisible?: boolean;
}

/**
 * Horizontal live channel rail. Mirrors SeriesRail: mounts tiles when the
 * sentinel nears the viewport, offscreen paint skipped via .lazy-row-shell.
 */
export const LiveRail = React.memo(({
  title,
  icon,
  channels,
  onChannelClick,
  favoritesSet,
  toggleFavorite,
  openContextMenu,
  checkedStatusMap,
  seeAllCategory,
  onSeeAll,
  language,
  initialVisible = false
}: LiveRailProps) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(initialVisible);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '2400px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setAnimateIn(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setAnimateIn(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const el = scrollRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateArrows) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      ro?.disconnect();
    };
  }, [visible, updateArrows]);

  const scrollPage = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  }, []);

  // Same rail arrow styling as the Home/Series rails
  const railArrowClass =
    'absolute top-[38%] -translate-y-1/2 z-30 w-9 h-9 rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur-xl flex items-center justify-center opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-all hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer focusable-item';

  return (
    <section className="lazy-row-shell mb-6" ref={sentinelRef}>
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <div className="flex min-w-0 items-center gap-2">
          {icon === 'recent' && <History size={11} className="shrink-0 text-white/40" />}
          {icon === 'favorites' && <Heart size={11} className="shrink-0 text-red-400/70" />}
          <h3 className="truncate text-[12.5px] font-bold tracking-tight text-white/85">{title}</h3>
          <span className="shrink-0 text-[10px] font-semibold tabular-nums text-white/28">{channels.length}</span>
        </div>
        {onSeeAll && seeAllCategory && (
          <button
            type="button"
            onClick={() => onSeeAll(seeAllCategory)}
            className="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-white/35 transition-colors hover:text-white/75 cursor-pointer focusable-item"
          >
            {language === 'tr' ? 'Tümünü Gör' : 'See All'}
          </button>
        )}
      </div>

      {!visible ? (
        <div className="flex gap-3 overflow-hidden px-0.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="w-52 shrink-0">
              <div className="aspect-video rounded-2xl border border-white/[0.05] skeleton-card-shimmer" />
            </div>
          ))}
        </div>
      ) : (
        <div className="group/row relative">
          <div
            ref={scrollRef}
            className="hide-scrollbar flex gap-3 overflow-x-auto scroll-smooth px-0.5 pb-1"
          >
            {channels.map((channel, index) => (
              <div
                key={channel.id}
                className={`w-52 shrink-0 ${animateIn ? 'series-card-enter' : ''}`}
                style={animateIn ? { animationDelay: `${Math.min(index, 8) * 45}ms` } : undefined}
              >
                <LiveChannelTile
                  channel={channel}
                  onClick={onChannelClick}
                  isOnline={checkedStatusMap[channel.id]}
                  isFavorite={favoritesSet.has(channel.id)}
                  onToggleFavorite={toggleFavorite}
                  onContextMenu={openContextMenu}
                />
              </div>
            ))}
          </div>

          {canLeft && (
            <button
              type="button"
              aria-label={language === 'tr' ? 'Sola kaydır' : 'Scroll left'}
              onClick={() => scrollPage(-1)}
              className={`${railArrowClass} left-1`}
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {canRight && (
            <button
              type="button"
              aria-label={language === 'tr' ? 'Sağa kaydır' : 'Scroll right'}
              onClick={() => scrollPage(1)}
              className={`${railArrowClass} right-1`}
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      )}
    </section>
  );
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/live/LiveRail.tsx
git commit -m "feat(live): add horizontal LiveRail with arrows and skeleton"
```

---

### Task 4: LiveCategoryDrawer

**Files:**
- Create: `src/components/live/LiveCategoryDrawer.tsx`

- [ ] **Step 1: Bileşeni oluştur**

`SeriesCategoryDrawer` ile aynı etkileşim dili; platform sınıflandırması yok (favoriler + diğerleri).

```tsx
import React from 'react';
import {
  Search, Heart, Trash2, X, Sparkles, LayoutGrid, SlidersHorizontal, GripVertical
} from 'lucide-react';

export interface LiveCategoryManager {
  editMode: boolean;
  setEditMode: (mode: boolean) => void;
  draggedCategory: string | null;
  handleDragStart: (e: React.DragEvent, group: string) => void;
  handleDrop: (e: React.DragEvent, group: string) => void;
  toggleFavorite: (group: string, e: React.MouseEvent) => void;
  handleHide: (group: string, e: React.MouseEvent) => void;
  filteredOtherCategories: string[];
}

interface LiveCategoryDrawerProps {
  open: boolean;
  onClose: () => void;
  liveCat: LiveCategoryManager;
  liveFavCatsToShow: string[];
  activeLiveCategory: string;
  setActiveLiveCategory: (cat: string) => void;
  setVisibleCount: (count: number) => void;
  categorySearchQuery: string;
  setCategorySearchQuery: (q: string) => void;
  visibleLiveCategoryLimit: number;
  setVisibleLiveCategoryLimit: React.Dispatch<React.SetStateAction<number>>;
  language: string;
  t: (key: string) => string;
}

const handleDragOverHelper = (e: React.DragEvent) => { e.preventDefault(); };

export const LiveCategoryDrawer = React.memo(({
  open,
  onClose,
  liveCat,
  liveFavCatsToShow,
  activeLiveCategory,
  setActiveLiveCategory,
  setVisibleCount,
  categorySearchQuery,
  setCategorySearchQuery,
  visibleLiveCategoryLimit,
  setVisibleLiveCategoryLimit,
  language,
  t
}: LiveCategoryDrawerProps) => {
  if (!open) return null;

  const renderRow = (group: string, favorite = false) => {
    const isActive = activeLiveCategory === group;
    return (
      <div
        key={`${favorite ? 'fav' : 'cat'}-${group}`}
        className={`relative flex items-center ${liveCat.draggedCategory === group ? 'opacity-40' : ''} ${
          liveCat.editMode ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        draggable={liveCat.editMode}
        onDragStart={(e) => liveCat.handleDragStart(e, group)}
        onDragOver={handleDragOverHelper}
        onDrop={(e) => liveCat.handleDrop(e, group)}
      >
        <button
          type="button"
          onClick={() => { setActiveLiveCategory(group); setVisibleCount(100); onClose(); }}
          className={`series-category-item relative ${isActive ? 'is-active' : ''} flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors focusable-item cursor-pointer ${
            liveCat.editMode ? 'pr-16' : ''
          } ${isActive ? 'border-white/[0.12] bg-white/[0.06] text-white' : 'border-transparent text-white/62 hover:bg-white/[0.04] hover:text-white/92'}`}
          aria-current={isActive ? 'true' : undefined}
        >
          {isActive && <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-white/90" aria-hidden="true" />}
          {liveCat.editMode && <GripVertical size={11} className="shrink-0 text-white/25" />}
          {favorite ? (
            <Heart size={11} fill="currentColor" className="shrink-0 text-red-400" />
          ) : (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
              <span className="text-[10px] font-black text-white/45">{group.slice(0, 1).toUpperCase()}</span>
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold">{group}</span>
        </button>

        {liveCat.editMode && (
          <div className="absolute right-1.5 z-20 flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => liveCat.toggleFavorite(group, e)}
              className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors cursor-pointer ${
                favorite ? 'text-red-400 hover:bg-red-400/10' : 'text-white/35 hover:bg-white/[0.06] hover:text-red-300'
              }`}
              title={favorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
            >
              <Heart size={11} fill={favorite ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              onClick={(e) => liveCat.handleHide(group, e)}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-red-400/10 hover:text-red-400 cursor-pointer"
              title={language === 'tr' ? 'Kategoriyi Kaldır' : 'Remove Category'}
            >
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="absolute inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-[2px] cursor-pointer" />
      <aside className="series-catalog-panel series-category-panel relative flex h-full w-[268px] flex-col overflow-hidden border-l border-white/[0.07] shadow-[-24px_0_60px_rgba(0,0,0,0.45)] animate-fade-in">
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
            <SlidersHorizontal size={11} />
            {language === 'tr' ? 'Kategoriler' : 'Categories'}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => liveCat.setEditMode(!liveCat.editMode)}
              className={`h-6 rounded-md border border-transparent px-1.5 text-[8.5px] font-bold uppercase transition-colors focusable-item cursor-pointer ${
                liveCat.editMode ? 'bg-white/[0.08] text-white' : 'text-white/35 hover:bg-white/[0.04] hover:text-white/70'
              }`}
            >
              {liveCat.editMode ? (language === 'tr' ? 'Bitti' : 'Done') : t('common.edit')}
            </button>
            <button type="button" onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white cursor-pointer" aria-label={language === 'tr' ? 'Kapat' : 'Close'}>
              <X size={13} />
            </button>
          </div>
        </div>

        <div className="relative shrink-0 px-3 pt-3">
          <Search size={12} className="pointer-events-none absolute left-6 top-1/2 mt-1.5 -translate-y-1/2 text-white/28" />
          <input
            type="text"
            placeholder={language === 'tr' ? 'Kategori ara…' : 'Search category…'}
            value={categorySearchQuery}
            onChange={(e) => setCategorySearchQuery(e.target.value)}
            className="h-8 w-full rounded-lg border border-white/[0.06] bg-black/15 pl-8 pr-3 text-[10.5px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/12 focus:bg-white/[0.035] focusable-item"
          />
        </div>

        <div className="custom-catalog-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
          <button
            type="button"
            onClick={() => { setActiveLiveCategory('Tümü'); setVisibleCount(100); onClose(); }}
            className={`series-category-item ${activeLiveCategory === 'Tümü' ? 'is-active' : ''} mb-1 flex w-full items-center rounded-lg border px-3 py-1.5 text-left text-[11.5px] font-medium transition-colors focusable-item cursor-pointer ${
              activeLiveCategory === 'Tümü' ? 'border-white/[0.07] text-white' : 'border-transparent text-white/52 hover:bg-white/[0.035] hover:text-white/82'
            }`}
            aria-current={activeLiveCategory === 'Tümü' ? 'true' : undefined}
          >
            <Sparkles size={11} className="mr-2 shrink-0 text-amber-400/80" />
            <span className="min-w-0 flex-1 truncate">{language === 'tr' ? 'Tüm Kanallar' : 'All Channels'}</span>
          </button>

          {liveFavCatsToShow.length > 0 && (
            <div className="mt-2 flex flex-col gap-0.5 border-t border-white/[0.05] pt-2">
              <span className="mb-1 flex items-center gap-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-red-400/45">
                <Heart size={10} /> {t('navbar.favorites')}
              </span>
              {liveFavCatsToShow.map((group) => renderRow(group, true))}
            </div>
          )}

          {liveCat.filteredOtherCategories.length > 0 && (
            <div className="mt-2 flex flex-col gap-0.5 border-t border-white/[0.05] pt-2">
              <span className="mb-1 flex items-center gap-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">
                <LayoutGrid size={9} /> {language === 'tr' ? 'Diğerleri' : 'Others'}
                <span className="tabular-nums text-white/25">{liveCat.filteredOtherCategories.length}</span>
              </span>
              {liveCat.filteredOtherCategories.slice(0, visibleLiveCategoryLimit).map((group) => renderRow(group))}
            </div>
          )}

          {liveCat.filteredOtherCategories.length > visibleLiveCategoryLimit && (
            <button
              type="button"
              onClick={() => setVisibleLiveCategoryLimit((prev) => prev + 50)}
              className="mt-2 w-full rounded-xl py-2 text-[10px] font-semibold tracking-wide text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white/70 focusable-item cursor-pointer"
            >
              {language === 'tr' ? 'Daha fazla' : 'Show more'} (+{liveCat.filteredOtherCategories.length - visibleLiveCategoryLimit})
            </button>
          )}

          {liveFavCatsToShow.length === 0 && liveCat.filteredOtherCategories.length === 0 && (
            <p className="px-2 py-8 text-center text-[10.5px] text-white/35">
              {language === 'tr' ? 'Kategori bulunamadı' : 'No categories found'}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/live/LiveCategoryDrawer.tsx
git commit -m "feat(live): add LiveCategoryDrawer with edit/drag/favorite/hide"
```

---

### Task 5: Provider + Router veri akışı

**Files:**
- Modify: `src/hooks/useAppProvider.ts` (favMovies memo'sundan sonra ~satır 387 + catalog nesnesi ~satır 634)
- Modify: `src/components/MainViewRouter.tsx:114-131`

- [ ] **Step 1: `useAppProvider.ts` — `allLiveItems` memo ekle**

`favMovies` memo'sunun hemen altına ekle:

```ts
  const allLiveItems = useMemo(() =>
    items.filter(item => item.type === 'live' || item.type === undefined),
    [items]
  );
```

- [ ] **Step 2: `useAppProvider.ts` — catalog nesnesine ekle**

`catalog` nesnesinde `favMovies,` satırının hemen altına ekle:

```ts
      allLiveItems,
```

- [ ] **Step 3: `MainViewRouter.tsx` — yeni prop'ları geçir**

`LiveTvView` bloğunda `filteredDisplayItems={catalog.favItems}` satırını şununla değiştir:

```tsx
            allLiveItems={catalog.allLiveItems}
            recentlyWatched={home.uniqueRecentlyWatched}
```

- [ ] **Step 4: Typecheck (beklenen: LiveTvView henüz prop'ları kabul etmediği için HATA)**

Run: `npm run typecheck`
Expected: FAIL — `Property 'allLiveItems' does not exist on type 'LiveTvViewProps'`. Bu beklenen durumdur; Task 6'daki yeniden yazım ile düzelir. Bu task'ta commit YOK — Task 6 ile birlikte commit edilir.

---

### Task 6: LiveTvView yeniden yazımı

**Files:**
- Modify (rewrite): `src/components/LiveTvView.tsx`

- [ ] **Step 1: `LiveTvView.tsx` dosyasını tamamen aşağıdaki içerikle değiştir**

Eski dosyadaki her şey (sidebar, liste/ızgara anahtarı, önizleme paneli, `LiveChannelGridCard`, `chunkedDisplayItems`, `strmly_livetv_*` localStorage okumaları) bu yazımla kalkar.

```tsx
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Search, Tv, X, SlidersHorizontal, ArrowLeft } from 'lucide-react';
import type { PlaylistItem } from '../utils/m3uParser';
import { VirtualizedGrid } from './VirtualizedGrid';
import { MediaCardContextMenu } from './MediaCardContextMenu';
import { AnimatedTicker } from './AnimatedTicker';
import { SeriesScrollbar } from './series/SeriesScrollbar';
import { useSettings } from '../context/SettingsContext';
import { APP_VIEWS } from '../navigation/views';
import { LiveChannelTile } from './live/LiveChannelTile';
import { LiveRail } from './live/LiveRail';
import { LiveCategoryDrawer, type LiveCategoryManager } from './live/LiveCategoryDrawer';

const MAX_ROW_ITEMS = 30;

interface LiveRailEntry {
  key: string;
  title: string;
  icon?: 'recent' | 'favorites';
  channels: PlaylistItem[];
  hasMore: boolean;
  category?: string;
}

interface LiveTvViewProps {
  selectedGroup: string;
  activeLiveCategory: string;
  setActiveLiveCategory: (cat: string) => void;
  categorySearchQuery: string;
  setCategorySearchQuery: (query: string) => void;
  liveFavCatsToShow: string[];
  liveCat: LiveCategoryManager;
  visibleLiveCategoryLimit: number;
  setVisibleLiveCategoryLimit: React.Dispatch<React.SetStateAction<number>>;
  allLiveItems: PlaylistItem[];
  recentlyWatched: PlaylistItem[];
  handleMainScroll: (e: React.UIEvent<HTMLElement>) => void;
  handlePlayStream: (item: PlaylistItem) => void;
  checkedStatusMap: Record<string, 'online' | 'offline'>;
  toggleFavorite: (itemId: string, e?: React.MouseEvent) => void;
  globalFavorites: string[];
  setVisibleCount: (count: number) => void;
}

export const LiveTvView = React.memo(function LiveTvView({
  selectedGroup,
  activeLiveCategory,
  setActiveLiveCategory,
  categorySearchQuery,
  setCategorySearchQuery,
  liveFavCatsToShow,
  liveCat,
  visibleLiveCategoryLimit,
  setVisibleLiveCategoryLimit,
  allLiveItems,
  recentlyWatched,
  handleMainScroll,
  handlePlayStream,
  checkedStatusMap,
  toggleFavorite,
  globalFavorites,
  setVisibleCount
}: LiveTvViewProps) {
  const { t, language } = useSettings();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: PlaylistItem } | null>(null);
  const [channelSearchInput, setChannelSearchInput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);
  const favoritesSet = useMemo(() => new Set(globalFavorites), [globalFavorites]);

  const searching = channelSearchInput.trim().length > 0;
  const singleCategory = activeLiveCategory !== 'Tümü';

  // Grid-mode list: category filter + toolbar search over the full live catalog
  const filteredList = useMemo(() => {
    let list = allLiveItems;
    if (singleCategory) list = list.filter((item) => item.group === activeLiveCategory);
    if (channelSearchInput.trim()) {
      const query = channelSearchInput.toLowerCase().trim();
      list = list.filter((item) => item.name.toLowerCase().includes(query));
    }
    return list;
  }, [allLiveItems, singleCategory, activeLiveCategory, channelSearchInput]);

  // Single-pass grouping for showcase rails
  const channelsByGroup = useMemo(() => {
    const map = new Map<string, PlaylistItem[]>();
    for (const item of allLiveItems) {
      const key = item.group || '';
      const arr = map.get(key);
      if (arr) arr.push(item);
      else map.set(key, [item]);
    }
    return map;
  }, [allLiveItems]);

  const recentLive = useMemo(
    () => recentlyWatched.filter((item) => item.type === 'live'),
    [recentlyWatched]
  );
  const favoriteLive = useMemo(
    () => allLiveItems.filter((item) => favoritesSet.has(item.id)),
    [allLiveItems, favoritesSet]
  );

  // Precompute capped rail entries once (memoized) so LiveRail's React.memo
  // never sees fresh arrays per render.
  const rowEntries = useMemo(() => {
    const entries: LiveRailEntry[] = [];
    const push = (key: string, title: string, icon: 'recent' | 'favorites' | undefined, all: PlaylistItem[], category?: string) => {
      if (all.length === 0) return;
      const hasMore = category !== undefined && all.length > MAX_ROW_ITEMS;
      entries.push({ key, title, icon, channels: all.slice(0, MAX_ROW_ITEMS), hasMore, category });
    };
    push('recent', language === 'tr' ? 'Son İzlenenler' : 'Recently Watched', 'recent', recentLive);
    push('favorites', language === 'tr' ? 'Favoriler' : 'Favorites', 'favorites', favoriteLive);
    liveFavCatsToShow.forEach((cat) => push(`fav-${cat}`, cat, undefined, channelsByGroup.get(cat) || [], cat));
    liveCat.filteredOtherCategories
      .slice(0, visibleLiveCategoryLimit)
      .forEach((cat) => push(`cat-${cat}`, cat, undefined, channelsByGroup.get(cat) || [], cat));
    return entries;
  }, [recentLive, favoriteLive, liveFavCatsToShow, liveCat.filteredOtherCategories, visibleLiveCategoryLimit, channelsByGroup, language]);

  const openContextMenu = useCallback((event: React.MouseEvent, item: PlaylistItem) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, item });
  }, []);

  const handleSeeAll = useCallback((category: string) => {
    setActiveLiveCategory(category);
    setVisibleCount(100);
  }, [setActiveLiveCategory, setVisibleCount]);

  const handleBackToAll = useCallback(() => {
    setChannelSearchInput('');
    setActiveLiveCategory('Tümü');
    setVisibleCount(100);
  }, [setActiveLiveCategory, setVisibleCount]);

  if (selectedGroup !== APP_VIEWS.live) return null;

  const activeTitle = singleCategory
    ? activeLiveCategory
    : (language === 'tr' ? 'Tüm Kanallar' : 'All Channels');
  const displayCount = singleCategory || searching ? filteredList.length : allLiveItems.length;

  const renderGrid = () => (
    <VirtualizedGrid
      items={filteredList}
      renderItem={(channel, index) => (
        <div
          key={channel.id}
          className="series-card-enter"
          style={{ animationDelay: `${(index % 7) * 40}ms` }}
        >
          <LiveChannelTile
            channel={channel}
            onClick={handlePlayStream}
            isOnline={checkedStatusMap[channel.id]}
            isFavorite={favoritesSet.has(channel.id)}
            onToggleFavorite={toggleFavorite}
            onContextMenu={openContextMenu}
          />
        </div>
      )}
    />
  );

  return (
    <div
      className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden page-transition-enter"
      onContextMenu={() => setContextMenu(null)}
    >
      {/* Full-bleed scroll shell like SeriesView: static header geometry,
          content scrolls under the floating transparent navbar. */}
      <section ref={scrollRef} className="hide-scrollbar relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-8" onScroll={handleMainScroll}>
        <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-5 pb-3.5 pt-[5.75rem] lg:px-6">
          <div className="min-w-0">
            {singleCategory || searching ? (
              <button
                type="button"
                onClick={handleBackToAll}
                className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.05] px-3 py-1 text-[10px] font-bold text-white/70 transition-all hover:border-white/[0.18] hover:bg-white/[0.1] hover:text-white cursor-pointer focusable-item"
                title={language === 'tr' ? 'Raflara Geri Dön' : 'Back to Rails'}
              >
                <ArrowLeft size={11} />
                {language === 'tr' ? 'Geri Dön' : 'Go Back'}
              </button>
            ) : (
              <p className="mb-0.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
                <Tv size={10} />
                {language === 'tr' ? 'Canlı TV' : 'Live TV'}
              </p>
            )}
            <h2 className="truncate text-[18px] font-bold tracking-[-0.02em] text-white/92 lg:text-[20px]">
              {activeTitle}
            </h2>
          </div>

          {/* Toolbar: centered on the title line */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.035] px-3 text-[10.5px] font-semibold text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white/85 focusable-item cursor-pointer"
                title={language === 'tr' ? 'Kategorileri Yönet' : 'Manage Categories'}
              >
                <SlidersHorizontal size={11} />
                <span className="hidden md:inline">{language === 'tr' ? 'Kategoriler' : 'Categories'}</span>
              </button>

              <div className="relative flex items-center">
                <Search size={12} className="pointer-events-none absolute left-3 text-white/28" />
                <input
                  type="text"
                  placeholder={language === 'tr' ? 'Kanal ara…' : 'Search channels…'}
                  value={channelSearchInput}
                  onChange={(e) => setChannelSearchInput(e.target.value)}
                  className="h-8 w-36 rounded-lg border border-white/[0.06] bg-black/15 pl-8 pr-7 text-[10.5px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/12 focus:bg-white/[0.035] focusable-item sm:w-48"
                />
                {channelSearchInput && (
                  <button type="button" onClick={() => setChannelSearchInput('')} className="absolute right-2.5 text-white/35 transition-colors hover:text-white cursor-pointer" aria-label={language === 'tr' ? 'Aramayı Temizle' : 'Clear search'}>
                    <X size={11} />
                  </button>
                )}
              </div>

              <span className="hidden items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[10px] font-semibold tabular-nums text-white/38 md:flex">
                <AnimatedTicker value={displayCount} />
                <span>{language === 'tr' ? 'kanal' : 'channels'}</span>
              </span>
            </div>
          </div>

          <div aria-hidden="true" />
        </header>

        <div className="flex min-h-full flex-col px-4 pt-4 lg:px-5 lg:pt-5">
          {allLiveItems.length === 0 ? (
            <div className="flex min-h-full flex-1 flex-col items-center justify-center py-20 text-center select-none">
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-[20px] border border-white/[0.07] bg-white/[0.035] text-white/30 shadow-[0_14px_40px_rgba(0,0,0,0.25)]">
                <Tv size={24} />
              </div>
              <h3 className="text-sm font-semibold text-white/55">
                {language === 'tr' ? 'Kanal bulunamadı' : 'No channels found'}
              </h3>
            </div>
          ) : singleCategory || searching ? (
            filteredList.length === 0 ? (
              <div className="flex min-h-full flex-1 flex-col items-center justify-center py-20 text-center select-none">
                <div className="mb-4 grid h-14 w-14 place-items-center rounded-[20px] border border-white/[0.07] bg-white/[0.035] text-white/30 shadow-[0_14px_40px_rgba(0,0,0,0.25)]">
                  <Tv size={24} />
                </div>
                <h3 className="text-sm font-semibold text-white/55">
                  {searching
                    ? (language === 'tr' ? 'Aramanızla eşleşen kanal bulunamadı' : 'No channels matched your search')
                    : (language === 'tr' ? 'Bu kategoride kanal bulunamadı' : 'No channels found in this category')}
                </h3>
                {searching && (
                  <button
                    type="button"
                    onClick={() => setChannelSearchInput('')}
                    className="mt-3.5 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-[11px] font-semibold text-white/70 transition-colors hover:bg-white/[0.09] hover:text-white cursor-pointer focusable-item"
                  >
                    {language === 'tr' ? 'Aramayı Temizle' : 'Clear Search'}
                  </button>
                )}
              </div>
            ) : (
              renderGrid()
            )
          ) : (
            rowEntries.map((entry) => (
              <LiveRail
                key={entry.key}
                title={entry.title}
                icon={entry.icon}
                channels={entry.channels}
                onChannelClick={handlePlayStream}
                favoritesSet={favoritesSet}
                toggleFavorite={toggleFavorite}
                openContextMenu={openContextMenu}
                checkedStatusMap={checkedStatusMap}
                seeAllCategory={entry.hasMore ? entry.category : undefined}
                onSeeAll={entry.hasMore ? handleSeeAll : undefined}
                language={language}
              />
            ))
          )}
        </div>
      </section>

      <SeriesScrollbar targetRef={scrollRef} />

      <LiveCategoryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        liveCat={liveCat}
        liveFavCatsToShow={liveFavCatsToShow}
        activeLiveCategory={activeLiveCategory}
        setActiveLiveCategory={setActiveLiveCategory}
        setVisibleCount={setVisibleCount}
        categorySearchQuery={categorySearchQuery}
        setCategorySearchQuery={setCategorySearchQuery}
        visibleLiveCategoryLimit={visibleLiveCategoryLimit}
        setVisibleLiveCategoryLimit={setVisibleLiveCategoryLimit}
        language={language}
        t={t}
      />

      {contextMenu && (
        <MediaCardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          isFavorite={favoritesSet.has(contextMenu.item.id)}
          onClose={() => setContextMenu(null)}
          onPlay={handlePlayStream}
          onToggleFavorite={(id) => toggleFavorite(id)}
        />
      )}
    </div>
  );
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0 (Task 5'teki prop hataları bu yazımla çözülür).

- [ ] **Step 3: Commit (Task 5 + Task 6 birlikte)**

```bash
git add src/hooks/useAppProvider.ts src/components/MainViewRouter.tsx src/components/LiveTvView.tsx
git commit -m "feat(live): rebuild Live TV as Channel Deck (rails + drawer + grid)"
```

---

### Task 7: Doğrulama ve manuel QA

- [ ] **Step 1: Tam doğrulama suiti**

Run: `npm run verify`
Expected: lint, typecheck:unused, migration/security/catalog/regressions/a11y testleri ve build — hepsi exit 0.

- [ ] **Step 2: Manuel QA — `npm run electron:dev` ile uygulamayı aç ve şunları doğrula**

1. Canlı TV sekmesi açılır: üstte "Son İzlenenler" (geçmiş varsa) ve "Favoriler" (favori varsa) rafları, altta kategori rafları görünür.
2. Tile hover: lift + beyaz glow + isim overlay + favori kalbi; kalp tıklandığında favori toggle olur.
3. Raf ok butonları kaydırır; "Tümünü Gör" → o kategorinin sanallaştırılmış ızgarası + stagger animasyonu; "← Geri Dön" raflara döner.
4. Toolbar arama → ızgara moduna geçip filtreler; X ile temizlenince raflara döner.
5. "Kategoriler" drawer açılır: kategori arama, Düzenle modu (sürükle-sırala, favori, gizle), "Daha fazla"; seçim ızgara moduna geçirir.
6. Sayaç pili doğru sayıyı gösterir (showcase: tüm kanal sayısı; grid: filtreli sayı).
7. Sağ tık → context menü (Oynat + Favori); tık → kanal oynatılır.
8. Favoriler sayfasındaki Canlı Kanallar bölümü eskisi gibi çalışır (taşınan LiveChannelCard).
9. Boş durumlar (arama eşleşmez / kanal yok) merkezli render olur.
10. Klavye ile Tab gezinme: tile'lar focus alır, Enter/Space oynatır, focus-visible isim overlay'i gösterir.

- [ ] **Step 3: QA bulgusu varsa düzelt ve `npm run verify` tekrar**

- [ ] **Step 4: Son commit**

```bash
git add -A
git commit -m "chore(live): final QA fixes for Channel Deck redesign"
```

(Eğer Step 3'te değişiklik yoksa bu commit atlanır.)
