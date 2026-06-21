import type { CSSProperties } from 'react';
import type { PlaylistItem } from '../utils/m3uParser';
import { useCinematicPlayer } from '../hooks/useCinematicPlayer';
import { CinematicPlayer } from './CinematicPlayer';

interface PlayerScreenProps {
  channel: PlaylistItem;
  channels: PlaylistItem[];
  accentStyles: CSSProperties;
  onChannelChange: (channel: PlaylistItem) => void;
  onClose: () => void;
  saveWatchProgress: (item: PlaylistItem, time: number, total: number) => void;
  showToast: (message: string) => void;
}

export function PlayerScreen({
  channel,
  channels,
  accentStyles,
  onChannelChange,
  onClose,
  saveWatchProgress,
  showToast
}: PlayerScreenProps) {
  const player = useCinematicPlayer({
    selectedChannel: channel,
    saveWatchProgress,
    showToast
  });

  const handleClose = () => {
    if (player.videoRef.current && player.duration > 0) {
      saveWatchProgress(channel, player.videoRef.current.currentTime, player.duration);
    }
    onClose();
  };

  return (
    <CinematicPlayer
      channel={channel}
      channels={channels}
      onChannelChange={onChannelChange}
      videoRef={player.videoRef}
      playerContainerRef={player.playerContainerRef}
      isPlaying={player.isPlaying}
      currentTime={player.currentTime}
      duration={player.duration}
      playerVolume={player.playerVolume}
      playerMuted={player.playerMuted}
      showControls={player.showControls}
      videoReady={player.videoReady}
      playbackSpeed={player.playbackSpeed}
      showSpeedMenu={player.showSpeedMenu}
      audioTracks={player.audioTracks}
      activeAudioTrack={player.activeAudioTrack}
      subtitleTracks={player.subtitleTracks}
      activeSubtitle={player.activeSubtitle}
      showSubtitleMenu={player.showSubtitleMenu}
      isFullscreen={player.isFullscreen}
      accentStyles={accentStyles}
      onClose={handleClose}
      onTogglePlay={player.handleTogglePlay}
      onToggleMute={player.handleTogglePlayerMute}
      onVolumeChange={player.handlePlayerVolumeChange}
      onSpeedChange={player.handleSpeedChange}
      onAudioTrackChange={player.handleAudioTrackChange}
      onSubtitleChange={player.setActiveSubtitle}
      onSubtitleUpload={player.handleSubtitleUpload}
      onPiP={player.handlePlayerPiP}
      onToggleFullscreen={player.handleToggleFullscreen}
      onTimelineSeek={player.handleTimelineSeek}
      onSeek={player.handlePlayerSeek}
      onHideControls={() => player.setShowControls(false)}
      onShowSpeedMenu={player.setShowSpeedMenu}
      onShowSubtitleMenu={player.setShowSubtitleMenu}
      formatTime={player.formatPlayerTime}
      onMouseMove={player.handlePlayerMouseMove}
      onMouseLeave={player.handlePlayerMouseLeave}
    />
  );
}
