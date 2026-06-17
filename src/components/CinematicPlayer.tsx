import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ArrowLeft, Play, Pause, Volume, Volume1, Volume2, VolumeX, Maximize2, Minimize2, PictureInPicture, Plus, Settings, ChevronRight, ChevronLeft, ChevronDown, ListCollapse, History, Search, X, Tv, Gauge, Subtitles, SkipForward, Scan } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import { SPEED_OPTIONS } from '../constants';
import type { PlaylistItem } from '../utils/m3uParser';
import { parseSeriesEpisodeInfo } from '../utils/seriesGroupers';

interface CinematicPlayerProps {
  channel: PlaylistItem;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playerContainerRef: React.RefObject<HTMLDivElement | null>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playerVolume: number;
  playerMuted: boolean;
  showControls: boolean;
  videoReady: boolean;
  playbackSpeed: number;
  showSpeedMenu: boolean;
  audioTracks: { id: number; name: string; lang: string }[];
  activeAudioTrack: number;
  subtitleTracks: { label: string; srclang: string; src: string }[];
  activeSubtitle: number;
  showSubtitleMenu: boolean;
  isFullscreen: boolean;
  accentStyles: React.CSSProperties;
  onClose: () => void;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSpeedChange: (speed: number) => void;
  onAudioTrackChange: (id: number) => void;
  onSubtitleChange: (idx: number) => void;
  onSubtitleUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPiP: () => void;
  onToggleFullscreen: () => void;
  onTimelineSeek: (e: React.MouseEvent<HTMLDivElement>) => void;
  onSeek: (time: number) => void;
  onHideControls: () => void;
  onShowSpeedMenu: (show: boolean) => void;
  onShowSubtitleMenu: (show: boolean) => void;
  formatTime: (time: number) => string;
  onMouseMove?: () => void;
  onMouseLeave?: () => void;
  recentlyWatched: PlaylistItem[];
  channels: PlaylistItem[];
  onChannelChange: (channel: PlaylistItem) => void;
}

