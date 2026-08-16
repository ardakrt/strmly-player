import { useRef, useState } from 'react';
import type Hls from 'hls.js';
import { translateReason } from './cinematicPlayerHelpers';

export interface CinematicSubtitleTrack {
  label: string;
  srclang: string;
  src: string;
  isEmbedded?: boolean;
  hlsTrackId?: number;
  textTrackIndex?: number;
  streamId?: number;
}

interface UseCinematicPlayerSubtitlesProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  hlsInstanceRef: React.RefObject<Hls | null>;
  language: 'tr' | 'en';
  showToast: (message: string) => void;
}

export function useCinematicPlayerSubtitles({
  videoRef,
  hlsInstanceRef,
  language,
  showToast,
}: UseCinematicPlayerSubtitlesProps) {
  const subtitleRef = useRef<HTMLTrackElement>(null);
  const subtitleObjectUrlsRef = useRef<string[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<CinematicSubtitleTrack[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState(-1);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);

  const handleSubtitleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    subtitleObjectUrlsRef.current.push(objectUrl);
    const newTrack: CinematicSubtitleTrack = {
      label: file.name.slice(0, 20) + (file.name.length > 20 ? '...' : ''),
      srclang: 'custom',
      src: objectUrl,
    };

    setSubtitleTracks((previous) => {
      const updated = [...previous, newTrack];
      setActiveSubtitle(updated.length - 1);
      return updated;
    });
    showToast(translateReason('Altyazı yüklendi.', language));
    setShowSubtitleMenu(false);
  };

  const handleSubtitleChange = (index: number) => {
    setActiveSubtitle(index);
    const selectedTrack = subtitleTracks[index];

    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.subtitleTrack = selectedTrack?.hlsTrackId ?? -1;
    }

    const video = videoRef.current;
    if (!video?.textTracks) return;
    for (let trackIndex = 0; trackIndex < video.textTracks.length; trackIndex += 1) {
      video.textTracks[trackIndex].mode = selectedTrack?.textTrackIndex === trackIndex
        ? 'showing'
        : 'disabled';
    }
  };

  const resetSubtitles = () => {
    subtitleObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    subtitleObjectUrlsRef.current = [];
    setSubtitleTracks([]);
    setActiveSubtitle(-1);
  };

  const subtitleLifecycle = {
    subtitleRef,
    subtitleTracks,
    activeSubtitle,
    showSubtitleMenu,
    setSubtitleTracks,
    setActiveSubtitle,
    setShowSubtitleMenu,
    handleSubtitleUpload,
    handleSubtitleChange,
    resetSubtitles,
  };

  return subtitleLifecycle;
}
