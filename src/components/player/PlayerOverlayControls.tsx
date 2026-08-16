import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, LoaderCircle, Pause, Play } from 'lucide-react';
import type { PlaylistItem } from '../../utils/m3uParser';

export interface PlayerSkipOverlay {
  direction: 'forward' | 'backward';
  amount: number;
  key: number;
}

interface PlayerOverlayControlsProps {
  language: 'tr' | 'en';
  t: (key: string) => string;
  channel: PlaylistItem;
  skipOverlay: PlayerSkipOverlay | null;
  nextEpisode: PlaylistItem | null;
  duration: number;
  currentTime: number;
  autoPlayNext: boolean;
  isAutoplayCancelled: boolean;
  shouldShowPlaybackOverlay: boolean;
  isPlaybackError: boolean;
  playbackStatus: 'loading' | 'playing' | 'recovering' | 'transcoding' | 'seeking' | 'error';
  playbackMessage: string;
  contentLabel: string;
  showControls: boolean;
  isSeeking: boolean;
  isLive: boolean;
  isPlaying: boolean;
  title: string;
  episodeMeta?: string;
  onChannelChange: (channel: PlaylistItem) => void;
  onCancelAutoplay: () => void;
  onHideControls: () => void;
  onClose: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  onTogglePlay: () => void;
  onMouseMove?: () => void;
}