export const CinematicPlayer = (props: CinematicPlayerProps) => {
  const {
    channel,
    videoRef, playerContainerRef,
    isPlaying, currentTime, duration,
    playerVolume, playerMuted,
    showControls, videoReady,
    playbackSpeed,
    audioTracks, activeAudioTrack,
    subtitleTracks, activeSubtitle,
    isFullscreen, accentStyles,
    onClose, onTogglePlay, onToggleMute, onVolumeChange,
    onSpeedChange, onAudioTrackChange, onSubtitleChange,
    onSubtitleUpload, onPiP, onToggleFullscreen,
    onSeek,
    onHideControls,
    formatTime,
    onMouseMove, onMouseLeave,
    recentlyWatched, channels, onChannelChange
  } = props;

  const isLive = channel.type === 'live';

  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [currentSubmenu, setCurrentSubmenu] = useState<'main' | 'speed' | 'subtitles' | 'scale' | 'audio'>('main');
  const [videoScaleMode, setVideoScaleMode] = useState<'fit' | 'fill' | 'zoom' | '16:9' | '4:3'>('fit');

  const displayAudioTracks = useMemo(() => {
    if (audioTracks && audioTracks.length > 0) {
      return audioTracks;
    }
    return [{ id: 0, name: 'Varsayılan Ses', lang: '' }];
  }, [audioTracks]);

  // Timeline Dragging states
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragTime, setDragTime] = useState<number | null>(null);

  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(() => {
    const saved = localStorage.getItem('player_auto_play_next');
    return saved !== null ? saved === 'true' : true;
  });

  const [isAutoplayCancelled, setIsAutoplayCancelled] = useState(false);

  const toggleAutoPlayNext = () => {
    const newVal = !autoPlayNext;
    setAutoPlayNext(newVal);
    localStorage.setItem('player_auto_play_next', String(newVal));
  };
  
  const [showSidebarList, setShowSidebarList] = useState(false);
  const [showRecentPanel, setShowRecentPanel] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [selectedSidebarGroup, setSelectedSidebarGroup] = useState<string>('');

  const settingsRef = useRef<HTMLDivElement>(null);
  const sidebarPickerLabel = channel.type === 'series'
    ? 'Hızlı Dizi Seçici'
    : channel.type === 'movie'
      ? 'Hızlı Film Seçici'
      : 'Hızlı Kanal Seçici';
  const sidebarEmptyLabel = channel.type === 'series'
    ? 'Dizi Bulunamadı'
    : channel.type === 'movie'
      ? 'Film Bulunamadı'
      : 'Kanal Bulunamadı';
  const sidebarSearchPlaceholder = channel.type === 'series'
    ? 'Dizi ara...'
    : channel.type === 'movie'
      ? 'Film ara...'
      : 'Kanal ara...';

  // Sync sidebar group with currently playing channel on mount/change
  useEffect(() => {
    setIsAutoplayCancelled(false);
    if (channel && channel.group) {
      setSelectedSidebarGroup(channel.group);
    }
  }, [channel]);

  const sidebarItems = useMemo(() => (
    channels.filter(ch => ch.type === channel.type)
  ), [channels, channel.type]);

  // Extract unique categories/groups for the dropdown
  const sidebarGroups = useMemo(() => {
    const groups = new Set<string>();
    sidebarItems.forEach(ch => {
      if (ch.group) groups.add(ch.group);
    });
    return Array.from(groups).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [sidebarItems]);

  // Filter channels based on chosen group & search input
  const filteredSidebarChannels = useMemo(() => {
    let base = sidebarItems;
    if (selectedSidebarGroup) {
      base = base.filter(ch => ch.group === selectedSidebarGroup);
    }
    if (sidebarSearchQuery.trim()) {
      const q = sidebarSearchQuery.toLowerCase();
      base = base.filter(ch => ch.name.toLowerCase().includes(q));
    }
    // Limit to first 100 for high rendering performance
    return base.slice(0, 100);
  }, [sidebarItems, selectedSidebarGroup, sidebarSearchQuery]);

  // Find next episode sibling for series autoplay
  const nextEpisode = useMemo(() => {
    if (channel.type !== 'series') return null;

    const currentParsed = parseSeriesEpisodeInfo(channel.name);
    if (!currentParsed) return null;

    const currentClean = currentParsed.cleanTitle.toLowerCase();

    // Find sibling episodes in the same group and matching title
    const siblingEpisodes = channels.filter(ch => {
      if (ch.type !== 'series') return false;
      if (ch.group !== channel.group) return false;

      const parsed = parseSeriesEpisodeInfo(ch.name);
      return parsed.cleanTitle.toLowerCase() === currentClean;
    });

    const parsedSiblings = siblingEpisodes.map(ch => ({
      item: ch,
      info: parseSeriesEpisodeInfo(ch.name)
    }));

    // Sort: Season asc, Episode asc
    parsedSiblings.sort((a, b) => {
      if (a.info.season !== b.info.season) {
        return a.info.season - b.info.season;
      }
      return a.info.episode - b.info.episode;
    });

    // Find current episode index
    const currentIndex = parsedSiblings.findIndex(sib =>
      sib.info.season === currentParsed.season && sib.info.episode === currentParsed.episode
    );

    if (currentIndex !== -1 && currentIndex < parsedSiblings.length - 1) {
      return parsedSiblings[currentIndex + 1].item;
    }

    return null;
  }, [channel, channels]);

  // Auto-play next episode trigger when video reaches duration
  useEffect(() => {
    if (
      channel.type === 'series' &&
      nextEpisode &&
      duration > 0 &&
      autoPlayNext &&
      !isAutoplayCancelled &&
      duration - currentTime <= 0.5
    ) {
      onChannelChange(nextEpisode);
    }
  }, [currentTime, duration, nextEpisode, autoPlayNext, isAutoplayCancelled, channel, onChannelChange]);

  const updateDragPosition = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!timelineRef.current || duration <= 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as any).clientX;
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = pos * duration;
    setDragTime(targetTime);
  }, [duration]);

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    setIsDraggingTimeline(true);
    updateDragPosition(e);
  };

  useEffect(() => {
    if (!isDraggingTimeline) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateDragPosition(e);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!timelineRef.current || duration <= 0) {
        setIsDraggingTimeline(false);
        setDragTime(null);
        return;
      }
      const rect = timelineRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetTime = pos * duration;
      onSeek(targetTime);
      setIsDraggingTimeline(false);
      setDragTime(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingTimeline, duration, onSeek, updateDragPosition]);

  useEffect(() => {
    if (!showControls) {
      setShowSettingsMenu(false);
      setCurrentSubmenu('main');
      setShowSidebarList(false);
      setShowRecentPanel(false);
      setShowGroupMenu(false);
    }
  }, [showControls]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSettingsMenu && settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
        setCurrentSubmenu('main');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettingsMenu]);

  const handleSkipBackward = useCallback(() => {
    if (videoRef.current) {
      onSeek(Math.max(0, videoRef.current.currentTime - 10));
    } else {
      onSeek(Math.max(0, currentTime - 10));
    }
  }, [videoRef, onSeek, currentTime]);

  const handleSkipForward = useCallback(() => {
    if (videoRef.current) {
      onSeek(Math.min(videoRef.current.duration || duration, videoRef.current.currentTime + 10));
    } else {
      onSeek(Math.min(duration, currentTime + 10));
    }
  }, [videoRef, onSeek, duration, currentTime]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Prevent shortcut conflicts if search input is focused
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement).blur();
          setShowSidebarList(false);
        }
        return;
      }

      // Escape -> Close
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Enter -> Toggle Sidebar list
      if (e.key === 'Enter') {
        e.preventDefault();
        setShowSidebarList(prev => !prev);
        setShowRecentPanel(false);
        if (onMouseMove) onMouseMove();
        return;
      }

      // Tab -> Toggle Recent channels panel
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowRecentPanel(prev => !prev);
        setShowSidebarList(false);
        if (onMouseMove) onMouseMove();
        return;
      }

      // Space or K -> Play/Pause
      if (e.key === ' ' || key === 'k') {
        e.preventDefault();
        onTogglePlay();
        if (onMouseMove) onMouseMove();
        return;
      }

      // M -> Toggle Mute
      if (key === 'm') {
        e.preventDefault();
        onToggleMute();
        if (onMouseMove) onMouseMove();
        return;
      }

      // F -> Toggle Fullscreen
      if (key === 'f') {
        e.preventDefault();
        onToggleFullscreen();
        if (onMouseMove) onMouseMove();
        return;
      }

      // ArrowLeft -> Skip Back 10s
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSkipBackward();
        if (onMouseMove) onMouseMove();
        return;
      }

      // ArrowRight -> Skip Forward 10s
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSkipForward();
        if (onMouseMove) onMouseMove();
        return;
      }

      // ArrowUp -> Increase Volume by 5%
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const currentVol = playerMuted ? 0 : playerVolume;
        const newVol = Math.min(1, currentVol + 0.05);
        onVolumeChange({ target: { value: newVol.toString() } } as any);
        if (onMouseMove) onMouseMove();
        return;
      }

      // ArrowDown -> Decrease Volume by 5%
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const currentVol = playerMuted ? 0 : playerVolume;
        const newVol = Math.max(0, currentVol - 0.05);
        onVolumeChange({ target: { value: newVol.toString() } } as any);
        if (onMouseMove) onMouseMove();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [playerMuted, playerVolume, onVolumeChange, onTogglePlay, onToggleMute, onToggleFullscreen, onClose, onMouseMove, handleSkipBackward, handleSkipForward]);

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black flex items-center justify-center select-none"
      style={accentStyles}
    >
      <div
        ref={playerContainerRef}
        className={`relative w-full h-full overflow-hidden flex items-center justify-center ${!showControls ? 'cursor-none' : ''}`}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <video
          ref={videoRef}
          className={`pointer-events-none transition-all duration-300 ${
            (videoScaleMode === '16:9' || videoScaleMode === '4:3')
              ? 'w-auto h-auto max-w-full max-h-full object-fill'
              : 'w-full h-full ' + (
                videoScaleMode === 'fit' ? 'object-contain' :
                videoScaleMode === 'fill' ? 'object-fill' : 'object-cover'
              )
          }`}
          style={{
            aspectRatio: videoScaleMode === '16:9' ? '16/9' : videoScaleMode === '4:3' ? '4/3' : 'auto'
          }}
          autoPlay
          playsInline
          preload="auto"
        >
          {subtitleTracks.map((track, idx) => (
            <track
              key={idx}
              kind="subtitles"
              label={track.label}
              srcLang={track.srclang}
              src={track.src}
              default={idx === activeSubtitle}
            />
          ))}
        </video>
        {channel.type === 'series' && nextEpisode && duration > 0 && (duration - currentTime <= 10) && !isAutoplayCancelled && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-28 right-8 z-30 bg-neutral-950/90 border border-white/10 backdrop-blur-2xl p-5 rounded-2xl shadow-2xl flex flex-col gap-3 min-w-[280px] max-w-[90%] animate-scale-in"
          >
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-extrabold text-[var(--accent-color,white)] uppercase tracking-widest">Sonraki Bölüm</span>
              <span className="text-xs font-bold text-white line-clamp-1">{nextEpisode.name}</span>
              <span className="text-[10px] text-neutral-400">
                {autoPlayNext
                  ? `${Math.max(0, Math.ceil(duration - currentTime))} saniye içinde başlıyor...`
                  : 'Sonraki bölüm hazır'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChannelChange(nextEpisode);
                }}
                className="flex-1 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-neutral-200 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Play size={12} fill="#000" />
                Şimdi Oynat
              </button>
              {autoPlayNext && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAutoplayCancelled(true);
                  }}
                  className="px-3 py-2 bg-white/5 border border-white/10 text-white font-bold text-xs rounded-xl hover:bg-white/10 active:scale-95 transition-all"
                >
                  İptal
                </button>
              )}
            </div>
          </div>
        )}
        <div
          className={`absolute top-0 left-0 h-full w-80 z-40 bg-neutral-950/95 border-r border-white/10 backdrop-blur-2xl flex flex-col p-4 shadow-2xl transition-all duration-300 transform ${
            showSidebarList ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()} // Prevent triggering play/pause overlay
        >
          <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <ListCollapse size={16} className="text-[var(--accent-color)]" />
              <span className="text-sm font-bold text-white">{sidebarPickerLabel}</span>
            </div>
            <button
              onClick={() => setShowSidebarList(false)}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
            >
              <X size={12} />
            </button>
          </div>
          <div className="flex flex-col gap-1.5 mb-3.5 shrink-0 relative">
            <span className="text-[9px] font-extrabold text-neutral-500 uppercase tracking-widest px-1">Kategori</span>
            <button
              type="button"
              onClick={() => setShowGroupMenu(prev => !prev)}
              className={`w-full h-10 bg-neutral-950/90 border text-left px-3 rounded-xl outline-none cursor-pointer transition-all flex items-center justify-between gap-3 ${
                showGroupMenu
                  ? 'border-[var(--accent-color)] shadow-[0_0_0_1px_var(--accent-color),0_12px_35px_rgba(0,0,0,0.35)]'
                  : 'border-white/10 hover:border-white/20 hover:bg-neutral-900'
              }`}
            >
              <span className="min-w-0 truncate text-xs font-bold text-white">
                {selectedSidebarGroup || 'Tüm Kategoriler'}
              </span>
              <ChevronDown
                size={15}
                className={`shrink-0 text-neutral-400 transition-transform ${showGroupMenu ? 'rotate-180 text-white' : ''}`}
              />
            </button>
            {showGroupMenu && (
              <div className="absolute left-0 right-0 top-[62px] z-50 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/98 shadow-[0_22px_70px_rgba(0,0,0,0.65)] backdrop-blur-2xl animate-scale-in">
                <div className="max-h-72 overflow-y-auto hide-scrollbar p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSidebarGroup('');
                      setSidebarSearchQuery('');
                      setShowGroupMenu(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-colors flex items-center justify-between ${
                      !selectedSidebarGroup ? 'bg-white text-black' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    Tüm Kategoriler
                    <span className="text-[10px] opacity-60">{sidebarItems.length}</span>
                  </button>
                  {sidebarGroups.map(grp => {
                    const count = sidebarItems.reduce((total, item) => total + (item.group === grp ? 1 : 0), 0);
                    const isSelected = selectedSidebarGroup === grp;
                    return (
                      <button
                        type="button"
                        key={grp}
                        onClick={() => {
                          setSelectedSidebarGroup(grp);
                          setSidebarSearchQuery('');
                          setShowGroupMenu(false);
                        }}
                        className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-colors flex items-center gap-3 ${
                          isSelected ? 'bg-[var(--accent-color)] text-black' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{grp}</span>
                        <span className={`text-[10px] ${isSelected ? 'text-black/60' : 'text-neutral-500'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="relative mb-4 shrink-0">
            <Search size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder={sidebarSearchPlaceholder}
              value={sidebarSearchQuery}
              onChange={(e) => setSidebarSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-neutral-900/60 border border-white/5 focus:border-[var(--accent-color)] rounded-xl text-xs text-white placeholder-neutral-500 outline-none transition-all"
            />
            {sidebarSearchQuery && (
              <button
                onClick={() => setSidebarSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X size={10} />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-1.5 pr-0.5">
            {filteredSidebarChannels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-500 select-none">
                <Tv size={24} className="mb-2 opacity-50" />
                <span className="text-xs">{sidebarEmptyLabel}</span>
              </div>
            ) : (
              filteredSidebarChannels.map(item => {
                const isCurrent = item.id === channel.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onChannelChange(item);
                      if (onMouseMove) onMouseMove();
                    }}
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer border transition-all ${
                      isCurrent
                        ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border-[var(--accent-color)]/20 shadow-md font-bold'
                        : 'bg-white/[0.02] border-transparent hover:bg-white/5 hover:border-white/5 text-neutral-300 hover:text-white'
                    }`}
                  >
                    <div className="relative w-8 h-8 rounded-lg bg-neutral-950 border border-white/5 overflow-hidden shrink-0 shadow-inner">
                      <ImageWithFallback
                        src={item.logo}
                        name={item.name}
                        group={item.group || 'GENEL'}
                        itemType={item.type}
                        size="sm"
                      />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 leading-snug">
                      <span className="text-xs truncate">{item.name}</span>
                      <span className="text-[9px] text-neutral-500 truncate mt-0.5 uppercase tracking-wider font-semibold">{item.group || 'Genel'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div
          className={`absolute bottom-28 left-1/2 -translate-x-1/2 z-40 bg-neutral-950/90 border border-white/10 backdrop-blur-2xl p-4 rounded-[24px] shadow-2xl flex flex-col gap-3 min-w-[480px] max-w-[90%] transition-all duration-300 transform ${
            showRecentPanel ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-6 opacity-0 pointer-events-none scale-95'
          }`}
          onClick={(e) => e.stopPropagation()} // Prevent play/pause toggle
        >
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <History size={14} className="text-yellow-500" />
              <span className="text-xs font-bold text-white">Son İzlenen Kanallar</span>
            </div>
            <button
              onClick={() => setShowRecentPanel(false)}
              className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
            >
              <X size={10} />
            </button>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar py-1">
            {!(recentlyWatched && recentlyWatched.length) ? (
              <span className="text-[11px] text-neutral-500 py-6 text-center w-full">İzleme geçmişi bulunmuyor.</span>
            ) : (
              recentlyWatched
                .filter(item => item.id !== channel.id)
                .slice(0, 6)
                .map(item => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onChannelChange(item);
                      setShowRecentPanel(false);
                      if (onMouseMove) onMouseMove();
                    }}
                    className="w-20 shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-transparent hover:border-white/5 cursor-pointer text-center group transition-all"
                  >
                    <div className="relative w-12 h-12 rounded-xl bg-neutral-950 border border-white/5 overflow-hidden shadow-inner group-hover:scale-105 transition-transform">
                      <ImageWithFallback
                        src={item.logo}
                        name={item.name}
                        group={item.group || 'VOD'}
                        itemType={item.type}
                        size="md"
                      />
                    </div>
                    <span className="text-[10px] text-neutral-400 group-hover:text-white truncate w-full font-medium transition-colors">{item.name}</span>
                  </div>
                ))
            )}
          </div>
        </div>
        <div
          className="absolute inset-0 z-0 cursor-pointer"
          onClick={() => {
            onHideControls();
          }}
        />
        {!videoReady && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-2xl flex flex-col items-center justify-center gap-4 z-30 animate-fade-in">
            <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            <span className="text-xs text-white/60 font-medium tracking-wide">Yükleniyor...</span>
          </div>
        )}
        <div
          className={`absolute inset-0 flex items-center justify-center gap-10 md:gap-14 z-20 pointer-events-none transition-all duration-300 ease-out ${
            showControls ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          }`}
        >
          {!isLive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSkipBackward();
                if (onMouseMove) onMouseMove();
              }}
              className="pointer-events-auto w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/30 hover:bg-black/45 border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-2xl backdrop-blur-sm group/skip"
              title="10 Sn Geri"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <text x="12" y="13.8" fill="currentColor" stroke="none" fontSize="6.5" fontWeight="black" textAnchor="middle" dominantBaseline="middle">10</text>
              </svg>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay();
              if (onMouseMove) onMouseMove();
            }}
            className="pointer-events-auto w-16 h-16 md:w-20 md:h-20 rounded-full bg-black/30 hover:bg-black/45 border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-90 shadow-2xl backdrop-blur-sm group/play"
            title={isPlaying ? "Durdur" : "Başlat"}
          >
            {isPlaying ? (
              <Pause size={28} fill="#fff" className="text-white transition-transform group-hover/play:scale-110" />
            ) : (
              <Play size={28} fill="#fff" className="ml-1 text-white transition-transform group-hover/play:scale-110" />
            )}
          </button>
          {!isLive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSkipForward();
                if (onMouseMove) onMouseMove();
              }}
              className="pointer-events-auto w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/30 hover:bg-black/45 border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-2xl backdrop-blur-sm group/skip"
              title="10 Sn İleri"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <text x="12" y="13.8" fill="currentColor" stroke="none" fontSize="6.5" fontWeight="black" textAnchor="middle" dominantBaseline="middle">10</text>
              </svg>
            </button>
          )}
        </div>
        <div className={`absolute top-8 left-8 right-8 flex items-center justify-between z-20 transition-all duration-700 ease-in-out ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
          <button
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-3xl shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-all active:scale-90"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-sm font-semibold tracking-wide text-white drop-shadow-md">{channel.name}</span>
          </div>
          <div className="w-10"></div>
        </div>
        <div className={`absolute bottom-10 left-0 right-0 mx-auto w-full max-w-[650px] px-4 z-20 transition-all duration-300 ease-out ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'}`}>
          <div
            className="w-full bg-black/60 rounded-full p-3 flex items-center gap-4 border border-white/10"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
          >
            <button
              className="w-10 h-10 shrink-0 rounded-full bg-white text-black flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
              onClick={onTogglePlay}
            >
              {isPlaying ? <Pause size={18} fill="#000" /> : <Play size={18} fill="#000" className="ml-0.5" />}
            </button>
            <div className="flex items-center shrink-0 group/vol">
              <button
                className="w-9 h-9 rounded-full hover:bg-white/10 hover:text-[var(--accent-color,white)] text-white flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-90 z-10 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] backdrop-blur-sm"
                onClick={onToggleMute}
                title="Sessiz (M)"
              >
                {playerMuted || playerVolume === 0 ? (
                  <VolumeX size={17} className="text-neutral-400 hover:text-red-400 transition-colors duration-300" />
                ) : playerVolume < 0.35 ? (
                  <Volume size={17} className="transition-all duration-300" />
                ) : playerVolume < 0.7 ? (
                  <Volume1 size={17} className="transition-all duration-300" />
                ) : (
                  <Volume2 size={17} className="transition-all duration-300" />
                )}
              </button>

              <div className="relative flex items-center h-6 w-0 opacity-0 pointer-events-none group-hover/vol:w-16 group-hover/vol:ml-2 group-hover/vol:opacity-100 group-hover/vol:pointer-events-auto transition-all duration-300 ease-out overflow-hidden">
                <div className="relative w-16 h-[4px] rounded-full bg-white/25 overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-white rounded-full transition-all duration-75"
                    style={{ width: `${playerMuted ? 0 : playerVolume * 100}%` }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={playerMuted ? 0 : playerVolume}
                    onChange={onVolumeChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    title="Ses Seviyesi (↑↓)"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 flex items-center gap-3 px-2">
              {isLive ? (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[11px] font-semibold text-white/90 tracking-wide uppercase">Canlı Yayın</span>
                </div>
              ) : (
                <>
                  <span className="text-[10px] font-medium text-white/80 tabular-nums">{formatTime(isDraggingTimeline && dragTime !== null ? dragTime : currentTime)}</span>
                  <div
                    ref={timelineRef}
                    className="flex-1 h-6 flex items-center relative cursor-pointer group/timeline"
                    onMouseDown={handleTimelineMouseDown}
                  >
                    <div className="w-full h-1.5 rounded-full bg-white/20 relative group-hover/timeline:h-2 transition-all">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full bg-white"
                        style={{ width: `${duration ? ((isDraggingTimeline && dragTime !== null ? dragTime : currentTime) / duration) * 100 : 0}%` }}
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-xl opacity-0 group-hover/timeline:opacity-100 transition-opacity transform translate-x-1/2" />
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-white/80 tabular-nums">{formatTime(duration)}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 px-1">
              <div ref={settingsRef} className="relative">
                <button
                  className={`w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors ${
                    showSettingsMenu ? 'bg-white/20 text-white' : 'text-white'
                  }`}
                  onClick={() => {
                    setShowSettingsMenu(!showSettingsMenu);
                    setCurrentSubmenu('main');
                  }}
                  title="Ayarlar"
                >
                  <Settings size={14} className={`transition-transform duration-300 ${showSettingsMenu ? 'rotate-45' : ''}`} />
                </button>

                {showSettingsMenu && (
                  <>
                    {currentSubmenu === 'main' && (
                      <div className="absolute bottom-full right-0 mb-3 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-2xl animate-scale-in min-w-[200px] z-30 flex flex-col gap-0.5">
                        <div className="px-3 py-2 text-[10px] font-extrabold text-neutral-400 uppercase border-b border-white/5 mb-1 tracking-wider">
                          Ayarlar
                        </div>
                        <button
                          onClick={() => setCurrentSubmenu('speed')}
                          className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-left text-neutral-300 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-between"
                        >
                          <span className="flex items-center gap-2">
                            <Gauge size={12} className="text-neutral-400" />
                            Oynatma Hızı
                          </span>
                          <span className="text-[11px] text-neutral-400 font-bold flex items-center gap-0.5">
                            {playbackSpeed}x
                            <ChevronRight size={12} className="text-neutral-500" />
                          </span>
                        </button>
                        <button
                          onClick={() => setCurrentSubmenu('subtitles')}
                          className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-left text-neutral-300 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-between"
                        >
                          <span className="flex items-center gap-2">
                            <Subtitles size={12} className="text-neutral-400" />
                            Altyazı
                          </span>
                          <span className="text-[11px] text-neutral-400 font-bold flex items-center gap-0.5 truncate max-w-[90px]">
                            {activeSubtitle === -1 ? 'Kapalı' : (subtitleTracks[activeSubtitle]?.label || 'Açık')}
                            <ChevronRight size={12} className="text-neutral-500" />
                          </span>
                        </button>
                        <button
                          onClick={() => setCurrentSubmenu('scale')}
                          className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-left text-neutral-300 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-between"
                        >
                          <span className="flex items-center gap-2">
                            <Scan size={12} className="text-neutral-400" />
                            Video Ölçeği
                          </span>
                          <span className="text-[11px] text-neutral-400 font-bold flex items-center gap-0.5">
                            {videoScaleMode === 'fit' ? 'Orijinal' :
                             videoScaleMode === 'fill' ? 'Sığdır' :
                             videoScaleMode === 'zoom' ? 'Yakınlaştır' : videoScaleMode}
                            <ChevronRight size={12} className="text-neutral-500" />
                          </span>
                        </button>
                        <button
                          onClick={() => setCurrentSubmenu('audio')}
                          className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-left text-neutral-300 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-between"
                        >
                          <span className="flex items-center gap-2">
                            <Volume2 size={12} className="text-neutral-400" />
                            Ses Kanalı
                          </span>
                          <span className="text-[11px] text-neutral-400 font-bold flex items-center gap-0.5 truncate max-w-[90px]">
                            {displayAudioTracks[activeAudioTrack]?.name || `Parça ${activeAudioTrack + 1}`}
                            <ChevronRight size={12} className="text-neutral-500" />
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            onPiP();
                            setShowSettingsMenu(false);
                          }}
                          className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-left text-neutral-300 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2"
                        >
                          <PictureInPicture size={12} className="text-neutral-400" />
                          PiP Modunu Başlat
                        </button>

                        {channel.type === 'series' && (
                          <>
                            <div className="w-full h-px bg-white/5 my-1" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAutoPlayNext();
                              }}
                              className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-left text-neutral-300 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-between"
                            >
                              <span className="flex items-center gap-2">
                                <SkipForward size={12} className="text-neutral-400" />
                                Otomatik Sonraki Bölüm
                              </span>
                              <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ${autoPlayNext ? 'bg-[var(--accent-color,white)]' : 'bg-neutral-700'}`}>
                                <div className={`w-3 h-3 rounded-full bg-black transition-transform duration-200 transform ${autoPlayNext ? 'translate-x-4' : 'translate-x-0'}`} />
                              </div>
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {currentSubmenu === 'speed' && (
                      <div className="absolute bottom-full right-0 mb-3 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-2xl animate-scale-in min-w-[160px] z-30 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 px-1 py-1.5 border-b border-white/5 mb-1">
                          <button
                            onClick={() => setCurrentSubmenu('main')}
                            className="w-6 h-6 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">Oynatma Hızı</span>
                        </div>
                        {SPEED_OPTIONS.map(optSpeed => (
                          <button
                            key={optSpeed}
                            onClick={() => {
                              onSpeedChange(optSpeed);
                              setShowSettingsMenu(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                              playbackSpeed === optSpeed ? 'bg-white text-black' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {optSpeed === 1 ? 'Normal' : `${optSpeed}x`}
                          </button>
                        ))}
                      </div>
                    )}

                    {currentSubmenu === 'subtitles' && (
                      <div className="absolute bottom-full right-0 mb-3 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-2xl animate-scale-in min-w-[180px] z-30 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 px-1 py-1.5 border-b border-white/5 mb-1">
                          <button
                            onClick={() => setCurrentSubmenu('main')}
                            className="w-6 h-6 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">Altyazı</span>
                        </div>
                        <button
                          onClick={() => {
                            onSubtitleChange(-1);
                            setShowSettingsMenu(false);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                            activeSubtitle === -1 ? 'bg-white text-black' : 'text-neutral-300 hover:bg-white/10'
                          }`}
                        >
                          Altyazı Yok
                        </button>
                        {subtitleTracks.map((track, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              onSubtitleChange(idx);
                              setShowSettingsMenu(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                              activeSubtitle === idx ? 'bg-white text-black' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {track.label}
                          </button>
                        ))}
                        <div className="w-full h-px bg-white/5 my-1" />
                        <label className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-left text-neutral-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer flex items-center gap-2">
                          <Plus size={12} /> Altyazı Yükle (Yerel)
                          <input type="file" accept=".srt,.vtt,.ass" className="hidden" onChange={onSubtitleUpload} />
                        </label>
                      </div>
                    )}



                    {currentSubmenu === 'scale' && (
                      <div className="absolute bottom-full right-0 mb-3 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-2xl animate-scale-in min-w-[180px] z-30 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 px-1 py-1.5 border-b border-white/5 mb-1">
                          <button
                            onClick={() => setCurrentSubmenu('main')}
                            className="w-6 h-6 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">Video Ölçeği</span>
                        </div>
                        {[
                          { mode: 'fit', label: 'Orijinal Oran' },
                          { mode: 'fill', label: 'Ekrana Sığdır' },
                          { mode: 'zoom', label: 'Yakınlaştır (Kırp)' },
                          { mode: '16:9', label: '16:9 Oranı' },
                          { mode: '4:3', label: '4:3 Oranı' }
                        ].map(opt => (
                          <button
                            key={opt.mode}
                            onClick={() => {
                              setVideoScaleMode(opt.mode as any);
                              setShowSettingsMenu(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                              videoScaleMode === opt.mode ? 'bg-white text-black' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {currentSubmenu === 'audio' && (
                      <div className="absolute bottom-full right-0 mb-3 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-2xl animate-scale-in min-w-[180px] z-30 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 px-1 py-1.5 border-b border-white/5 mb-1">
                          <button
                            onClick={() => setCurrentSubmenu('main')}
                            className="w-6 h-6 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">Ses Kanalı</span>
                        </div>
                        {displayAudioTracks.map((track) => (
                          <button
                            key={track.id}
                            disabled={audioTracks.length <= 1}
                            onClick={() => {
                              onAudioTrackChange(track.id);
                              setShowSettingsMenu(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors disabled:opacity-50 disabled:pointer-events-none ${
                              activeAudioTrack === track.id ? 'bg-white text-black' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {track.name || `Parça ${track.id + 1}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <button
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  showSidebarList ? 'bg-white/20 text-white font-bold' : 'hover:bg-white/20 text-white'
                }`}
                onClick={() => {
                  setShowSidebarList(!showSidebarList);
                  setShowRecentPanel(false);
                }}
                title="Kanal Listesi (Enter)"
              >
                <ListCollapse size={14} />
              </button>
              <button
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  showRecentPanel ? 'bg-white/20 text-white font-bold' : 'hover:bg-white/20 text-white'
                }`}
                onClick={() => {
                  setShowRecentPanel(!showRecentPanel);
                  setShowSidebarList(false);
                }}
                title="Son İzlenenler (Tab)"
              >
                <History size={14} />
              </button>
              <button
                className="w-8 h-8 rounded-full hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                onClick={onToggleFullscreen}
                title="Tam Ekran (F)"
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
