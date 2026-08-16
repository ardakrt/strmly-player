import { Clock, History, Search, Trash2, X } from "lucide-react";
import { ImageWithFallback } from "../ImageWithFallback";
import {
  resultLogo,
  resultTitle,
  type SpotlightMatch,
} from "./spotlightHelpers";

interface SpotlightHistoryViewProps {
  language: "tr" | "en";
  emptyPrompt: string;
  queryHistory: string[];
  recentSearches: SpotlightMatch[];
  onSelectQuery: (query: string) => void;
  onRemoveQuery: (query: string) => void;
  onClearQueries: () => void;
  onSelectRecent: (match: SpotlightMatch) => void;
  onRemoveRecent: (id: string) => void;
  onClearRecent: () => void;
}

export function SpotlightHistoryView({
  language,
  emptyPrompt,
  queryHistory,
  recentSearches,
  onSelectQuery,
  onRemoveQuery,
  onClearQueries,
  onSelectRecent,
  onRemoveRecent,
  onClearRecent,
}: SpotlightHistoryViewProps) {
  return (
    <div className="space-y-6">
      {queryHistory.length > 0 ? (
        <div>
          <div className="mb-2.5 flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-white/40">
              <History size={11} /> {language === "tr" ? "Arama Geçmişi" : "Search History"}
            </span>
            <button type="button" onClick={onClearQueries} className="text-xs font-bold text-white/40 hover:text-rose-400 transition cursor-pointer">
              {language === "tr" ? "Temizle" : "Clear"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {queryHistory.map((term) => (
              <div key={term} className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-3 pr-2 text-xs font-bold text-white/80 transition hover:border-white/25 hover:bg-white/[0.1]">
                <button type="button" aria-label={term} onClick={() => onSelectQuery(term)} className="flex min-w-0 cursor-pointer items-center gap-2 text-left">
                  <Clock aria-hidden="true" size={11} className="text-white/40" />
                  <span>{term}</span>
                </button>
                <button type="button" aria-label={language === "tr" ? `“${term}” arama geçmişinden kaldır` : `Remove “${term}” from search history`} onClick={() => onRemoveQuery(term)} className="-mr-1 grid h-6 w-6 place-items-center rounded-full text-white/45 hover:bg-rose-500 hover:text-white transition">
                  <X aria-hidden="true" size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {recentSearches.length > 0 ? (
        <div>
          <div className="mb-2.5 flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-white/40">
              <Clock size={11} /> {language === "tr" ? "Son İzlenen / Açılanlar" : "Recently Opened"}
            </span>
            <button type="button" onClick={onClearRecent} className="text-xs font-bold text-white/40 hover:text-white transition cursor-pointer">
              {language === "tr" ? "Temizle" : "Clear"}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {recentSearches.map((match, index) => {
              const type = String(match.type || "");
              const item = match.item;
              if (!item) return null;
              const title = resultTitle(match);
              const logo = resultLogo(match);
              const isPortrait = type === "movie" || type === "series";
              return (
                <div key={`recent-${type}-${item.id}-${index}`} className="group relative block overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition hover:border-white/30">
                  <button type="button" aria-label={title} onClick={() => onSelectRecent(match)} className="block w-full cursor-pointer text-left">
                    <div className={`relative w-full ${isPortrait ? "aspect-[2/3]" : "aspect-video"} bg-neutral-900`}>
                      <ImageWithFallback src={logo} name={title} group={item.group || ""} itemType={type === "live" || type === "series" ? type : "movie"} aspect={isPortrait ? "portrait" : "landscape"} cover fallbackToPlaylist />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-2">
                        <span className="line-clamp-1 text-xs font-bold text-white">{title}</span>
                      </div>
                    </div>
                  </button>
                  <button type="button" aria-label={language === "tr" ? `“${title}” öğesini son açılanlardan kaldır` : `Remove “${title}” from recently opened`} onClick={() => onRemoveRecent(String(item.id))} className="absolute right-2 top-2 z-[3] grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-black/70 text-white/70 opacity-0 transition hover:bg-rose-600 hover:text-white group-hover:opacity-100 focus-visible:opacity-100">
                    <Trash2 aria-hidden="true" size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {queryHistory.length === 0 && recentSearches.length === 0 ? (
        <div className="py-8 text-center text-white/35">
          <Search size={22} className="mx-auto mb-2 text-white/20" />
          <p className="m-0 text-xs font-semibold">{emptyPrompt}</p>
        </div>
      ) : null}
    </div>
  );
}
