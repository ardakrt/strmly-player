import { useState } from 'react';
import { ArrowLeft, ArrowRight, Baby, Check, ChevronLeft, Clapperboard, Clock3, Eye, EyeOff, Film, Link2, LoaderCircle, Search, Server, Trophy, Tv, UserRound, X } from 'lucide-react';
import type { AvatarSearchResult, ContentPreference } from '../types';
import { useSettings } from '../context/SettingsContext';
import { getTmdbApiKey } from '../utils/tmdb';

interface LocalSeries {
  id: number;
  name: string;
  posterUrl: string;
}

interface SeriesCast {
  name: string;
  avatarUrl: string;
}

interface CreateProfileWizardProps {
  name: string;
  avatar: string;
  contentPreferences: ContentPreference[];
  playlistType: 'none' | 'm3u' | 'xtream';
  m3uUrl: string;
  xtreamUrl: string;
  xtreamUser: string;
  xtreamPass: string;
  updateInterval: 6 | 12 | 24 | 168;
  avatarSearchQuery: string;
  avatarSearchResults: AvatarSearchResult[];
  avatarSearchLoading: boolean;
  localSeries: LocalSeries[];
  selectedSeriesForCast: { id: number; name: string } | null;
  seriesCast: SeriesCast[];
  castLoading: boolean;
  isSaving: boolean;
  onNameChange: (value: string) => void;
  onAvatarChange: (value: string) => void;
  onContentPreferencesChange: (value: ContentPreference[]) => void;
  onPlaylistTypeChange: (value: 'none' | 'm3u' | 'xtream') => void;
  onM3uUrlChange: (value: string) => void;
  onXtreamUrlChange: (value: string) => void;
  onXtreamUserChange: (value: string) => void;
  onXtreamPassChange: (value: string) => void;
  onUpdateIntervalChange: (value: 6 | 12 | 24 | 168) => void;
  onAvatarSearchQueryChange: (value: string) => void;
  onAvatarSearchResultsChange: (value: AvatarSearchResult[]) => void;
  onSelectedSeriesForCastChange: (value: { id: number; name: string } | null) => void;
  onSeriesCastChange: (value: SeriesCast[]) => void;
  onAvatarSearch: (query: string) => void;
  onFetchSeriesCast: (id: number, name: string, mediaType: 'movie' | 'tv') => void;
  onClose: () => void;
  onSave: () => void;
}

const contentPreferenceOptions = [
  { id: 'series', label: 'Dizi', icon: Clapperboard },
  { id: 'movies', label: 'Film', icon: Film },
  { id: 'sports', label: 'Spor', icon: Trophy },
  { id: 'live', label: 'Canlı TV', icon: Tv },
  { id: 'kids', label: 'Çocuk', icon: Baby }
] as const;

const renderAvatarHelper = (value: string, className: string) => {
  if (!value || value.startsWith('linear-gradient')) {
    return (
      <div className={`${className} flex items-center justify-center bg-neutral-800 text-neutral-400`}>
        <UserRound size={48} className="text-neutral-300" />
      </div>
    );
  }

  return <img src={value} className={`${className} object-cover`} alt="" />;
};

