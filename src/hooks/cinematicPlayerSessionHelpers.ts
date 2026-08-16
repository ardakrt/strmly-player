import type { PlaylistItem } from '../utils/m3uParser';
import { parseSeriesEpisodeInfo } from '../utils/seriesGroupers';
import { getPreferredAudioTrackIndex, getSavedQualityLevel } from './cinematicPlayerHelpers';
import type { PlayerQualityLevel } from './cinematicPlayerHelpers';
import type { CinematicSubtitleTrack } from './useCinematicPlayerSubtitles';

export type SessionAudioTrack = {
  id: number;
  name: string;
  lang: string;
  streamId?: number;
  codec?: string;
};

export type LearnedIntro = { from: number; to: number };

type ProbeResult = {
  success?: boolean;
  duration?: number;
  codec?: string;
  videoCodec?: string;
  allCodecs?: string[];
  audioStreams?: SessionAudioTrack[];
};

export type PlaybackProbeDecision = {
  audioStreams: SessionAudioTrack[];
  duration?: number;
  localBrowserSafe: boolean;
  shouldTranscode: boolean;
  streamId?: number;
  selectedAudioTrack: number;
  videoCodec?: string;
};

export function readLearnedIntro(item: PlaylistItem): LearnedIntro | null {
  if (item.type !== 'series') return null;
  const { cleanTitle } = parseSeriesEpisodeInfo(item.name);
  const key = `intro_${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const saved = localStorage.getItem(key);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as LearnedIntro;
  } catch {
    return null;
  }
}

export function isLocalMediaSource(url: string): boolean {
  return (
    url.startsWith('app-file:') ||
    url.startsWith('file:') ||
    /^[a-zA-Z]:[\\/]/.test(url)
  );
}

export function hasUnsupportedCodecHint(item: PlaylistItem): boolean {
  const value = `${item.name} ${item.url}`.toLowerCase();
  return [
    'ac3', 'ac-3', 'ddp', 'eac3', 'e-ac-3', 'dts', 'dca', '5.1', '7.1',
    'truehd', 'atmos', 'dolby', 'surround', 'multi',
  ].some(keyword => value.includes(keyword));
}

export function isUnsupportedAudioCodec(codec: string): boolean {
  const value = (codec || '').toLowerCase().trim();
  if (!value) return false;
  return [
    'ac3', 'ac-3', 'eac3', 'e-ac-3', 'ddp', 'dts', 'dca', 'truehd', 'mlp',
    'bluray', 'pcm', 'wmav', 'aac_latm',
  ].some(codecName => value.includes(codecName)) || value === 'mp2';
}

export function selectProbedAudioTrack(tracks: SessionAudioTrack[] = []) {
  if (tracks.length === 0) return { index: 0, streamId: undefined };
  const preferredIndex = getPreferredAudioTrackIndex(tracks);
  return {
    index: preferredIndex,
    streamId: tracks[preferredIndex]?.streamId,
  };
}

export function shouldTranscodeProbeResult(
  result: ProbeResult,
  streamId: number | undefined,
  isLocalFile: boolean,
): { shouldTranscode: boolean; localBrowserSafe: boolean } {
  const selectedCodec = (
    (typeof streamId === 'number'
      ? result.audioStreams?.find(stream => stream.streamId === streamId)?.codec
      : undefined) || result.codec || ''
  ).toLowerCase();
  const allCodecs = (result.allCodecs || []).map(codec => (codec || '').toLowerCase());
  const hasUnsupportedAudio =
    isUnsupportedAudioCodec(selectedCodec) ||
    allCodecs.some(isUnsupportedAudioCodec) ||
    (result.audioStreams || []).some(stream => isUnsupportedAudioCodec(stream.codec || ''));
  const hasUnsupportedLocalVideo =
    isLocalFile && !!result.videoCodec && /hevc|h265|av1|mpeg2video/i.test(result.videoCodec);
  const browserSafeAudio = ['aac', 'mp3', 'opus', 'vorbis', 'mp4a'];
  const localBrowserSafe =
    isLocalFile &&
    !hasUnsupportedAudio &&
    !hasUnsupportedLocalVideo &&
    !!result.videoCodec &&
    /h264|avc/i.test(result.videoCodec) &&
    !!selectedCodec &&
    browserSafeAudio.includes(selectedCodec);
  return {
    shouldTranscode: hasUnsupportedAudio || hasUnsupportedLocalVideo || localBrowserSafe,
    localBrowserSafe,
  };
}

export async function probePlaybackCompatibility(
  item: PlaylistItem,
  isLocalFile: boolean,
): Promise<PlaybackProbeDecision> {
  const fallback: PlaybackProbeDecision = {
    audioStreams: [],
    localBrowserSafe: false,
    selectedAudioTrack: 0,
    shouldTranscode: !isLocalFile,
  };
  const probeAudioCodec = window.electronAPI?.probeAudioCodec;
  if (!probeAudioCodec) return fallback;
  try {
    const result = await probeAudioCodec(item.url) as ProbeResult;
    if (!result.success) return fallback;
    const audioStreams = result.audioStreams || [];
    const selectedTrack = selectProbedAudioTrack(audioStreams);
    const decision = shouldTranscodeProbeResult(
      result,
      selectedTrack.streamId,
      isLocalFile,
    );
    return {
      audioStreams,
      duration: result.duration && result.duration > 0 ? result.duration : undefined,
      localBrowserSafe: decision.localBrowserSafe,
      selectedAudioTrack: selectedTrack.index,
      shouldTranscode: decision.shouldTranscode,
      streamId: selectedTrack.streamId,
      videoCodec: result.videoCodec?.toLowerCase(),
    };
  } catch (error) {
    console.error('[AutoTranscode] Error during background codec probing:', error);
    return fallback;
  }
}

export function getNativeAudioTracks(
  nativeTracks: { length: number; [index: number]: { label?: string; language?: string; enabled?: boolean } },
  language: 'tr' | 'en',
): { tracks: SessionAudioTrack[]; activeIndex: number } {
  const tracks: SessionAudioTrack[] = [];
  let activeIndex = 0;
  for (let index = 0; index < nativeTracks.length; index++) {
    const track = nativeTracks[index];
    tracks.push({
      id: index,
      name: track.label || track.language || (language === 'tr' ? `Parça ${index + 1}` : `Track ${index + 1}`),
      lang: track.language || '',
    });
    if (track.enabled) activeIndex = index;
  }
  return { tracks, activeIndex };
}

export function getNativeSubtitleTracks(
  nativeTracks: TextTrackList,
  language: 'tr' | 'en',
): CinematicSubtitleTrack[] {
  const tracks: CinematicSubtitleTrack[] = [];
  for (let index = 0; index < nativeTracks.length; index++) {
    const track = nativeTracks[index];
    if (track.kind === 'metadata') continue;
    const lang = track.language || '';
    const langLower = lang.toLowerCase();
    const label = track.label || (
      langLower === 'tur' || langLower === 'tr'
        ? 'Türkçe'
        : langLower === 'eng' || langLower === 'en'
          ? 'English'
          : lang
            ? lang.toUpperCase()
            : language === 'tr' ? `Altyazı ${index + 1}` : `Subtitle ${index + 1}`
    );
    tracks.push({
      label,
      srclang: lang,
      src: '',
      isEmbedded: true,
      textTrackIndex: index,
    });
  }
  return tracks;
}

export function getHlsAudioTracks(
  tracks: Array<{ name?: string; lang?: string }>,
): { tracks: SessionAudioTrack[]; selectedIndex: number } {
  const mapped = tracks.map((track, index) => ({
    id: index,
    name: track.name || `Track ${index + 1}`,
    lang: track.lang || '',
  }));
  return { tracks: mapped, selectedIndex: getPreferredAudioTrackIndex(mapped) };
}

export function getHlsSubtitleTracks(
  tracks: Array<{ name?: string; lang?: string }>,
  language: 'tr' | 'en',
): { tracks: CinematicSubtitleTrack[]; turkishIndex: number } {
  return {
    tracks: tracks.map((track, index) => ({
      label: track.name || track.lang || (language === 'tr' ? `Altyazı ${index + 1}` : `Subtitle ${index + 1}`),
      srclang: track.lang || '',
      src: '',
      isEmbedded: true,
      hlsTrackId: index,
    })),
    turkishIndex: tracks.findIndex(
      track => track.name?.toLowerCase().includes('türk') ||
        track.name?.toLowerCase().includes('turk') || track.lang === 'tr',
    ),
  };
}

export function getHlsQualityLevels(
  levels: Array<{ height?: number; bitrate?: number }>,
): { levels: PlayerQualityLevel[]; selectedLevel: number } {
  const mapped = levels.map((level, index) => {
    const height = Number(level.height) || undefined;
    const bitrate = Number(level.bitrate) || undefined;
    return {
      id: index,
      height,
      bitrate,
      label: height
        ? `${height}p`
        : bitrate ? `${Math.round(bitrate / 1000)} kbps` : `Level ${index + 1}`,
    };
  });
  const savedQuality = getSavedQualityLevel();
  return {
    levels: mapped,
    selectedLevel: savedQuality >= 0 && mapped.some(level => level.id === savedQuality)
      ? savedQuality
      : -1,
  };
}
