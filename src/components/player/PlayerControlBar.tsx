import type { ChangeEvent, Dispatch, MouseEvent, RefObject, SetStateAction } from 'react';
import { Maximize2, Minimize2, SkipBack, SkipForward } from 'lucide-react';
import type { PlaylistItem } from '../../utils/m3uParser';
import { parseSeriesEpisodeInfo } from '../../utils/seriesGroupers';
import type { PlayerQualityLevel } from '../../hooks/useCinematicPlayer';
import { IconMorph } from '../IconMorph';
import { PlayerSettingsMenu, type PlayerSettingsSubmenu, type PlayerVideoScaleMode } from './PlayerSettingsMenu';

interface PlayerControlBarProps {
  language: 'tr' | 'en';
  t: (key: string) => string;
  showControls: boolean;
  channel: PlaylistItem;
  isPlaying: boolean;
  isLive: boolean;
  currentTime: number;
  duration: number;
  bufferedProgress: number;
  playerMuted: boolean;
  playerVolume: number;
  isFullscreen: boolean;
  isDraggingTimeline: boolean;
  dragTime: number | null;
  hoverTime: number | null;
  hoverPosition: number;
  timelineRef: RefObject<HTMLDivElement | null>;
  prevEpisode: PlaylistItem | null;
  nextEpisode: PlaylistItem | null;
  formatTime: (time: number) => string;
  formatEpisodeMeta: (item: PlaylistItem) => string;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolumeChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onChannelChange: (channel: PlaylistItem) => void;
  onTimelineMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
  onTimelineMouseMove: (event: MouseEvent<HTMLDivElement>) => void;
  onTimelineMouseLeave: () => void;
  onToggleFullscreen: () => void;
  settingsRef: RefObject<HTMLDivElement | null>;
  showSettingsMenu: boolean;
  setShowSettingsMenu: Dispatch<SetStateAction<boolean>>;
  currentSubmenu: PlayerSettingsSubmenu;
  setCurrentSubmenu: Dispatch<SetStateAction<PlayerSettingsSubmenu>>;
  playbackSpeed: number;
  qualityLevels: PlayerQualityLevel[];
  activeQualityLevel: number;
  sourceQualityLabel: string;
  sourceTypeLabel: string;
  subtitleTracks: { label: string; srclang: string; src: string }[];
  activeSubtitle: number;
  displayAudioTracks: { id: number; name: string; lang: string }[];
  audioTracks: { id: number; name: string; lang: string }[];
  activeAudioTrack: number;
  autoPlayNext: boolean;
  setAutoPlayNext: Dispatch<SetStateAction<boolean>>;
  videoScaleMode: PlayerVideoScaleMode;
  setVideoScaleMode: Dispatch<SetStateAction<PlayerVideoScaleMode>>;
  onSpeedChange: (speed: number) => void;
  onQualityChange: (levelId: number) => void;
  onAudioTrackChange: (id: number) => void;
  onSubtitleChange: (index: number) => void;
  onSubtitleUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onPiP: () => void;
}