export function CreateProfileWizard({
  name,
  avatar,
  contentPreferences,
  playlistType,
  m3uUrl,
  xtreamUrl,
  xtreamUser,
  xtreamPass,
  updateInterval,
  avatarSearchQuery,
  avatarSearchResults,
  avatarSearchLoading,
  localSeries,
  selectedSeriesForCast,
  seriesCast,
  castLoading,
  isSaving,
  onNameChange,
  onAvatarChange,
  onContentPreferencesChange,
  onPlaylistTypeChange,
  onM3uUrlChange,
  onXtreamUrlChange,
  onXtreamUserChange,
  onXtreamPassChange,
  onUpdateIntervalChange,
  onAvatarSearchQueryChange,
  onAvatarSearchResultsChange,
  onSelectedSeriesForCastChange,
  onSeriesCastChange,
  onAvatarSearch,
  onFetchSeriesCast,
  onClose,
  onSave
}: CreateProfileWizardProps) {
  const { t, language } = useSettings();
  const hasTmdbApiKey = Boolean(getTmdbApiKey());
  const [step, setStep] = useState(1);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const identityReady = name.trim().length > 0;
  const connectionReady = playlistType === 'none'
    || (playlistType === 'm3u' && m3uUrl.trim().length > 0)
    || (playlistType === 'xtream' && xtreamUrl.trim().length > 0 && xtreamUser.trim().length > 0 && xtreamPass.trim().length > 0);
  const canContinue = step === 1 ? identityReady : step === 2 ? connectionReady : true;

  const seriesCatalog = avatarSearchResults.length > 0 ? avatarSearchResults : localSeries.map(series => ({
    id: series.id,
    name: series.name,
    posterUrl: series.posterUrl,
    mediaType: 'tv' as const
  }));

  const closeAvatarPicker = () => {
    setAvatarPickerOpen(false);
    onAvatarSearchQueryChange('');
    onAvatarSearchResultsChange([]);
    onSelectedSeriesForCastChange(null);
    onSeriesCastChange([]);
  };

  const chooseActor = (avatarUrl: string) => {
    onAvatarChange(avatarUrl);
    closeAvatarPicker();
  };

  const toggleContentPreference = (preference: ContentPreference) => {
    onContentPreferencesChange(
      contentPreferences.includes(preference)
        ? contentPreferences.filter(item => item !== preference)
        : [...contentPreferences, preference]
    );
  };

  return (
    <div className="fixed inset-0 z-[4500] bg-[#050506] flex flex-col justify-between p-6 md:p-12 animate-fade-in select-none overflow-hidden">
      {/* Background Ambient Lighting (Smooth non-pixelated dynamic glow) */}
      {avatar && !avatar.startsWith('linear-gradient') ? (
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
          <img
            src={avatar}
            alt=""
            className="w-[900px] h-[900px] object-cover blur-[140px] opacity-40 saturate-[1.6] transform-gpu scale-125 transition-all duration-700"
          />
          <div className="absolute inset-0 bg-[#050506]/40 backdrop-blur-[20px]" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.06)_0%,rgba(0,0,0,0)_65%)] pointer-events-none" />
      )}

      {/* TOP BAR */}
      <header className="relative z-10 w-full max-w-6xl mx-auto flex items-center justify-between gap-4">
        {/* Left Spacer (No logo tag) */}
        <div className="w-10" />

        {/* Step Indicator Dots (PERFECTLY CENTERED) */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex items-center gap-2.5">
          {[1, 2, 3].map(num => (
            <div
              key={num}
              className={`transition-all duration-300 rounded-full ${
                step === num
                  ? 'w-7 h-2 bg-white'
                  : step > num
                  ? 'w-2 h-2 bg-white/50'
                  : 'w-2 h-2 bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          aria-label={t('common.close') || (language === 'tr' ? 'Kapat' : 'Close')}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/10"
        >
          <X size={20} />
        </button>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="relative z-10 w-full max-w-4xl mx-auto flex-1 flex flex-col justify-center items-center py-6 overflow-y-auto custom-scrollbar">
        {/* STEP 1: IDENTITY & AVATAR */}
        {step === 1 && !avatarPickerOpen && (
          <div className="w-full flex flex-col items-center text-center gap-8 animate-fade-in max-w-xl mx-auto">
            {/* Avatar Circle */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => setAvatarPickerOpen(true)}
                aria-label={language === 'tr' ? 'Resmi de?i?tir' : 'Change avatar'}
                className="w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden border-4 border-white/20 hover:border-white shadow-[0_20px_60px_rgba(0,0,0,0.8)] transition-all duration-300 hover:scale-105 cursor-pointer block relative group"
              >
                {renderAvatarHelper(avatar, 'w-full h-full')}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 text-white">
                  <Search size={22} />
                  <span className="text-[11px] font-bold tracking-wider uppercase">
                    {language === 'tr' ? 'Resmi Değiştir' : 'Change Avatar'}
                  </span>
                </div>
              </button>
            </div>

            {/* Profile Name Underline Input */}
            <div className="w-full flex flex-col items-center gap-2">
              <label className="text-xs font-extrabold uppercase tracking-[0.2em] text-neutral-400">
                {t('profiles.profileName')}
              </label>
              <input
                autoFocus
                maxLength={15}
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder={language === 'tr' ? 'Profil Adınız' : 'Profile Name'}
                className="w-full max-w-md text-2xl md:text-3xl font-black text-center text-white placeholder-neutral-600 bg-transparent border-b-2 border-white/15 focus:border-white outline-none py-2 transition-all"
              />
            </div>

            {/* Content Preferences */}
            <div className="w-full flex flex-col items-center gap-3 pt-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                {language === 'tr' ? 'İçerik Tercihleri' : 'Content Preferences'}
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {contentPreferenceOptions.map(option => {
                  const selected = contentPreferences.includes(option.id);
                  const optionLabel = option.id === 'series' ? t('navbar.series') :
                                      option.id === 'movies' ? t('navbar.movies') :
                                      option.id === 'live' ? t('navbar.liveTv') :
                                      option.id === 'sports' ? (language === 'tr' ? 'Spor' : 'Sports') :
                                      (language === 'tr' ? 'Çocuk' : 'Kids');
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleContentPreference(option.id)}
                      aria-label={optionLabel}
                      className={`px-5 py-2.5 rounded-full border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        selected
                          ? 'border-white bg-white text-black shadow-lg scale-105'
                          : 'border-white/10 bg-white/[0.04] text-neutral-400 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      <option.icon size={15} />
                      <span>{optionLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 1 - AVATAR STUDIO MODAL */}
        {step === 1 && avatarPickerOpen && (
          <div className="w-full max-w-3xl flex flex-col gap-6 animate-fade-in py-2">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <button
                type="button"
                onClick={() => {
                  if (selectedSeriesForCast) {
                    onSelectedSeriesForCastChange(null);
                    onSeriesCastChange([]);
                  } else {
                    closeAvatarPicker();
                  }
                }}
                className="h-10 px-4 rounded-full border border-white/15 bg-white/5 hover:bg-white/15 text-xs font-bold text-white flex items-center gap-2 transition-all cursor-pointer"
              >
                <ChevronLeft size={16} /> {selectedSeriesForCast ? (language === 'tr' ? 'Kataloğa Dön' : 'Back to Catalog') : (language === 'tr' ? 'Profile Dön' : 'Back')}
              </button>
              <h3 className="text-base font-bold text-white">
                {selectedSeriesForCast ? selectedSeriesForCast.name : (language === 'tr' ? 'Film veya Dizi Karakteri Seçin' : 'Select Movie or Series Character')}
              </h3>
            </div>

            {!selectedSeriesForCast && (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    autoFocus
                    value={avatarSearchQuery}
                    onChange={(event) => {
                      onAvatarSearchQueryChange(event.target.value);
                      if (!event.target.value.trim()) onAvatarSearchResultsChange([]);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && hasTmdbApiKey && avatarSearchQuery.trim()) onAvatarSearch(avatarSearchQuery);
                    }}
                    placeholder={language === 'tr' ? 'Film veya dizi ara...' : 'Search movie or series...'}
                    disabled={!hasTmdbApiKey}
                    className="w-full h-12 pl-11 pr-4 rounded-full border border-white/15 bg-white/5 text-xs text-white outline-none placeholder-neutral-500 focus:border-white transition-all"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => hasTmdbApiKey && avatarSearchQuery.trim() && onAvatarSearch(avatarSearchQuery)}
                  disabled={!hasTmdbApiKey || !avatarSearchQuery.trim() || avatarSearchLoading}
                  className="h-12 px-6 rounded-full bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 text-black text-xs font-extrabold transition-all cursor-pointer"
                >
                  {language === 'tr' ? 'Ara' : 'Search'}
                </button>
              </div>
            )}

            {(avatarSearchLoading || castLoading) ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3">
                <LoaderCircle size={32} className="animate-spin text-white" />
                <span className="text-xs text-neutral-400">{castLoading ? (language === 'tr' ? 'Oyuncular yükleniyor...' : 'Loading actors...') : (language === 'tr' ? 'Arama yapılıyor...' : 'Searching...')}</span>
              </div>
            ) : selectedSeriesForCast ? (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                {seriesCast.map((actor, index) => (
                  <button
                    type="button"
                    key={`${actor.name}-${index}`}
                    onClick={() => chooseActor(actor.avatarUrl)}
                    className="group flex flex-col items-center gap-2 cursor-pointer"
                  >
                    <div className={`w-full aspect-square rounded-full overflow-hidden border-2 transition-all group-hover:scale-105 ${avatar === actor.avatarUrl ? 'border-white shadow-lg' : 'border-white/10 group-hover:border-white/40'}`}>
                      <img src={actor.avatarUrl} className="w-full h-full object-cover" alt={actor.name} />
                    </div>
                    <span className="text-[10px] font-medium text-neutral-400 group-hover:text-white truncate w-full text-center">{actor.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-4 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                {seriesCatalog.map(series => (
                  <button
                    type="button"
                    key={series.id}
                    onClick={() => onFetchSeriesCast(series.id, series.name, series.mediaType)}
                    className="group flex flex-col gap-2 text-left cursor-pointer"
                  >
                    <div className="w-full aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 group-hover:border-white/40 transition-all group-hover:scale-105 shadow-lg">
                      <img src={series.posterUrl} className="w-full h-full object-cover" alt={series.name} />
                    </div>
                    <span className="text-xs font-bold text-neutral-300 group-hover:text-white truncate">{series.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: IPTV CONNECTION */}
        {step === 2 && (
          <div className="w-full max-w-2xl flex flex-col gap-6 animate-fade-in py-4">
            <div className="text-center flex flex-col gap-1">
              <h2 className="text-2xl font-black text-white">{language === 'tr' ? 'Yayın Listenizi Bağlayın' : 'Connect Your Playlist'}</h2>
              <p className="text-xs text-neutral-400">{t('profiles.setupWizard.connectionIntro')}</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { id: 'none', label: language === 'tr' ? 'Sonra Ekle' : 'Add Later', icon: Clock3 },
                { id: 'm3u', label: language === 'tr' ? 'M3U / M3U8 URL' : 'M3U URL', icon: Link2 },
                { id: 'xtream', label: 'Xtream Codes', icon: Server }
              ].map(option => (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => onPlaylistTypeChange(option.id as 'none' | 'm3u' | 'xtream')}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col items-center text-center gap-3 ${
                    playlistType === option.id
                      ? 'border-white bg-white text-black shadow-xl font-extrabold scale-105'
                      : 'border-white/10 bg-white/[0.04] text-neutral-300 hover:border-white/30 hover:bg-white/[0.08]'
                  }`}
                >
                  <option.icon size={22} className={playlistType === option.id ? 'text-black' : 'text-neutral-400'} />
                  <span className="text-xs font-black">{option.label}</span>
                </button>
              ))}
            </div>

            {playlistType === 'none' && (
              <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.03] text-center flex flex-col items-center gap-2">
                <Clock3 size={28} className="text-neutral-500" />
                <p className="text-sm font-bold text-white">{language === 'tr' ? 'Listenizi Daha Sonra Ekleyebilirsiniz' : 'You Can Add Playlist Later'}</p>
                <p className="text-xs text-neutral-400">
                  {t('profiles.setupWizard.addLaterDescription')}
                </p>
              </div>
            )}

            {playlistType === 'm3u' && (
              <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.03] flex flex-col gap-3 animate-fade-in">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  {language === 'tr' ? 'M3U veya M3U8 Web Bağlantı Adresi' : 'M3U / M3U8 Web URL'}
                </label>
                <input
                  value={m3uUrl}
                  onChange={(event) => onM3uUrlChange(event.target.value)}
                  placeholder={language === 'tr' ? 'https://sunucu.com/listeniz.m3u' : 'https://server.com/playlist.m3u'}
                  className="w-full h-12 px-4 rounded-xl border border-white/15 bg-white/5 text-xs text-white outline-none placeholder-neutral-500 focus:border-white transition-all"
                />
              </div>
            )}

            {playlistType === 'xtream' && (
              <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.03] flex flex-col gap-4 animate-fade-in">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    {language === 'tr' ? 'Sunucu Adresi' : 'Server Address'}
                  </label>
                  <input
                    value={xtreamUrl}
                    onChange={(event) => onXtreamUrlChange(event.target.value)}
                    placeholder={language === 'tr' ? 'http://ip-adresi:port' : 'http://ip-address:port'}
                    className="w-full h-12 px-4 rounded-xl border border-white/15 bg-white/5 text-xs text-white outline-none placeholder-neutral-500 focus:border-white transition-all"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      {language === 'tr' ? 'Kullanıcı Adı' : 'Username'}
                    </label>
                    <input
                      value={xtreamUser}
                      onChange={(event) => onXtreamUserChange(event.target.value)}
                      placeholder={language === 'tr' ? 'Kullanıcı Adınız' : 'Username'}
                      className="w-full h-12 px-4 rounded-xl border border-white/15 bg-white/5 text-xs text-white outline-none placeholder-neutral-500 focus:border-white transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      {language === 'tr' ? 'Şifre' : 'Password'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={xtreamPass}
                        onChange={(event) => onXtreamPassChange(event.target.value)}
                        placeholder={language === 'tr' ? 'Şifreniz' : 'Password'}
                        className="w-full h-12 pl-4 pr-11 rounded-xl border border-white/15 bg-white/5 text-xs text-white outline-none placeholder-neutral-500 focus:border-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        title={showPassword ? (language === 'tr' ? 'Şifreyi gizle' : 'Hide password') : (language === 'tr' ? 'Şifreyi göster' : 'Show password')}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                {t('settings.playlists.updateInterval')}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 6, label: language === 'tr' ? '6 Saat' : '6 Hours' },
                  { value: 12, label: language === 'tr' ? '12 Saat' : '12 Hours' },
                  { value: 24, label: language === 'tr' ? '1 Gün' : '1 Day' },
                  { value: 168, label: language === 'tr' ? '7 Gün' : '7 Days' }
                ].map(option => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => onUpdateIntervalChange(option.value as 6 | 12 | 24 | 168)}
                    className={`h-11 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      updateInterval === option.value
                        ? 'border-white bg-white text-black shadow-md'
                        : 'border-white/10 bg-white/[0.04] text-neutral-400 hover:text-white hover:border-white/30'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: REVIEW & FINISH */}
        {step === 3 && (
          <div className="w-full max-w-md flex flex-col items-center text-center gap-6 animate-fade-in py-4">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/30 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
              {renderAvatarHelper(avatar, 'w-full h-full')}
            </div>

            <div>
              <h2 className="text-3xl font-black text-white tracking-tight">{name.trim()}</h2>
              <p className="text-xs text-neutral-400 mt-1">
                {language === 'tr' ? 'Profiliniz yayın izlemeye hazır!' : 'Your profile is ready for streaming!'}
              </p>
            </div>

            <div className="w-full p-4 rounded-2xl border border-white/10 bg-white/[0.04] text-left flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">{language === 'tr' ? 'IPTV Durumu:' : 'IPTV Status:'}</span>
                <span className="font-bold text-white">
                  {playlistType === 'none' ? (language === 'tr' ? 'Daha Sonra Ekli' : 'Add Later') : playlistType === 'm3u' ? 'M3U Linki' : 'Xtream Codes'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-white/5 pt-2">
                <span className="text-neutral-400">{language === 'tr' ? 'Otomatik Güncelleme:' : 'Auto Refresh:'}</span>
                <span className="font-bold text-white">
                  {updateInterval === 168 ? (language === 'tr' ? '7 Günde Bir' : 'Every 7 Days') : updateInterval === 24 ? (language === 'tr' ? 'Her Gün' : 'Every Day') : `${updateInterval} Saatte Bir`}
                </span>
              </div>
            </div>

            <div className="w-full p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3 text-left">
              <Check size={18} className="shrink-0 text-emerald-400" />
              <span>
                {t('profiles.setupWizard.profileDataDescription')}
              </span>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM NAVIGATION BAR */}
      {!avatarPickerOpen && (
        <footer className="relative z-10 w-full max-w-6xl mx-auto flex items-center justify-between gap-4 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => step === 1 ? onClose() : setStep(current => current - 1)}
            disabled={isSaving}
            className="h-12 px-7 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all flex items-center gap-2 cursor-pointer border border-white/10 disabled:opacity-40"
          >
            <ArrowLeft size={16} /> {step === 1 ? t('common.cancel') : t('common.back')}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => canContinue && setStep(current => current + 1)}
              disabled={!canContinue}
              className="h-12 px-9 rounded-full bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 font-black text-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              {language === 'tr' ? 'Devam Et' : 'Continue'} <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="h-12 px-10 rounded-full bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-400 font-black text-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              {isSaving ? <LoaderCircle size={18} className="animate-spin" /> : <Check size={18} strokeWidth={3} />}
              {isSaving ? (language === 'tr' ? 'Hazırlanıyor...' : 'Preparing...') : t('profiles.setupWizard.createProfile')}
            </button>
          )}
        </footer>
      )}
    </div>
  );
}
