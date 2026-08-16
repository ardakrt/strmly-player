import type { Dispatch, SetStateAction } from 'react';
import type Hls from 'hls.js';
import type { PlayerQualityLevel } from './cinematicPlayerHelpers';
import {
  getHlsAudioTracks,
  getHlsQualityLevels,
  getHlsSubtitleTracks,
  getNativeAudioTracks,
  getNativeSubtitleTracks,
} from './cinematicPlayerSessionHelpers';
import type { SessionAudioTrack } from './cinematicPlayerSessionHelpers';
import type { CinematicSubtitleTrack } from './useCinematicPlayerSubtitles';

type Setter<T> = Dispatch<SetStateAction<T>>;
type NativeAudioTrackList = {
  length: number;
  [index: number]: { label?: string; language?: string; enabled?: boolean };
  addEventListener: (name: string, handler: () => void) => void;
  removeEventListener: (name: string, handler: () => void) => void;
};

export function attachNativeTrackHandlers({
  isActive,
  language,
  setActiveAudioTrack,
  setAudioTracks,
  setSubtitleTracks,
  video,
}: {
  isActive: () => boolean;
  language: 'tr' | 'en';
  setActiveAudioTrack: Setter<number>;
  setAudioTracks: Setter<SessionAudioTrack[]>;
  setSubtitleTracks: Setter<CinematicSubtitleTrack[]>;
  video: HTMLVideoElement;
}) {
  const audioTracks = (video as HTMLVideoElement & { audioTracks?: NativeAudioTrackList }).audioTracks;
  const handleAudioTracks = () => {
    if (!isActive() || !audioTracks) return;
    const result = getNativeAudioTracks(audioTracks, language);
    setAudioTracks(result.tracks);
  };
  const handleTextTracks = () => {
    if (!isActive()) return;
    const tracks = getNativeSubtitleTracks(video.textTracks, language);
    if (tracks.length === 0) return;
    setSubtitleTracks(current => [
      ...current.filter(track => !track.isEmbedded),
      ...tracks,
    ]);
  };
  const syncInitialAudioTracks = () => {
    if (!audioTracks || audioTracks.length === 0) return;
    const result = getNativeAudioTracks(audioTracks, language);
    setAudioTracks(result.tracks);
    setActiveAudioTrack(result.activeIndex);
  };

  for (const eventName of ['addtrack', 'removetrack', 'change']) {
    audioTracks?.addEventListener(eventName, handleAudioTracks);
    video.textTracks.addEventListener(eventName, handleTextTracks);
  }
  handleTextTracks();

  return {
    syncInitialAudioTracks,
    detach: () => {
      for (const eventName of ['addtrack', 'removetrack', 'change']) {
        audioTracks?.removeEventListener(eventName, handleAudioTracks);
        video.textTracks.removeEventListener(eventName, handleTextTracks);
      }
    },
  };
}

export function registerHlsTrackHandlers({
  events,
  forceUnmute,
  hls,
  language,
  onManifestReady,
  setActiveAudioTrack,
  setActiveQualityLevel,
  setActiveSubtitle,
  setAudioTracks,
  setQualityLevels,
  setSubtitleTracks,
}: {
  events: typeof Hls.Events;
  forceUnmute: () => void;
  hls: Hls;
  language: 'tr' | 'en';
  onManifestReady: () => void;
  setActiveAudioTrack: Setter<number>;
  setActiveQualityLevel: Setter<number>;
  setActiveSubtitle: Setter<number>;
  setAudioTracks: Setter<SessionAudioTrack[]>;
  setQualityLevels: Setter<PlayerQualityLevel[]>;
  setSubtitleTracks: Setter<CinematicSubtitleTrack[]>;
}) {
  hls.on(events.SUBTITLE_TRACKS_UPDATED, (_event, data) => {
    if (!data.subtitleTracks?.length) return;
    const result = getHlsSubtitleTracks(data.subtitleTracks, language);
    setSubtitleTracks(current => [
      ...current.filter(track => !track.isEmbedded),
      ...result.tracks,
    ]);
    if (result.turkishIndex >= 0) {
      hls.subtitleTrack = result.turkishIndex;
      setActiveSubtitle(result.turkishIndex);
    }
  });

  hls.on(events.SUBTITLE_TRACK_SWITCH, (_event, data) => {
    if (typeof data.id !== 'number') return;
    setSubtitleTracks(current => {
      const index = current.findIndex(track => track.hlsTrackId === data.id);
      setActiveSubtitle(index >= 0 ? index : data.id === -1 ? -1 : 0);
      return current;
    });
  });

  hls.on(events.AUDIO_TRACKS_UPDATED, (_event, data) => {
    if (data.audioTracks?.length) {
      const result = getHlsAudioTracks(data.audioTracks);
      setAudioTracks(result.tracks);
      hls.audioTrack = result.selectedIndex;
      setActiveAudioTrack(result.selectedIndex);
    }
    forceUnmute();
  });

  hls.on(events.MANIFEST_PARSED, () => {
    forceUnmute();
    if (hls.levels.length > 0) {
      const result = getHlsQualityLevels(hls.levels);
      setQualityLevels(result.levels);
      hls.currentLevel = result.selectedLevel;
      hls.loadLevel = result.selectedLevel;
      setActiveQualityLevel(result.selectedLevel);
    }
    onManifestReady();
  });

  hls.on(events.FRAG_LOADED, forceUnmute);
}
