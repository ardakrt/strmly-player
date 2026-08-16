import { CheckCircle2, Clock3, Download, Play } from "lucide-react";
import type { PlaylistItem } from "../../types";
import type { SeriesEpisode } from "../../utils/seriesGroupers";
import { EpisodeThumb } from "../EpisodeThumb";
import { CircularSaveProgress } from "./SeriesModalParts";
import {
  getEpisodePresentation,
  type EpisodeMeta,
} from "./seriesModalHelpers";

interface EpisodeSaveState {
  saved: boolean;
  saving: boolean;
  progress: number;
}

interface SeriesEpisodeRowProps {
  episode: SeriesEpisode;
  meta: EpisodeMeta;
  seriesCleanName: string;
  language: string;
  historyItem?: PlaylistItem;
  isTarget: boolean;
  tmdbShowId: number | null;
  fallbackPoster?: string;
  saveState: EpisodeSaveState;
  onPlay: (item: PlaylistItem) => void;
  onSave: (item: PlaylistItem) => Promise<unknown>;
  onNavigateToDownloads?: () => void;
}

export function SeriesEpisodeRow({
  episode,
  meta,
  seriesCleanName,
  language,
  historyItem,
  isTarget,
  tmdbShowId,
  fallbackPoster,
  saveState,
  onPlay,
  onSave,
  onNavigateToDownloads,
}: SeriesEpisodeRowProps) {
  const progress = historyItem?.progress;
  const isWatched = Boolean(historyItem);
  const fullyWatched = isWatched && (progress === undefined || progress >= 90);
  const hasProgress = progress !== undefined && progress > 0 && progress < 90;
  const { displayTitle, runtimeText, overview } = getEpisodePresentation(
    episode,
    seriesCleanName,
    meta,
    language,
  );

  return (
    <div
      onClick={() => onPlay(episode.item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPlay(episode.item);
        }
      }}
      tabIndex={0}
      role="button"
      className={`series-ep-row group flex items-center gap-3 px-2.5 py-2 cursor-pointer ${isTarget ? "is-active" : ""}`}
    >
      <div className="series-ep-thumb relative w-[6.75rem] md:w-[8rem] aspect-video shrink-0">
        <EpisodeThumb
          tmdbShowId={tmdbShowId}
          seasonNumber={episode.seasonNumber}
          episodeNumber={episode.episodeNumber}
          fallbackPoster={fallbackPoster}
          stillPath={meta.stillPath}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/45 transition-colors">
          <div className="w-7 h-7 rounded-full bg-white/90 text-black flex items-center justify-center shadow-md opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all">
            <Play size={11} fill="#000" className="ml-0.5" />
          </div>
        </div>
        {hasProgress ? (
          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-white/15 z-20">
            <div className="h-full bg-white" style={{ width: `${progress}%` }} />
          </div>
        ) : null}
        {fullyWatched ? (
          <span className="absolute top-1.5 right-1.5 z-20 w-5 h-5 rounded-full bg-black/55 border border-white/15 flex items-center justify-center">
            <CheckCircle2 size={12} className="text-emerald-400" />
          </span>
        ) : null}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-medium text-white/25 tabular-nums shrink-0 w-4">
            {episode.episodeNumber}
          </span>
          <h4 className="text-[13px] font-medium text-white/88 truncate">
            {displayTitle}
          </h4>
        </div>
        <div className="flex items-center gap-2 mt-0.5 pl-6 text-[11px] text-white/28">
          {runtimeText ? (
            <span className="inline-flex items-center gap-1">
              <Clock3 size={10} className="opacity-70" />
              {runtimeText}
            </span>
          ) : null}
          {fullyWatched ? (
            <span className="text-emerald-400/70">
              {language === "tr" ? "İzlendi" : "Watched"}
            </span>
          ) : hasProgress ? (
            <span className="text-white/45">
              {language === "tr"
                ? `Devam · %${Math.round(progress)}`
                : `In progress · ${Math.round(progress)}%`}
            </span>
          ) : null}
        </div>
        {overview ? (
          <p className="mt-0.5 pl-6 text-[11px] text-white/30 line-clamp-1 leading-snug">
            {overview}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={async (event) => {
          event.stopPropagation();
          if (saveState.saved) {
            onPlay(episode.item);
            return;
          }
          if (saveState.saving && onNavigateToDownloads) {
            onNavigateToDownloads();
            return;
          }
          await onSave(episode.item);
        }}
        className={`series-icon-btn shrink-0 cursor-pointer ${saveState.saved ? "is-saved" : ""}`}
        title={
          saveState.saved
            ? language === "tr"
              ? "Çevrimdışı oynat"
              : "Play offline"
            : language === "tr"
              ? "Kaydet"
              : "Save"
        }
        aria-label={
          saveState.saved
            ? language === "tr"
              ? "Çevrimdışı oynat"
              : "Play offline"
            : language === "tr"
              ? "Kaydet"
              : "Save"
        }
      >
        {saveState.saved ? (
          <CheckCircle2 size={15} strokeWidth={2} color="#34d399" />
        ) : saveState.saving ? (
          <CircularSaveProgress progress={saveState.progress} />
        ) : (
          <Download size={15} strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}
