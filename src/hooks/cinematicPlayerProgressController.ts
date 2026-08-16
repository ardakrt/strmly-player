import type { Dispatch, SetStateAction } from 'react';
import type { PlaylistItem } from '../utils/m3uParser';
import type { LearnedIntro } from './cinematicPlayerSessionHelpers';

type MutableRef<T> = { current: T };
type Setter<T> = Dispatch<SetStateAction<T>>;

export function createPlayerProgressController({
  durationRef,
  isTranscodingRef,
  lastBufferedUpdateRef,
  learnedIntroRef,
  saveWatchProgress,
  seekOffsetRef,
  selectedChannel,
  setBufferedProgress,
  setCurrentTime,
  setDuration,
  setShowIntroSkip,
  setVideoReady,
  video,
}: {
  durationRef: MutableRef<number>;
  isTranscodingRef: MutableRef<boolean>;
  lastBufferedUpdateRef: MutableRef<number>;
  learnedIntroRef: MutableRef<LearnedIntro | null>;
  saveWatchProgress: (item: PlaylistItem, time: number, total: number) => void;
  seekOffsetRef: MutableRef<number>;
  selectedChannel: PlaylistItem;
  setBufferedProgress: Setter<number>;
  setCurrentTime: Setter<number>;
  setDuration: Setter<number>;
  setShowIntroSkip: Setter<boolean>;
  setVideoReady: Setter<boolean>;
  video: HTMLVideoElement;
}) {
  let lastSavedTime = selectedChannel.currentTime || 0;
  let lastSavedStateTime = -1;

  const getTotalDuration = () =>
    isTranscodingRef.current && durationRef.current > 0
      ? durationRef.current
      : video.duration || 0;

  const updateBufferedProgress = (force = false) => {
    const now = Date.now();
    if (!force && now - lastBufferedUpdateRef.current < 500) return;
    lastBufferedUpdateRef.current = now;
    const total = getTotalDuration();
    if (video.buffered.length === 0 || total <= 0) {
      setBufferedProgress(0);
      return;
    }
    const currentPosition = video.currentTime;
    let activeRangeEnd = 0;
    for (let index = 0; index < video.buffered.length; index++) {
      const start = video.buffered.start(index);
      const end = video.buffered.end(index);
      if (currentPosition >= start && currentPosition <= end) {
        activeRangeEnd = end;
        break;
      }
    }
    if (activeRangeEnd === 0) {
      const lastEnd = video.buffered.end(video.buffered.length - 1);
      if (lastEnd >= currentPosition) activeRangeEnd = lastEnd;
    }
    const absoluteBufferedTime = seekOffsetRef.current + activeRangeEnd;
    setBufferedProgress(Math.min(100, Math.max(0, (absoluteBufferedTime / total) * 100)));
  };

  const handleTimeUpdate = () => {
    const currentTime = seekOffsetRef.current + video.currentTime;
    if (Math.floor(currentTime) !== Math.floor(lastSavedStateTime)) {
      lastSavedStateTime = currentTime;
      setCurrentTime(currentTime);
    }
    if (video.currentTime > 0.1) setVideoReady(current => current || true);
    if (Math.abs(currentTime - lastSavedTime) >= 10) {
      lastSavedTime = currentTime;
      const total = getTotalDuration();
      if (total > 0) saveWatchProgress(selectedChannel, currentTime, total);
    }
    updateBufferedProgress();
    const intro = learnedIntroRef.current;
    setShowIntroSkip(!!intro && currentTime >= intro.from && currentTime < intro.to - 4);
  };

  const handleDurationChange = () => {
    if (isTranscodingRef.current) return;
    if (video.duration && isFinite(video.duration) && video.duration > 0) {
      setDuration(video.duration);
    }
  };

  return {
    getTotalDuration,
    handleDurationChange,
    handleProgress: () => updateBufferedProgress(true),
    handleTimeUpdate,
  };
}
