import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Trash2, Plus } from 'lucide-react';
import Hls from 'hls.js';
import type { QuadCellProps } from '../types';

export const QuadCell = ({ channel, cellIndex, isSelected, onSelect, onRemove, accentStyles }: QuadCellProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    if (!channel || !videoRef.current) return;

    setIsPlaying(true);

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        xhrSetup: (xhr) => {
          xhr.setRequestHeader('User-Agent', '9XtreamPlayer LibVLC/3.0.22-rc1');
        }
      });
      hlsRef.current = hls;
      hls.loadSource(channel.url);
      hls.attachMedia(videoRef.current);
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = channel.url;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel]);

  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleToggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  return (
    <div
      onClick={onSelect}
      style={isSelected ? accentStyles : {}}
      className={`relative aspect-video rounded-2xl overflow-hidden bg-neutral-950/80 border transition-all duration-300 group cursor-pointer ${
        isSelected ? 'border-[var(--accent-color)] shadow-2xl scale-[1.01]' : 'border-white/5 hover:border-white/20'
      }`}
    >
      <div className="absolute top-3 left-4 z-10 px-2.5 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg text-xs font-semibold text-neutral-300">
        Ekran {cellIndex + 1}
      </div>

      {channel ? (
        <>
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            muted={isMuted}
            autoPlay
            playsInline
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4">
            <div className="flex justify-end gap-2">
              <button
                onClick={onRemove}
                className="w-8 h-8 rounded-full bg-red-600/80 hover:bg-red-600 text-white flex items-center justify-center border border-red-500/30 transition-colors shadow-lg"
                title="Kanalı Çıkar"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col max-w-[60%]">
                <span className="text-sm font-semibold text-white truncate">{channel.name}</span>
                <span className="text-[10px] text-neutral-400 truncate">{channel.group}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleTogglePlay}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 backdrop-blur-md transition-colors"
                >
                  {isPlaying ? <Pause size={13} fill="#fff" /> : <Play size={13} fill="#fff" style={{ marginLeft: '1px' }} />}
                </button>
                <button
                  onClick={handleToggleMute}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 backdrop-blur-md transition-colors"
                >
                  {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                </button>
                <button
                  onClick={handleToggleFullscreen}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 backdrop-blur-md transition-colors"
                >
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 select-none text-neutral-500 group-hover:text-neutral-300 transition-colors">
          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
            <Plus size={22} className="opacity-70 group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-xs font-semibold tracking-wider uppercase">Yayını Buraya Ekle</span>
          <span className="text-[10px] opacity-60 mt-1 max-w-[180px]">Sol listeden istediğiniz canlı kanalı buraya atamak için tıklayın</span>
        </div>
      )}
    </div>
  );
};
