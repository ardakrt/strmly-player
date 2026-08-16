import { useState, useMemo, useCallback } from "react";
import {
  Search,
  Play,
  HardDrive,
  X,
  FolderOpen,
  Pause,
  Film,
  Clapperboard,
  Download,
  ArrowUpDown,
} from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import { useDownloads } from "../hooks/useDownloads";
import type { AppProviderValue } from "../hooks/useAppProvider";
import { parseSeriesEpisodeInfo } from "../utils/seriesGroupers";
import {
  formatTotalSize,
  groupDownloadsHelper,
  isActiveStatus,
  parseSizeToMB,
  resolveGroupArtwork,
  type GroupedDownloadItem,
} from "./downloadsHelpers";
import {
  ActiveDownloadPanel,
  DownloadsContextMenu,
  LibraryPosterCard,
} from "./DownloadsViewParts";

interface DownloadsViewProps {
  app: AppProviderValue;
}
export function DownloadsView({ app }: DownloadsViewProps) {
  const { language, t } = useSettings();

  const {
    downloads,
    cancelDownload,
    retryDownload,
    deleteDownload,
    playDownload,
    pauseAll,
    resumeAll,
  } = useDownloads();

  const playDownloadInternal = useCallback(
    async (downloadId: string) => {
      const item = downloads.find((d) => d.id === downloadId);
      if (!item) return;

      let playUrl = item.playUrl;
      if (
        !playUrl &&
        item.status === "completed" &&
        window.electronAPI?.getSavedMediaInfo
      ) {
        try {
          const info = await window.electronAPI.getSavedMediaInfo({
            downloadId: item.id,
            type: item.type,
            name: item.name,
            streamUrl: item.streamUrl,
          });
          if (info?.exists && info.playUrl) {
            playUrl = info.playUrl;
          }
        } catch {
          // fall through
        }
      }

      if (playUrl) {
        app.playback.handlePlayStream({
          id: item.id,
          name: item.name,
          logo: item.logo || "",
          group: item.group,
          url: playUrl,
          type: item.type,
        });
        return;
      }

      if (item.filePath) {
        playDownload(downloadId);
        return;
      }

      if (item.streamUrl) {
        app.playback.handlePlayStream({
          id: item.id,
          name: item.name,
          logo: item.logo || "",
          group: item.group,
          url: item.streamUrl,
          type: item.type,
        });
      }
    },
    [downloads, app.playback, playDownload],
  );

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | "active" | "movie" | "series"
  >("all");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "size">("recent");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    group: GroupedDownloadItem;
  } | null>(null);

  const totalSizeMB = useMemo(() => {
    return downloads
      .filter((download) => download.status === "completed")
      .reduce((acc, download) => acc + parseSizeToMB(download.size), 0);
  }, [downloads]);

  const formattedTotalSize = useMemo(
    () => formatTotalSize(totalSizeMB),
    [totalSizeMB],
  );

  const filteredDownloads = useMemo(() => {
    const normalizedQuery = query
      .trim()
      .toLocaleLowerCase(language === "tr" ? "tr-TR" : undefined);

    const filteredRaw = downloads
      .filter((d) => {
        if (categoryFilter === "active") {
          return (
            d.status === "downloading" ||
            d.status === "pending" ||
            d.status === "paused"
          );
        }
        if (categoryFilter === "movie") {
          return d.type === "movie" && d.status === "completed";
        }
        if (categoryFilter === "series") {
          return d.type === "series" && d.status === "completed";
        }
        return true;
      })
      .filter((d) => {
        if (!normalizedQuery) return true;
        const haystack = `${d.name} ${d.group}`.toLocaleLowerCase(
          language === "tr" ? "tr-TR" : undefined,
        );
        return haystack.includes(normalizedQuery);
      });

    const grouped = groupDownloadsHelper(filteredRaw);

    return grouped.sort((a, b) => {
      const aActive = isActiveStatus(a.status);
      const bActive = isActiveStatus(b.status);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      if (sortBy === "name") {
        return a.name.localeCompare(b.name, language === "tr" ? "tr-TR" : undefined);
      }
      if (sortBy === "size") {
        return parseSizeToMB(b.size) - parseSizeToMB(a.size);
      }

      const aTime = a.completedAt || a.addedAt;
      const bTime = b.completedAt || b.addedAt;
      return bTime - aTime;
    });
  }, [downloads, language, query, categoryFilter, sortBy]);

  const activeGroups = useMemo(
    () => filteredDownloads.filter((g) => isActiveStatus(g.status)),
    [filteredDownloads],
  );

  const libraryGroups = useMemo(
    () => filteredDownloads.filter((g) => g.status === "completed"),
    [filteredDownloads],
  );

  const activeDownloadCards = useMemo(
    () => activeGroups.map((group) => ({
      ...group,
      logo: resolveGroupArtwork(group, app.catalog.allGroupedSeries),
    })),
    [activeGroups, app.catalog.allGroupedSeries],
  );

  const libraryDownloadCards = useMemo(
    () => libraryGroups.map((group) => ({
      ...group,
      logo: resolveGroupArtwork(group, app.catalog.allGroupedSeries),
    })),
    [libraryGroups, app.catalog.allGroupedSeries],
  );

  const handleOpenGroupDetails = (group: GroupedDownloadItem) => {
    // Series → full SeriesModal (all seasons/episodes from playlist, not only saved)
    if (group.type === "series") {
      const cleanTitle =
        group.seriesTitle ||
        parseSeriesEpisodeInfo(group.name).cleanTitle ||
        group.name;
      const titleKey = cleanTitle.toLowerCase();

      const preferEp =
        group.episodes.find((ep) => {
          const p = parseSeriesEpisodeInfo(ep.name);
          return (
            group.seasonNumber != null &&
            group.seasonNumber > 0 &&
            p.season === group.seasonNumber
          );
        }) || group.episodes[0];

      const flatItem = {
        id: preferEp.id,
        name: preferEp.name,
        group: preferEp.group || group.group || "",
        type: "series" as const,
        url: preferEp.streamUrl,
        logo: preferEp.logo || group.logo || "",
      };

      const match = app.catalog.allGroupedSeries?.find((s) => {
        const sTitle = parseSeriesEpisodeInfo(s.name).cleanTitle || s.name;
        return sTitle.toLowerCase() === titleKey;
      });

      if (match) {
        void app.catalog.handleOpenSeriesModalDirect(match, flatItem);
        return;
      }

      // Rebuild full series from live playlist siblings
      void app.catalog.handleOpenDetails(flatItem);
      return;
    }

    const primaryEpisode = group.episodes[0];
    if (group.status === "completed" && primaryEpisode?.playUrl) {
      playDownloadInternal(primaryEpisode.id);
      return;
    }

    const match = app.catalog.items.find(
      (m) =>
        m.type === "movie" &&
        m.name.toLowerCase() === group.name.toLowerCase(),
    );
    if (match) {
      void app.catalog.handleOpenDetails(match);
    } else {
      void app.catalog.handleOpenDetails({
        id: group.id,
        name: group.name,
        group: group.group,
        type: "movie",
        url: group.episodes[0].streamUrl,
        logo: group.logo || "",
      });
    }
  };

  const handlePauseGroup = (group: GroupedDownloadItem) => {
    group.episodes.forEach((ep) => {
      if (ep.status === "downloading" || ep.status === "pending") {
        cancelDownload(ep.id);
      }
    });
  };

  const handleResumeGroup = (group: GroupedDownloadItem) => {
    group.episodes.forEach((ep) => {
      if (ep.status === "paused" || ep.status === "failed") {
        retryDownload(ep.id);
      }
    });
  };

  const handleDeleteGroup = (group: GroupedDownloadItem) => {
    group.episodes.forEach((ep) => {
      deleteDownload(ep.id);
    });
  };

  const libraryStats = useMemo(() => {
    const all = groupDownloadsHelper(downloads);
    const series = all.filter((g) => g.type === "series").length;
    const movies = all.filter((g) => g.type === "movie").length;
    const activeCount = downloads.filter((d) =>
      isActiveStatus(d.status),
    ).length;
    return { series, movies, total: all.length, activeCount };
  }, [downloads]);

  const hasActiveDownloads = downloads.some(
    (d) => d.status === "downloading" || d.status === "pending",
  );
  const hasPausedOrFailed = downloads.some(
    (d) => d.status === "paused" || d.status === "failed",
  );

  const filterPills = useMemo(
    () =>
      [
        {
          id: "all" as const,
          label: language === "tr" ? "Tümü" : "All",
          count: libraryStats.total,
        },
        {
          id: "active" as const,
          label: language === "tr" ? "Aktif" : "Active",
          count: libraryStats.activeCount,
        },
        {
          id: "movie" as const,
          label: language === "tr" ? "Filmler" : "Movies",
          count: libraryStats.movies,
        },
        {
          id: "series" as const,
          label: language === "tr" ? "Diziler" : "Series",
          count: libraryStats.series,
        },
      ] as const,
    [language, libraryStats],
  );

  const emptyTitle =
    downloads.length === 0
      ? t("downloads.empty")
      : language === "tr"
        ? "Sonuç bulunamadı"
        : "No matches";

  const emptyDesc =
    downloads.length === 0
      ? t("downloads.emptyDesc")
      : language === "tr"
        ? "Farklı bir arama veya filtre dene."
        : "Try a different search or filter.";

  const activeFilter = filterPills.find((pill) => pill.id === categoryFilter);
  const completedMovieSizeMB = downloads
    .filter((download) => download.status === "completed" && download.type === "movie")
    .reduce((total, download) => total + parseSizeToMB(download.size), 0);
  const movieStoragePercent = totalSizeMB > 0
    ? Math.min(100, (completedMovieSizeMB / totalSizeMB) * 100)
    : 0;

  return (
    <div className="grid h-full min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-6 overflow-hidden animate-fade-in md:grid-cols-[218px_minmax(0,1fr)] md:grid-rows-1 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-6">
      <aside className="flex min-h-0 max-h-[38vh] flex-col overflow-y-auto p-1 select-none hide-scrollbar md:max-h-none">
        <div className="border-b border-white/5 px-1 pb-4">
          <div className="mb-2 inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
            <HardDrive size={11} />
            {language === "tr" ? "Kütüphane" : "Library"}
          </div>
          <h1 className="text-[22px] font-black tracking-tight text-white">
            {t("downloads.title")}
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">
            {language === "tr" ? "Çevrimdışı izleme alanın." : "Your offline viewing library."}
          </p>
        </div>

        <nav className="mt-4 flex flex-col gap-1" aria-label={language === "tr" ? "Kaydedilen filtreleri" : "Saved filters"}>
          {filterPills.map((pill) => {
            const active = categoryFilter === pill.id;
            const PillIcon = pill.id === "movie"
              ? Film
              : pill.id === "series"
                ? Clapperboard
                : pill.id === "active"
                  ? Download
                  : HardDrive;
            return (
              <button
                type="button"
                key={pill.id}
                onClick={() => setCategoryFilter(pill.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition-all  cursor-pointer ${
                  active
                    ? "bg-white text-black font-bold shadow-md"
                    : "text-neutral-400 hover:bg-white/5 hover:text-white"
                }`}
                aria-current={active ? "true" : undefined}
              >
                <PillIcon size={14} className={active ? "text-black" : "text-neutral-400"} />
                <span className="min-w-0 flex-1 truncate">{pill.label}</span>
                <span className={`min-w-[1.4rem] rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums ${active ? "bg-black/10 text-black" : "bg-white/5 text-neutral-400"}`}>
                  {pill.count}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-5 rounded-2xl bg-white/[0.03] border border-white/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                {language === "tr" ? "Kullanılan Alan" : "Storage Used"}
              </p>
              <p className="mt-1 text-base font-extrabold tracking-tight text-white">{formattedTotalSize}</p>
            </div>
            <HardDrive size={16} className="text-neutral-500" />
          </div>
          <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-white/10">
            {totalSizeMB > 0 && (
              <>
                <span className="h-full bg-white" style={{ width: `${movieStoragePercent}%` }} />
                <span className="h-full flex-1 bg-white/30" />
              </>
            )}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10px] font-semibold text-neutral-400">
            <span>{libraryStats.movies} {language === "tr" ? "film" : "movies"}</span>
            <span>{libraryStats.series} {language === "tr" ? "dizi" : "series"}</span>
          </div>
        </div>

        <div className="mt-auto space-y-2 pt-5">
          {hasActiveDownloads ? (
            <button
              type="button"
              onClick={pauseAll}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 text-xs font-bold text-white transition-all outline-none focus:outline-none focus-visible:outline-none cursor-pointer "
            >
              <Pause size={13} fill="currentColor" />
              {language === "tr" ? "Tümünü duraklat" : "Pause all"}
            </button>
          ) : hasPausedOrFailed ? (
            <button
              type="button"
              onClick={resumeAll}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white active:bg-white/90 text-xs font-bold text-black transition-all outline-none focus:outline-none focus-visible:outline-none cursor-pointer  shadow-md"
            >
              <Play size={12} fill="currentColor" />
              {language === "tr" ? "Tümünü başlat" : "Resume all"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void window.electronAPI?.openDownloadsFolder?.()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-xs font-semibold text-neutral-300 hover:text-white transition-all outline-none focus:outline-none focus-visible:outline-none cursor-pointer "
          >
            <FolderOpen size={14} />
            {language === "tr" ? "Klasörü aç" : "Open folder"}
          </button>
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <header className="flex min-h-[64px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4 px-1">
          <div className="min-w-0">
            <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
              {language === "tr" ? "Kaydedilenler" : "Saved"}
            </p>
            <div className="flex items-center gap-2.5">
              <h2 className="truncate text-[18px] font-bold tracking-[-0.02em] text-white/92 lg:text-[20px]">
                {activeFilter?.label}
              </h2>
              {libraryStats.activeCount > 0 && categoryFilter !== "movie" && categoryFilter !== "series" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/15 bg-emerald-400/[0.08] px-2 py-0.5 text-[9px] font-semibold text-emerald-300/85">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {libraryStats.activeCount} {language === "tr" ? "aktif" : "active"}
                </span>
              )}
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <div className="relative w-[190px] lg:w-[230px]">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/28" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={language === "tr" ? "Kaydedilenlerde ara…" : "Search saved…"} className="h-9 w-full rounded-xl border border-white/[0.07] bg-black/15 pl-9 pr-8 text-[11px] font-medium text-white outline-none placeholder:text-white/25 focus:border-white/14 focus:bg-white/[0.035]" />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-white/30 hover:bg-white/[0.07] hover:text-white cursor-pointer" aria-label={language === "tr" ? "Aramayı temizle" : "Clear search"}>
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="relative">
              <ArrowUpDown size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as "recent" | "name" | "size")} className="h-9 appearance-none rounded-xl border border-white/[0.07] bg-[#101012] pl-8 pr-7 text-[10.5px] font-semibold text-white/52 outline-none transition-colors hover:bg-white/[0.05] focus:border-white/14 cursor-pointer" aria-label={language === "tr" ? "Sıralama" : "Sort"}>
                <option value="recent">{language === "tr" ? "Son eklenen" : "Most recent"}</option>
                <option value="name">{language === "tr" ? "Ada göre" : "Name"}</option>
                <option value="size">{language === "tr" ? "Boyuta göre" : "Size"}</option>
              </select>
            </div>
            <span className="hidden shrink-0 rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[10px] font-semibold tabular-nums text-white/38 sm:inline-flex">
              {filteredDownloads.length}
            </span>
          </div>
        </header>

        <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8 pt-4 lg:px-5 lg:pt-5">
          {filteredDownloads.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center py-20 text-center select-none">
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-[20px] border border-white/[0.07] bg-white/[0.035] text-white/30 shadow-[0_14px_40px_rgba(0,0,0,0.25)]">
                <Download size={24} />
              </div>
              <p className="text-sm font-semibold text-white/58">{emptyTitle}</p>
              <p className="mt-2 max-w-sm text-[11.5px] leading-relaxed text-white/30">{emptyDesc}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
          {/* ── Active queue ── */}
          {activeGroups.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/45">
                    {language === "tr" ? "Devam eden" : "In progress"}
                  </h2>
                  <span className="h-px w-10 bg-gradient-to-r from-white/20 to-transparent" />
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-white/30">
                  {activeGroups.length}
                </span>
              </div>

              <div className="grid gap-3 2xl:grid-cols-2">
                {activeDownloadCards.map((group) => (
                  <ActiveDownloadPanel
                    key={group.id}
                    download={group}
                    language={language}
                    onPlay={handleOpenGroupDetails}
                    onCancel={handlePauseGroup}
                    onRetry={handleResumeGroup}
                    onDelete={handleDeleteGroup}
                    onContextMenu={(x, y, g) =>
                      setContextMenu({ x, y, group: g })
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Library grid ── */}
          {libraryGroups.length > 0 && (
            <section className="flex flex-col gap-4">
              {activeGroups.length > 0 && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/45">
                      {language === "tr" ? "Hazır" : "Ready"}
                    </h2>
                    <span className="h-px w-10 bg-gradient-to-r from-white/20 to-transparent" />
                  </div>
                  <span className="text-[11px] font-semibold tabular-nums text-white/30">
                    {libraryGroups.length}
                  </span>
                </div>
              )}

              <div className="downloads-library-grid grid justify-start gap-x-4 gap-y-7 [grid-template-columns:repeat(auto-fill,minmax(220px,300px))]">
                {libraryDownloadCards.map((group) => (
                  <LibraryPosterCard
                    key={group.id}
                    download={group}
                    language={language}
                    onActivate={() => handleOpenGroupDetails(group)}
                    onDelete={() => handleDeleteGroup(group)}
                    onContextMenu={(x, y) =>
                      setContextMenu({ x, y, group })
                    }
                  />
                ))}
              </div>
            </section>
          )}
            </div>
          )}
        </div>
      </section>

      {contextMenu && (
        <DownloadsContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          group={contextMenu.group}
          downloads={downloads}
          onClose={() => setContextMenu(null)}
          onDelete={deleteDownload}
          onPlay={handleOpenGroupDetails}
          onRetry={retryDownload}
          language={language}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Active download panel — compact dock (macOS / Apple TV style)
   Contained width, poster + stacked meta + progress, no empty ocean
   ═══════════════════════════════════════════════════════════════ */