export function PlayerControlBar(props: PlayerControlBarProps) {
  const {
    language, t, showControls, channel, isPlaying, isLive, currentTime, duration,
    bufferedProgress, playerMuted, playerVolume, isFullscreen, isDraggingTimeline,
    dragTime, hoverTime, hoverPosition, timelineRef, prevEpisode, nextEpisode,
    formatTime, formatEpisodeMeta, onTogglePlay, onToggleMute, onVolumeChange,
    onChannelChange, onTimelineMouseDown, onTimelineMouseMove, onTimelineMouseLeave,
    onToggleFullscreen, settingsRef, showSettingsMenu, setShowSettingsMenu,
    currentSubmenu, setCurrentSubmenu, playbackSpeed, qualityLevels, activeQualityLevel,
    sourceQualityLabel, sourceTypeLabel, subtitleTracks, activeSubtitle, displayAudioTracks,
    audioTracks, activeAudioTrack, autoPlayNext, setAutoPlayNext, videoScaleMode,
    setVideoScaleMode, onSpeedChange, onQualityChange, onAudioTrackChange,
    onSubtitleChange, onSubtitleUpload, onPiP,
  } = props;
  return (
  <div className={`absolute bottom-10 left-0 right-0 mx-auto w-full max-w-[900px] px-6 z-20 transform-gpu will-change-[opacity,transform] transition-all duration-100 ease-out ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'}`}>
    <div
      className="w-full bg-black/60 backdrop-blur-xl rounded-full px-4 py-3 flex items-center gap-3 border border-white/10 transform-gpu"
      style={{
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        backfaceVisibility: 'hidden'
      }}
    >
      {channel.type === 'series' && (
        <div className="group/episode-nav relative shrink-0">
          <button type="button"
            disabled={!prevEpisode}
            onClick={(e) => {
              e.stopPropagation();
              if (prevEpisode) onChannelChange(prevEpisode);
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            title={language === 'tr' ? 'Önceki Bölüm' : 'Previous Episode'}
           aria-label={language === 'tr' ? 'Önceki Bölüm' : 'Previous Episode'}>
            <SkipBack size={12} fill="currentColor" />
          </button>
          {prevEpisode && (
            <div className="pointer-events-none absolute bottom-full left-0 mb-3 w-max max-w-[220px] -translate-y-1 rounded-xl border border-white/10 bg-black/85 px-3 py-2 opacity-0 shadow-xl backdrop-blur-xl transition-all duration-150 group-hover/episode-nav:translate-y-0 group-hover/episode-nav:opacity-100">
              <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/40">{language === 'tr' ? 'Önceki Bölüm' : 'Previous Episode'}</div>
              <div className="mt-1 truncate text-[11px] font-semibold text-white">{parseSeriesEpisodeInfo(prevEpisode.name).cleanTitle}</div>
              <div className="text-[9px] font-medium text-white/50">{formatEpisodeMeta(prevEpisode)}</div>
            </div>
          )}
        </div>
      )}
      <button type="button"
        className="w-10 h-10 shrink-0 rounded-full bg-white text-black flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        onClick={onTogglePlay}
        aria-label="Play">
        <IconMorph type="play-pause" active={isPlaying} size={18} />
      </button>
      {channel.type === 'series' && (
        <div className="group/episode-nav relative shrink-0">
          <button type="button"
            disabled={!nextEpisode}
            onClick={(e) => {
              e.stopPropagation();
              if (nextEpisode) onChannelChange(nextEpisode);
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            title={language === 'tr' ? 'Sonraki Bölüm' : 'Next Episode'}
           aria-label={language === 'tr' ? 'Sonraki Bölüm' : 'Next Episode'}>
            <SkipForward size={12} fill="currentColor" />
          </button>
          {nextEpisode && (
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-3 w-max max-w-[220px] -translate-x-1/2 -translate-y-1 rounded-xl border border-white/10 bg-black/85 px-3 py-2 opacity-0 shadow-xl backdrop-blur-xl transition-all duration-150 group-hover/episode-nav:translate-y-0 group-hover/episode-nav:opacity-100">
              <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/40">{language === 'tr' ? 'Sonraki Bölüm' : 'Next Episode'}</div>
              <div className="mt-1 truncate text-[11px] font-semibold text-white">{parseSeriesEpisodeInfo(nextEpisode.name).cleanTitle}</div>
              <div className="text-[9px] font-medium text-white/50">{formatEpisodeMeta(nextEpisode)}</div>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center shrink-0 group/vol">
        <button type="button"
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shrink-0"
          onClick={onToggleMute}
          title={language === 'tr' ? 'Sessiz (M)' : 'Mute (M)'}
         aria-label={language === 'tr' ? 'Sessiz (M)' : 'Mute (M)'}>
          <IconMorph type="volume" active={playerMuted || playerVolume === 0} size={17} />
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
              title={language === 'tr' ? 'Ses Seviyesi (↑↓)' : 'Volume Level (↑↓)'}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center gap-3 px-2">
        {isLive ? (
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-white/90 tracking-wide uppercase">{language === 'tr' ? 'Canlı Yayın' : 'Live Stream'}</span>
          </div>
        ) : (
          <>
            <span className="text-[10px] font-medium text-white/80 tabular-nums">{formatTime(isDraggingTimeline && dragTime !== null ? dragTime : currentTime)}</span>
            <div
              ref={timelineRef}
              className="flex-1 h-6 flex items-center relative cursor-pointer group/timeline"
                    onMouseDown={onTimelineMouseDown}
                    onMouseMove={onTimelineMouseMove}
                    onMouseLeave={onTimelineMouseLeave}
            >
              {hoverTime !== null && duration > 0 && (
                <div
                  className="pointer-events-none absolute bottom-full z-40 mb-2 -translate-x-1/2 rounded-lg border border-white/10 bg-black/85 px-2.5 py-1.5 text-[10px] font-bold tabular-nums text-white shadow-xl backdrop-blur-md"
                  style={{ left: `${Math.min(92, Math.max(8, hoverPosition * 100))}%` }}
                >
                  {formatTime(isDraggingTimeline && dragTime !== null ? dragTime : hoverTime)}
                </div>
              )}
              <div className="w-full h-1.5 rounded-full bg-white/10 relative group-hover/timeline:h-2 transition-all">
                {bufferedProgress > 0 && duration > 0 && (
                  <div
                    className="absolute left-0 top-0 h-full rounded-full bg-white/20 transition-all duration-300"
                    style={{ width: `${Math.min(100, bufferedProgress)}%` }}
                  />
                )}
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
        <PlayerSettingsMenu
          settingsRef={settingsRef}
          showSettingsMenu={showSettingsMenu}
          setShowSettingsMenu={setShowSettingsMenu}
          currentSubmenu={currentSubmenu}
          setCurrentSubmenu={setCurrentSubmenu}
          t={t}
          language={language}
          playbackSpeed={playbackSpeed}
          qualityLevels={qualityLevels}
          activeQualityLevel={activeQualityLevel}
          sourceQualityLabel={sourceQualityLabel}
          sourceTypeLabel={sourceTypeLabel}
          subtitleTracks={subtitleTracks}
          activeSubtitle={activeSubtitle}
          displayAudioTracks={displayAudioTracks}
          audioTracks={audioTracks}
          activeAudioTrack={activeAudioTrack}
          channelType={channel.type}
          autoPlayNext={autoPlayNext}
          setAutoPlayNext={setAutoPlayNext}
          videoScaleMode={videoScaleMode}
          setVideoScaleMode={setVideoScaleMode}
          onSpeedChange={onSpeedChange}
          onQualityChange={onQualityChange}
          onAudioTrackChange={onAudioTrackChange}
          onSubtitleChange={onSubtitleChange}
          onSubtitleUpload={onSubtitleUpload}
          onPiP={onPiP}
        />
        <button type="button"
          className="w-8 h-8 rounded-full hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          onClick={onToggleFullscreen}
          title={language === 'tr' ? 'Tam Ekran (F)' : 'Fullscreen (F)'}
         aria-label={language === 'tr' ? 'Tam Ekran (F)' : 'Fullscreen (F)'}>
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  </div>
  );
}
