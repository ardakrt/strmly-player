import type { PlaylistItem } from "../utils/m3uParser";
export type { PlaylistItem };

// Extend window interface for Electron API
declare global {
  interface Window {
    /** Set by Electron preload when STRMLY_PERF_BENCH=1 */
    strmlyPerfBench?: boolean;
    electronAPI?: {
      playExternal: (
        url: string,
        playerType: string,
      ) => Promise<{ success: boolean; message: string }>;
      saveConfig: (
        key: string,
        value: any,
      ) => Promise<{ success: boolean; error?: string }>;
      saveConfigSync?: (
        key: string,
        value: any,
      ) => { success: boolean; error?: string };
      saveConfigBatchSync?: (entries: Record<string, unknown>) => {
        success: boolean;
        error?: string;
      };
      deleteProfileData?: (
        profileId: string,
      ) => Promise<{ success: boolean; deletedKeys?: number; error?: string }>;
      loadConfig: (key: string) => Promise<any>;
      savePlaylistItems: (
        id: string,
        items: PlaylistItem[],
      ) => Promise<{ success: boolean; error?: string }>;
      loadPlaylistItems: (id: string) => Promise<PlaylistItem[]>;
      deletePlaylistItems: (
        id: string,
      ) => Promise<{ success: boolean; error?: string }>;
      fetchTmdb?: (path: string) => Promise<TmdbSearchResponse>;
      fetchTmdbImage?: (
        path: string,
        size?: string,
      ) => Promise<{ dataUrl?: string; localUrl?: string; error?: string }>;
      startFfmpegProxy?: (
        url: string,
        startTime?: number,
        audioStreamId?: number,
        transcodeMode?: string,
        contentType?: string,
      ) => Promise<{
        success: boolean;
        port?: number;
        url?: string;
        error?: string;
      }>;
      stopFfmpegProxy?: () => Promise<{ success: boolean }>;
      checkFfmpeg?: () => Promise<{ available: boolean; path: string | null }>;
      probeAudioCodec?: (
        url: string,
      ) => Promise<{
        success: boolean;
        codec?: string;
        videoCodec?: string;
        duration?: number;
        allCodecs?: string[];
        audioStreams?: {
          id: number;
          streamId: number;
          name: string;
          lang: string;
          codec: string;
        }[];
        error?: string;
      }>;
      checkForUpdates?: () => Promise<{ success: boolean; error?: string }>;
      downloadUpdate?: () => Promise<{ success: boolean; error?: string }>;
      installUpdate?: () => Promise<{ success: boolean; error?: string }>;
      relaunchApp?: () => Promise<void>;
      getAppVersion?: () => Promise<string>;
      onUpdateStatus?: (
        callback: (data: {
          status: any;
          message: string;
          version?: string;
        }) => void,
      ) => () => void;
      onUpdateProgress?: (
        callback: (data: { percent: number; speed: string }) => void,
      ) => () => void;
      downloadStream?: (params: {
        downloadId: string;
        streamUrl: string;
        type?: string;
        name?: string;
      }) => Promise<{
        success: boolean;
        skipped?: boolean;
        filePath?: string;
        playUrl?: string;
        size?: string;
        error?: string;
      }>;
      getSavedMediaInfo?: (params: {
        downloadId?: string;
        type?: string;
        name?: string;
        streamUrl?: string;
      }) => Promise<{
        exists: boolean;
        filePath?: string;
        playUrl?: string;
        size?: string;
        error?: string;
      }>;
      getSavedMediaInfoBatch?: (
        items: {
          key?: string;
          downloadId?: string;
          type?: string;
          name?: string;
          streamUrl?: string;
        }[],
      ) => Promise<{
        results: {
          key?: string;
          exists: boolean;
          filePath?: string;
          playUrl?: string;
          size?: string;
          error?: string;
        }[];
        error?: string;
      }>;
      cancelDownload?: (
        downloadId: string,
      ) => Promise<{ success: boolean; resumable?: boolean }>;
      deleteFile?: (
        filePath: string,
      ) => Promise<{ success: boolean; error?: string }>;
      playFile?: (
        filePath: string,
      ) => Promise<{ success: boolean; error?: string }>;
      openDownloadsFolder?: () => Promise<{ success: boolean; error?: string }>;
      selectDownloadsFolder?: () => Promise<{
        canceled: boolean;
        filePath?: string;
        selectionToken?: string;
      }>;
      setDownloadsFolder?: (params: {
        folderPath: string;
        moveExisting: boolean;
        selectionToken: string;
      }) => Promise<{ success: boolean; error?: string }>;
      getDownloadsFolder?: () => Promise<string>;
      onDownloadProgress?: (
        callback: (data: {
          downloadId: string;
          progress: number;
          speed: string;
          timeLeft: string;
          size: string;
          error?: string;
          downloader?: "segmented" | "ffmpeg";
        }) => void,
      ) => () => void;
      onDownloadComplete?: (
        callback: (data: {
          downloadId: string;
          filePath: string;
          playUrl?: string;
        }) => void,
      ) => () => void;
      onMoveDownloadsProgress?: (
        callback: (data: {
          progress: number;
          currentFile: string;
          filesMoved: number;
          totalFiles: number;
        }) => void,
      ) => () => void;
      onNavigateBack?: (callback: () => void) => () => void;
      onNavigateForward?: (callback: () => void) => () => void;
    };
  }
}

export interface SavedPlaylist {
  id: string;
  name: string;
  channelCount: number;
  groupCount: number;
  groups: string[];
  // Source info for auto-updates
  playlistMode?: "m3u" | "xtream";
  url?: string;
  xtreamUrl?: string;
  xtreamUser?: string;
  xtreamPass?: string;
  autoUpdateIntervalHours?: 6 | 12 | 24 | 168;
  lastAutoUpdatedAt?: number;
}

export interface Profile {
  id: string;
  name: string;
  avatarUrl: string;
  autoUpdateIntervalHours?: 6 | 12 | 24 | 168;
  contentPreferences?: ContentPreference[];
}

export type ContentPreference =
  "series" | "movies" | "sports" | "live" | "kids";

export interface AvatarSearchResult {
  id: number;
  name: string;
  posterUrl: string;
  mediaType: "movie" | "tv";
}

export interface EPGProgram {
  title: string;
  nextTitle: string;
  progress: number; // 0 to 100
}

export type TmdbEndpoint = "movie" | "tv";

export interface TmdbSearchResult {
  id: number;
  name?: string;
  title?: string;
  original_name?: string;
  original_title?: string;
  original_language?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  first_air_date?: string;
  release_date?: string;
}

export interface TmdbSearchResponse {
  results?: TmdbSearchResult[];
  error?: string;
}

export interface TmdbTitleOverride {
  endpoint: TmdbEndpoint;
  id: number;
  fallback: TmdbSearchResult;
}

export interface ImageWithFallbackProps {
  src?: string;
  name: string;
  group?: string;
  size?: "sm" | "md" | "lg";
  itemType?: "live" | "movie" | "series";
  isGenericLogo?: boolean;
  aspect?: "portrait" | "landscape";
  cover?: boolean;
  lazy?: boolean;
  /** Use playlist artwork as a last resort when TMDB has no usable image. */
  fallbackToPlaylist?: boolean;
}

export interface EpisodeThumbProps {
  tmdbShowId: number | null;
  seasonNumber: number;
  episodeNumber: number;
  fallbackPoster?: string;
  stillPath?: string;
}