export function PlayerOverlayControls(props: PlayerOverlayControlsProps) {
  const {
    language, t, channel, skipOverlay, nextEpisode, duration, currentTime,
    autoPlayNext, isAutoplayCancelled, shouldShowPlaybackOverlay, isPlaybackError,
    playbackStatus, playbackMessage, contentLabel, showControls, isSeeking, isLive,
    isPlaying, title, episodeMeta, onChannelChange, onCancelAutoplay, onHideControls,
    onClose, onSkipBackward: handleSkipBackward, onSkipForward: handleSkipForward,
    onTogglePlay, onMouseMove,
  } = props;
  const currentEpisodeInfo = episodeMeta ? true : null;
  return (
  <>
  {/* Skip Animation Overlay */}
  {skipOverlay && (
    <div className="absolute inset-0 pointer-events-none z-10 flex select-none overflow-hidden">
      {/* Left Side (Backward) */}
      <div className={`w-1/2 h-full relative flex items-center justify-center transition-opacity duration-200 ${skipOverlay.direction === 'backward' ? 'opacity-100' : 'opacity-0'}`}>
        {skipOverlay.direction === 'backward' && (
          <>
            <div key={skipOverlay.key} className="absolute left-0 top-1/2 -translate-y-1/2 w-full aspect-square max-w-[360px] bg-gradient-to-r from-white/[0.07] to-transparent animate-skip-ripple-left pointer-events-none rounded-full" />
            <div className="flex flex-col items-center gap-1 z-10 animate-fade-in">
              <div className="flex gap-0.5 text-white/95">
                <ChevronLeft size={28} className="animate-chevron-left-1" />
                <ChevronLeft size={28} className="animate-chevron-left-2" />
                <ChevronLeft size={28} className="animate-chevron-left-3" />
              </div>
              <span className="text-sm font-black tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                -{skipOverlay.amount} {language === 'tr' ? 'Sn' : 'Sec'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right Side (Forward) */}
      <div className={`w-1/2 h-full relative flex items-center justify-center transition-opacity duration-200 ${skipOverlay.direction === 'forward' ? 'opacity-100' : 'opacity-0'}`}>
        {skipOverlay.direction === 'forward' && (
          <>
            <div key={skipOverlay.key} className="absolute right-0 top-1/2 -translate-y-1/2 w-full aspect-square max-w-[360px] bg-gradient-to-l from-white/[0.07] to-transparent animate-skip-ripple-right pointer-events-none rounded-full" />
            <div className="flex flex-col items-center gap-1 z-10 animate-fade-in">
              <div className="flex gap-0.5 text-white/95">
                <ChevronRight size={28} className="animate-chevron-right-1" />
                <ChevronRight size={28} className="animate-chevron-right-2" />
                <ChevronRight size={28} className="animate-chevron-right-3" />
              </div>
              <span className="text-sm font-black tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                +{skipOverlay.amount} {language === 'tr' ? 'Sn' : 'Sec'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )}

  {channel.type === 'series' && nextEpisode && duration > 35 && (duration - currentTime <= 35) && (duration - currentTime > 1) && !isAutoplayCancelled && (
    <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ((e) => e.stopPropagation())(e as any); } }} tabIndex={0} role="button"
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-28 right-8 z-30 bg-neutral-950/90 border border-white/10 backdrop-blur-2xl p-5 rounded-2xl shadow-2xl flex flex-col gap-3 min-w-[280px] max-w-[90%] animate-scale-in"
    >
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-extrabold text-[var(--accent-color,white)] uppercase tracking-widest">{language === 'tr' ? 'Sonraki Bölüm' : 'Next Episode'}</span>
        <span className="text-xs font-bold text-white line-clamp-1">{nextEpisode.name}</span>
        <span className="text-[10px] text-neutral-400">
          {autoPlayNext
            ? (language === 'tr' ? `${Math.max(0, Math.ceil(duration - currentTime))} saniye içinde başlıyor...` : `Starting in ${Math.max(0, Math.ceil(duration - currentTime))} seconds...`)
            : (language === 'tr' ? 'Sonraki bölüm hazır' : 'Next episode is ready')}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChannelChange(nextEpisode);
          }}
          className="flex-1 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-neutral-200 active:scale-95 transition-all flex items-center justify-center gap-1.5"
         aria-label="Play">
          <Play size={12} fill="#000" />
          {language === 'tr' ? 'Şimdi Oynat' : 'Play Now'}
        </button>
        {autoPlayNext && (
          <button type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancelAutoplay();
            }}
            className="px-3 py-2 bg-white/5 border border-white/10 text-white font-bold text-xs rounded-xl hover:bg-white/10 active:scale-95 transition-all"
          >
            {language === 'tr' ? 'İptal' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  )}


  <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (() => {
      onHideControls();
    })(); } }} tabIndex={0} role="button"
    className="absolute inset-0 z-0 cursor-pointer"
    onClick={() => {
      onHideControls();
    }}
  />

  {shouldShowPlaybackOverlay && (
    <div className="absolute inset-0 bg-black/75 backdrop-blur-2xl flex flex-col items-center justify-center gap-4 z-30 animate-fade-in px-6 text-center">
      {isPlaybackError ? (
        <AlertCircle size={38} className="text-red-300" />
      ) : (
        <LoaderCircle size={38} className="text-white/80 animate-spin" />
      )}
      <div className="flex max-w-md flex-col items-center gap-2">
        <span className={`text-sm font-bold tracking-wide ${isPlaybackError ? 'text-red-100' : 'text-white/85'}`}>
          {isPlaybackError
            ? (language === 'tr' ? `${contentLabel} açılamadı` : `${contentLabel} could not be opened`)
            : (playbackStatus === 'transcoding'
              ? (language === 'tr' ? 'Uyumluluk modu deneniyor' : 'Trying compatibility mode')
              : playbackStatus === 'recovering'
                ? (language === 'tr' ? 'Akış kurtarılıyor' : 'Recovering stream')
                : t('common.loading'))}
        </span>
        <span className="text-xs leading-5 text-white/55">
          {playbackMessage || (language === 'tr' ? `${contentLabel} hazırlanıyor...` : `${contentLabel} is loading...`)}
        </span>
      </div>
      {isPlaybackError && (
        <button type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="mt-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-white/20 active:scale-95"
        >
          {language === 'tr' ? 'Geri dön' : 'Go Back'}
        </button>
      )}
    </div>
  )}
  <div
    className={`absolute inset-0 flex items-center justify-center gap-10 md:gap-14 z-20 pointer-events-none transform-gpu will-change-[opacity,transform] transition-all duration-100 ease-out ${
      showControls || isSeeking ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
    }`}
  >
    {!isLive && (
      <button type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleSkipBackward();
          if (onMouseMove) onMouseMove();
        }}
        className="pointer-events-auto w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/30 hover:bg-black/45 border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-2xl backdrop-blur-sm group/skip"
        title={language === 'tr' ? '10 Sn Geri' : '10 Sec Backward'}
       aria-label={language === 'tr' ? '10 Sn Geri' : '10 Sec Backward'}>
        <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <text x="12" y="13.8" fill="currentColor" stroke="none" fontSize="6.5" fontWeight="black" textAnchor="middle" dominantBaseline="middle">10</text>
        </svg>
      </button>
    )}
    <button type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (isSeeking) return;
        onTogglePlay();
        if (onMouseMove) onMouseMove();
      }}
      disabled={isSeeking}
      aria-busy={isSeeking}
      className={`pointer-events-auto w-16 h-16 md:w-20 md:h-20 rounded-full border text-white flex items-center justify-center transition-all shadow-2xl backdrop-blur-sm group/play ${
        isSeeking
          ? 'bg-white/[0.14] border-white/25 shadow-[0_0_0_8px_rgba(255,255,255,0.04),0_0_34px_rgba(255,255,255,0.16)] cursor-wait'
          : 'bg-black/30 hover:bg-black/45 border-white/10 hover:scale-105 active:scale-90'
      }`}
      title={isPlaying ? (language === 'tr' ? 'Durdur' : 'Pause') : (language === 'tr' ? 'Başlat' : 'Play')}
     aria-label={isPlaying ? (language === 'tr' ? 'Durdur' : 'Pause') : (language === 'tr' ? 'Başlat' : 'Play')}>
      {isSeeking ? (
        <LoaderCircle size={30} strokeWidth={2.2} className="text-white/95 animate-spin" />
      ) : isPlaying ? (
        <Pause size={28} fill="#fff" className="text-white transition-transform group-hover/play:scale-110" />
      ) : (
        <Play size={28} fill="#fff" className="ml-1 text-white transition-transform group-hover/play:scale-110" />
      )}
    </button>
    {!isLive && (
      <button type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleSkipForward();
          if (onMouseMove) onMouseMove();
        }}
        className="pointer-events-auto w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/30 hover:bg-black/45 border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-2xl backdrop-blur-sm group/skip"
        title={language === 'tr' ? '10 Sn İleri' : '10 Sec Forward'}
       aria-label={language === 'tr' ? '10 Sn İleri' : '10 Sec Forward'}>
        <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <text x="12" y="13.8" fill="currentColor" stroke="none" fontSize="6.5" fontWeight="black" textAnchor="middle" dominantBaseline="middle">10</text>
        </svg>
      </button>
    )}
  </div>
  <div className={`absolute top-8 left-8 right-8 flex items-center justify-between z-20 transform-gpu will-change-[opacity,transform] transition-all duration-100 ease-out ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
    <button type="button"
      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-3xl shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-all active:scale-90"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      aria-label={language === 'tr' ? 'Geri' : 'Back'}
    >
      <ArrowLeft size={18} />
    </button>
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-sm font-semibold tracking-wide text-white drop-shadow-md">
        {title}
      </span>
      {currentEpisodeInfo && (
        <span className="text-[10px] font-medium tracking-wide text-white/65 drop-shadow-md">
          {episodeMeta}
        </span>
      )}
    </div>
    <div className="w-10"></div>
  </div>
  </>
  );
}
