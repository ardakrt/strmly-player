import { LoaderCircle, Play, Search } from "lucide-react";
import { ImageWithFallback } from "../ImageWithFallback";
import {
  resultLogo,
  resultTitle,
  typeLabel,
  type SpotlightMatch,
} from "./spotlightHelpers";

interface SpotlightResultsProps {
  query: string;
  results: SpotlightMatch[];
  isSearching: boolean;
  language: "tr" | "en";
  onSelect: (match: SpotlightMatch) => void;
}

export function SpotlightResults({
  query,
  results,
  isSearching,
  language,
  onSelect,
}: SpotlightResultsProps) {
  if (isSearching && results.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-3 text-center text-white/40">
        <LoaderCircle size={24} className="animate-spin text-white/70" />
        <span className="text-xs font-bold">
          {language === "tr" ? "Aranıyor…" : "Searching…"}
        </span>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-2 text-center text-white/50">
        <Search size={24} className="text-white/30" />
        <p className="m-0 text-sm font-bold text-white/80">
          {language === "tr"
            ? `“${query}” ile eşleşen sonuç bulunamadı.`
            : `No matches found for “${query}”.`}
        </p>
        <p className="m-0 text-xs text-white/40">
          {language === "tr"
            ? "Farklı kelimeler aramayı deneyin."
            : "Try searching with different terms."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-extrabold text-white/50 uppercase tracking-wider">
          {language === "tr" ? "Arama Sonuçları" : "Search Results"} ({results.length})
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {results.map((match, index) => {
          const type = String(match.type || "");
          const item = match.item;
          if (!item) return null;
          const isLive = type === "live";
          const title = resultTitle(match);
          const logo = resultLogo(match);
          const isPortrait = type === "movie" || type === "series";

          return (
            <button
              type="button"
              key={`result-${type}-${item.id}-${index}`}
              aria-label={title}
              onClick={() => onSelect(match)}
              className="group relative block w-full cursor-pointer overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04] text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/35 hover:bg-white/[0.09] hover:shadow-[0_16px_36px_rgba(0,0,0,0.6)]"
            >
              <div className={`relative w-full ${isPortrait ? "aspect-[2/3]" : "aspect-video"} overflow-hidden bg-neutral-900/80`}>
                <ImageWithFallback
                  src={logo}
                  name={title}
                  group={item.group || ""}
                  itemType={type === "live" || type === "series" ? type : "movie"}
                  aspect={isPortrait ? "portrait" : "landscape"}
                  cover
                  fallbackToPlaylist
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <span className={`absolute left-2 top-2 z-[2] inline-flex items-center rounded-full px-2 py-0.5 text-xs font-black uppercase ${isLive ? "bg-rose-600 text-white" : "bg-black/60 backdrop-blur-md border border-white/15 text-white/90"}`}>
                  {typeLabel(type, language)}
                </span>
                <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-white/25 backdrop-blur-md border border-white/40 text-white shadow-lg">
                    <Play size={15} className="ml-0.5 fill-white text-white" />
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 z-[2] p-2.5">
                  <span className="line-clamp-2 text-xs font-bold leading-snug text-white drop-shadow">
                    {title}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
