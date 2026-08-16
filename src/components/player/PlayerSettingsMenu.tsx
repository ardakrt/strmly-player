import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react';
import { ChevronLeft, ChevronRight, Gauge, PictureInPicture, Plus, Scan, Settings, SkipForward, Subtitles, Volume2, X } from 'lucide-react';
import { SPEED_OPTIONS } from '../../constants';
import type { PlayerQualityLevel } from '../../hooks/useCinematicPlayer';

export type PlayerSettingsSubmenu = 'main' | 'speed' | 'quality' | 'subtitles' | 'scale' | 'audio';
export type PlayerVideoScaleMode = 'fit' | 'fill' | 'zoom' | '16:9' | '4:3';

interface PlayerSettingsMenuProps {
  settingsRef: RefObject<HTMLDivElement | null>;
  showSettingsMenu: boolean;
  setShowSettingsMenu: Dispatch<SetStateAction<boolean>>;
  currentSubmenu: PlayerSettingsSubmenu;
  setCurrentSubmenu: Dispatch<SetStateAction<PlayerSettingsSubmenu>>;
  t: (key: string) => string;
  language: 'tr' | 'en';
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
  channelType: string;
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

export function PlayerSettingsMenu(props: PlayerSettingsMenuProps) {
  const {
    settingsRef, showSettingsMenu, setShowSettingsMenu, currentSubmenu, setCurrentSubmenu,
    t, language, playbackSpeed, qualityLevels, activeQualityLevel, sourceQualityLabel,
    sourceTypeLabel, subtitleTracks, activeSubtitle, displayAudioTracks, audioTracks,
    activeAudioTrack, channelType, autoPlayNext, setAutoPlayNext, videoScaleMode,
    setVideoScaleMode, onSpeedChange, onQualityChange, onAudioTrackChange,
    onSubtitleChange, onSubtitleUpload, onPiP,
  } = props;
  const channel = { type: channelType };
  return (
    <div ref={settingsRef} className="relative">
      <button type="button"
        className={`w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors ${
          showSettingsMenu ? 'bg-white/20 text-white' : 'text-white'
        }`}
        onClick={() => {
          setShowSettingsMenu(!showSettingsMenu);
          setCurrentSubmenu('main');
        }}
        title={t('settings.title')}
       aria-label={t('settings.title')}>
        <Settings size={14} className={`transition-transform duration-300 ${showSettingsMenu ? 'rotate-45' : ''}`} />
      </button>

      {showSettingsMenu && (
        <>
          {currentSubmenu === 'main' && (
            <div className="absolute bottom-full right-0 z-30 mb-3 w-[272px] overflow-hidden rounded-[20px] border border-white/10 bg-[#09090b]/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl animate-scale-in">
              <div className="flex items-center justify-between px-2.5 pb-2 pt-1.5">
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white">{t('settings.title')}</div>
                  <div className="mt-0.5 text-[9px] font-medium text-white/35">{language === 'tr' ? 'Oynatma tercihleri' : 'Playback preferences'}</div>
                </div>
                <button type="button"
                  onClick={() => setShowSettingsMenu(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                  title={language === 'tr' ? 'Kapat' : 'Close'}
                 aria-label={language === 'tr' ? 'Kapat' : 'Close'}>
                  <X size={13} />
                </button>
              </div>

              <div className="h-px bg-white/[0.07]" />
              <div className="px-2.5 pb-1 pt-2.5 text-[8px] font-bold uppercase tracking-[0.16em] text-white/30">
                {language === 'tr' ? 'Video ve ses' : 'Video and audio'}
              </div>

              <div className="flex flex-col gap-1">
                <button type="button" onClick={() => setCurrentSubmenu('speed')} className="group/menu flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left transition-colors hover:bg-white/[0.07]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/55 transition-colors group-hover/menu:bg-white/10 group-hover/menu:text-white"><Gauge size={14} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-white/90">{language === 'tr' ? 'Oynatma Hızı' : 'Playback Speed'}</span><span className="mt-0.5 block text-[9px] text-white/35">{language === 'tr' ? 'Video hızını değiştir' : 'Change playback rate'}</span></span>
                  <span className="flex items-center gap-1 rounded-md bg-white/[0.07] px-2 py-1 text-[9px] font-bold text-white/65">{playbackSpeed}x <ChevronRight size={10} /></span>
                </button>

                <button type="button" onClick={() => setCurrentSubmenu('quality')} className="group/menu flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left transition-colors hover:bg-white/[0.07]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/55 transition-colors group-hover/menu:bg-white/10 group-hover/menu:text-white"><Gauge size={14} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-white/90">{language === 'tr' ? 'Kalite' : 'Quality'}</span><span className="mt-0.5 block text-[9px] text-white/35">{sourceTypeLabel}</span></span>
                  <span className="flex max-w-[82px] items-center gap-1 truncate rounded-md bg-white/[0.07] px-2 py-1 text-[9px] font-bold text-white/65">{sourceQualityLabel} <ChevronRight size={10} className="shrink-0" /></span>
                </button>

                <button type="button" onClick={() => setCurrentSubmenu('subtitles')} className="group/menu flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left transition-colors hover:bg-white/[0.07]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/55 transition-colors group-hover/menu:bg-white/10 group-hover/menu:text-white"><Subtitles size={14} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-white/90">{t('player.subtitles')}</span><span className="mt-0.5 block truncate text-[9px] text-white/35">{language === 'tr' ? 'Dil veya yerel dosya seç' : 'Choose language or local file'}</span></span>
                  <span className="flex max-w-[72px] items-center gap-1 truncate rounded-md bg-white/[0.07] px-2 py-1 text-[9px] font-bold text-white/65">{activeSubtitle === -1 ? (language === 'tr' ? 'Kapalı' : 'Off') : (subtitleTracks[activeSubtitle]?.label || (language === 'tr' ? 'Açık' : 'On'))} <ChevronRight size={10} className="shrink-0" /></span>
                </button>

                <button type="button" onClick={() => setCurrentSubmenu('scale')} className="group/menu flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left transition-colors hover:bg-white/[0.07]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/55 transition-colors group-hover/menu:bg-white/10 group-hover/menu:text-white"><Scan size={14} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-white/90">{language === 'tr' ? 'Görüntü Oranı' : 'Aspect Ratio'}</span><span className="mt-0.5 block text-[9px] text-white/35">{language === 'tr' ? 'Sığdır, doldur veya kırp' : 'Fit, fill, or crop'}</span></span>
                  <span className="flex items-center gap-1 rounded-md bg-white/[0.07] px-2 py-1 text-[9px] font-bold text-white/65">{videoScaleMode === 'fit' ? (language === 'tr' ? 'Orijinal' : 'Original') : videoScaleMode === 'fill' ? (language === 'tr' ? 'Sığdır' : 'Fit') : videoScaleMode === 'zoom' ? (language === 'tr' ? 'Kırp' : 'Crop') : videoScaleMode} <ChevronRight size={10} /></span>
                </button>

                <button type="button" onClick={() => setCurrentSubmenu('audio')} className="group/menu flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left transition-colors hover:bg-white/[0.07]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/55 transition-colors group-hover/menu:bg-white/10 group-hover/menu:text-white"><Volume2 size={14} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-white/90">{t('player.audio')}</span><span className="mt-0.5 block text-[9px] text-white/35">{language === 'tr' ? 'Ses kanalını değiştir' : 'Change audio track'}</span></span>
                  <span className="flex max-w-[76px] items-center gap-1 truncate rounded-md bg-white/[0.07] px-2 py-1 text-[9px] font-bold text-white/65">{displayAudioTracks[activeAudioTrack]?.name || (language === 'tr' ? `Parça ${activeAudioTrack + 1}` : `Track ${activeAudioTrack + 1}`)} <ChevronRight size={10} className="shrink-0" /></span>
                </button>
              </div>

              <div className="my-2 h-px bg-white/[0.07]" />
              {channel.type === 'series' && (
                <button type="button"
                  onClick={() => setAutoPlayNext(prev => !prev)}
                  className="group/autoplay flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.07]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-white/55 group-hover/autoplay:bg-white/10 group-hover/autoplay:text-white"><SkipForward size={14} /></span>
                  <span className="flex-1 text-[11px] font-semibold text-white/80">{language === 'tr' ? 'Sonraki bölüm' : 'Next episode'}</span>
                  <span className={`rounded-md px-2 py-1 text-[8px] font-bold ${autoPlayNext ? 'bg-white text-black' : 'border border-white/10 text-white/35'}`}>
                    {autoPlayNext ? (language === 'tr' ? 'AÇIK' : 'ON') : (language === 'tr' ? 'KAPALI' : 'OFF')}
                  </span>
                </button>
              )}
              <button type="button"
                onClick={() => { onPiP(); setShowSettingsMenu(false); }}
                className="group/pip flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.07]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-white/55 group-hover/pip:bg-white/10 group-hover/pip:text-white"><PictureInPicture size={14} /></span>
                <span className="flex-1 text-[11px] font-semibold text-white/80">{language === 'tr' ? 'Resim içinde resim' : 'Picture in Picture'}</span>
                <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[8px] font-bold text-white/35">PiP</span>
              </button>
            </div>
          )}

          {currentSubmenu === 'speed' && (
            <div className="absolute bottom-full right-0 z-30 mb-3 w-[240px] rounded-[20px] border border-white/10 bg-[#09090b]/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl animate-scale-in">
              <div className="mb-2 flex items-center gap-2 border-b border-white/[0.07] px-1 pb-2">
                <button type="button"
                  onClick={() => setCurrentSubmenu('main')}
                  className="w-6 h-6 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
                 aria-label="Previous">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">{language === 'tr' ? 'Oynatma Hızı' : 'Playback Speed'}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {SPEED_OPTIONS.map(optSpeed => (
                  <button type="button"
                    key={optSpeed}
                    onClick={() => { onSpeedChange(optSpeed); setShowSettingsMenu(false); }}
                    className={`rounded-xl px-2 py-2.5 text-[10px] font-bold transition-all ${playbackSpeed === optSpeed ? 'bg-white text-black shadow-lg' : 'bg-white/[0.05] text-white/65 hover:bg-white/10 hover:text-white'}`}
                  >
                    {optSpeed === 1 ? (language === 'tr' ? 'Normal' : 'Normal') : `${optSpeed}x`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentSubmenu === 'quality' && (
            <div className="absolute bottom-full right-0 z-30 mb-3 w-[240px] rounded-[20px] border border-white/10 bg-[#09090b]/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl animate-scale-in">
              <div className="mb-2 flex items-center gap-2 border-b border-white/[0.07] px-1 pb-2">
                <button type="button"
                  onClick={() => setCurrentSubmenu('main')}
                  className="w-6 h-6 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
                 aria-label="Previous">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">{language === 'tr' ? 'Kalite' : 'Quality'}</span>
              </div>
              {qualityLevels.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  <button type="button"
                    onClick={() => { onQualityChange(-1); setShowSettingsMenu(false); }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                      activeQualityLevel === -1 ? 'bg-white text-black' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {language === 'tr' ? 'Otomatik' : 'Auto'}
                  </button>
                  {qualityLevels.toSorted((a, b) => (b.height || 0) - (a.height || 0)).map(level => (
                    <button type="button"
                      key={level.id}
                      onClick={() => { onQualityChange(level.id); setShowSettingsMenu(false); }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                        activeQualityLevel === level.id ? 'bg-white text-black' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-white/[0.05] px-3 py-3">
                  <div className="text-xs font-bold text-white">{sourceQualityLabel}</div>
                  <div className="mt-1 text-[10px] leading-4 text-white/45">{sourceTypeLabel}</div>
                </div>
              )}
            </div>
          )}

          {currentSubmenu === 'subtitles' && (
            <div className="absolute bottom-full right-0 mb-3 bg-[#09090b]/95 backdrop-blur-2xl border border-white/10 rounded-[20px] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] animate-scale-in w-[240px] z-30 flex flex-col gap-0.5">
              <div className="flex items-center gap-2 px-1 py-1.5 border-b border-white/5 mb-1">
                <button type="button"
                  onClick={() => setCurrentSubmenu('main')}
                  className="w-6 h-6 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
                 aria-label="Previous">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">{t('player.subtitles')}</span>
              </div>
              <button type="button"
                onClick={() => {
                  onSubtitleChange(-1);
                  setShowSettingsMenu(false);
                }}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                  activeSubtitle === -1 ? 'bg-white text-black' : 'text-neutral-300 hover:bg-white/10'
                }`}
              >
                {language === 'tr' ? 'Altyazı Yok' : 'No Subtitles'}
              </button>
              {subtitleTracks.map((track, idx) => (
                <button type="button"
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
                <Plus size={12} /> {language === 'tr' ? 'Altyazı Yükle (Yerel)' : 'Load Subtitles (Local)'}
                <input type="file" accept=".srt,.vtt,.ass" className="hidden" onChange={onSubtitleUpload} />
              </label>
            </div>
          )}



          {currentSubmenu === 'scale' && (
            <div className="absolute bottom-full right-0 mb-3 bg-[#09090b]/95 backdrop-blur-2xl border border-white/10 rounded-[20px] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] animate-scale-in w-[240px] z-30 flex flex-col gap-0.5">
              <div className="flex items-center gap-2 px-1 py-1.5 border-b border-white/5 mb-1">
                <button type="button"
                  onClick={() => setCurrentSubmenu('main')}
                  className="w-6 h-6 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
                 aria-label="Previous">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">{language === 'tr' ? 'Video Ölçeği' : 'Aspect Ratio'}</span>
              </div>
              {[
                { mode: 'fit', label: language === 'tr' ? 'Orijinal Oran' : 'Original Ratio' },
                { mode: 'fill', label: language === 'tr' ? 'Ekrana Sığdır' : 'Fit to Screen' },
                { mode: 'zoom', label: language === 'tr' ? 'Yakınlaştır (Kırp)' : 'Zoom (Crop)' },
                { mode: '16:9', label: language === 'tr' ? '16:9 Oranı' : '16:9 Ratio' },
                { mode: '4:3', label: language === 'tr' ? '4:3 Oranı' : '4:3 Ratio' }
              ].map(opt => (
                <button type="button"
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
            <div className="absolute bottom-full right-0 mb-3 bg-[#09090b]/95 backdrop-blur-2xl border border-white/10 rounded-[20px] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] animate-scale-in w-[240px] z-30 flex flex-col gap-0.5">
              <div className="flex items-center gap-2 px-1 py-1.5 border-b border-white/5 mb-1">
                <button type="button"
                  onClick={() => setCurrentSubmenu('main')}
                  className="w-6 h-6 rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors"
                 aria-label="Previous">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">{t('player.audio')}</span>
              </div>
              {displayAudioTracks.map((track) => (
                <button type="button"
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
                  {track.name || (language === 'tr' ? `Parça ${track.id + 1}` : `Track ${track.id + 1}`)}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

