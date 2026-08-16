import type { RefObject } from 'react';
import type { PlayerVideoScaleMode } from './PlayerSettingsMenu';

interface PlayerMediaSurfaceProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  subtitleTracks: { label: string; srclang: string; src: string }[];
  activeSubtitle: number;
  videoScaleMode: PlayerVideoScaleMode;
  isSeekingVideo: boolean;
  showSnapshot: boolean;
  onSeeking: () => void;
  onPlaybackResumed: () => void;
  onSeeked: () => void;
}

const mediaSizingClass = (mode: PlayerVideoScaleMode) => (
  mode === '16:9' || mode === '4:3'
    ? 'w-auto h-auto max-w-full max-h-full object-fill'
    : `w-full h-full ${mode === 'fit' ? 'object-contain' : mode === 'fill' ? 'object-fill' : 'object-cover'}`
);

export function PlayerMediaSurface({ videoRef, canvasRef, subtitleTracks, activeSubtitle, videoScaleMode, isSeekingVideo, showSnapshot, onSeeking, onPlaybackResumed, onSeeked }: PlayerMediaSurfaceProps) {
  const aspectRatio = videoScaleMode === '16:9' ? '16/9' : videoScaleMode === '4:3' ? '4/3' : 'auto';
  return (
    <>
      <video
        ref={videoRef}
        onSeeking={onSeeking}
        onSeeked={onSeeked}
        onPlaying={onPlaybackResumed}
        onPlay={onPlaybackResumed}
        className={`pointer-events-none absolute left-1/2 top-1/2 ${mediaSizingClass(videoScaleMode)}`}
        style={{
          aspectRatio,
          objectPosition: 'center center',
          margin: 'auto',
          opacity: isSeekingVideo ? 0.35 : 1,
          filter: isSeekingVideo ? 'blur(16px) brightness(0.65)' : 'blur(0px) brightness(1)',
          transform: `translate(-50%, -50%) scale(${isSeekingVideo ? 0.96 : 1})`,
          transition: isSeekingVideo
            ? 'opacity 50ms ease-out, filter 80ms ease-out, transform 100ms cubic-bezier(0.1, 0.8, 0.3, 1)'
            : 'opacity 350ms ease-out, filter 350ms ease-out, transform 400ms cubic-bezier(0.1, 0.8, 0.3, 1)',
        }}
        autoPlay
        playsInline
        preload="auto"
      >
        {subtitleTracks.map((track, index) => <track key={index} kind="subtitles" label={track.label} srcLang={track.srclang} src={track.src} default={index === activeSubtitle} />)}
      </video>
      <canvas
        ref={canvasRef}
        className={`absolute pointer-events-none transition-opacity duration-300 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${showSnapshot ? 'opacity-100' : 'opacity-0'} ${mediaSizingClass(videoScaleMode)}`}
        style={{ aspectRatio, objectPosition: 'center center', margin: 'auto', zIndex: 9 }}
      />
    </>
  );
}
