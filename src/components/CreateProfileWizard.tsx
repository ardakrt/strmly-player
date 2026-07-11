import { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Baby, Check, ChevronLeft, Clapperboard, Clock3, Film, Link2, LoaderCircle, Plus, Search, Server, Sparkles, Trophy, Tv, UserRound, X } from 'lucide-react';
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
  const contentPreferencesSet = useMemo(() => new Set(contentPreferences), [contentPreferences]);
  const [step, setStep] = useState(1);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  const identityReady = name.trim().length > 0;
  const connectionReady = playlistType === 'none'
    || (playlistType === 'm3u' && m3uUrl.trim().length > 0)
    || (playlistType === 'xtream' && xtreamUrl.trim().length > 0 && xtreamUser.trim().length > 0 && xtreamPass.trim().length > 0);
  const canContinue = step === 1 ? identityReady : step === 2 ? connectionReady : true;

  const renderAvatar = (value: string, className: string) => {
    if (!value) {
      return (
        <div className={`${className} flex items-center justify-center bg-neutral-950`}>
          <UserRound size={42} className="text-neutral-600" />
        </div>
      );
    }

    return value.startsWith('linear-gradient') ? (
      <div className={className} style={{ background: value }} />
    ) : (
      <img src={value} className={`${className} object-cover`} alt="" />
    );
  };

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
    <div className="fixed inset-0 z-[4500] flex items-center justify-center p-4 md:p-7 page-transition-enter select-none">
      <div className="absolute inset-0 bg-black/88 backdrop-blur-2xl" onClick={isSaving ? undefined : onClose} />

      <div className="relative w-full max-w-[1320px] h-[min(720px,94vh)] overflow-hidden rounded-[36px] border border-white/12 bg-[#08080a]/98 shadow-[0_40px_150px_rgba(0,0,0,0.85)] flex">
        <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent pointer-events-none" />

        <aside className="relative hidden md:flex w-[260px] shrink-0 flex-col justify-between border-r border-white/8 bg-white/[0.025] p-7 overflow-hidden">
          <div className="absolute -top-24 -left-20 w-64 h-64 rounded-full bg-[var(--accent-color)] opacity-[0.06] blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white text-black flex items-center justify-center shadow-lg">
                <Plus size={18} strokeWidth={2.7} />
              </div>
              <div>
                <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">STRMLY</span>
                <span className="block mt-0.5 text-sm font-black text-white">{language === 'tr' ? 'Yeni Profil' : 'New Profile'}</span>
              </div>
            </div>

            <div className="mt-12 flex flex-col">
              {[
                { number: 1, label: language === 'tr' ? 'Profil' : 'Profile', description: language === 'tr' ? 'İsim ve görünüm' : 'Name and avatar' },
                { number: 2, label: language === 'tr' ? 'IPTV' : 'IPTV Link', description: language === 'tr' ? 'Liste bağlantısı' : 'Playlist connection' },
                { number: 3, label: language === 'tr' ? 'Özet' : 'Summary', description: language === 'tr' ? 'Kontrol ve başlat' : 'Review & finish' }
              ].map((item, index, arr) => {
                const completed = step > item.number;
                const active = step === item.number;
                return (
                  <div key={item.number} className="relative flex gap-4 pb-9 last:pb-0">
                    {index < arr.length - 1 && (
                      <div className={`absolute left-[15px] top-8 w-px h-[calc(100%-22px)] transition-colors ${completed ? 'bg-[var(--accent-color)]' : 'bg-white/10'}`} />
                    )}
                    <div className={`relative z-10 w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                      completed
                        ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-black'
                        : active
                          ? 'border-white/45 bg-white/10 text-white shadow-[0_0_24px_rgba(255,255,255,0.12)]'
                          : 'border-white/10 bg-black/20 text-neutral-600'
                    }`}>
                      {completed ? <Check size={13} strokeWidth={3} /> : <span className="text-[10px] font-black">{item.number}</span>}
                    </div>
                    <div className="pt-0.5">
                      <span className={`block text-xs font-black ${active || completed ? 'text-white' : 'text-neutral-500'}`}>{item.label}</span>
                      <span className="block mt-1 text-[10px] text-neutral-600">{item.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative rounded-2xl border border-white/8 bg-black/25 p-4">
            <Sparkles size={15} className="text-[var(--accent-color)]" />
            <p className="mt-3 text-[10px] leading-relaxed text-neutral-500">
              {language === 'tr' ? 'Her profil kendi kanal listesini, favorilerini ve izleme geçmişini ayrı tutar.' : 'Each profile keeps its own channel list, favorites, and watch history separate.'}
            </p>
          </div>
        </aside>

        <main className="relative flex-1 min-w-0 flex flex-col">
          <header className="h-20 shrink-0 px-6 md:px-9 border-b border-white/8 flex items-center justify-between">
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-600">{language === 'tr' ? 'Adım' : 'Step'} {step} / 3</span>
              <h2 className="mt-1 text-lg md:text-xl font-black text-white tracking-tight">
                {step === 1 ? (avatarPickerOpen ? (language === 'tr' ? 'Dizini ve oyuncunu seç' : 'Select series and actor') : t('profiles.setupWizard.step1Desc')) : step === 2 ? (language === 'tr' ? 'IPTV bağlantını kur' : 'Setup IPTV link') : (language === 'tr' ? 'Her şey hazır' : 'All set')}
              </h2>
            </div>
            <button type="button"
              onClick={onClose}
              disabled={isSaving}
              className="w-10 h-10 rounded-full border border-white/8 bg-white/[0.035] hover:bg-white/10 disabled:opacity-40 flex items-center justify-center text-neutral-400 hover:text-white transition-all"
             aria-label="Close">
              <X size={15} />
            </button>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-6 md:px-9 py-7">
            {step === 1 && (avatarPickerOpen ? (
              <div className="animate-fade-in">
                <div className="flex items-center justify-between gap-5">
                  <button type="button"
                    onClick={() => {
                      if (selectedSeriesForCast) {
                        onSelectedSeriesForCastChange(null);
                        onSeriesCastChange([]);
                      } else {
                        closeAvatarPicker();
                      }
                    }}
                    className="h-10 px-4 rounded-xl border border-white/10 bg-white/[0.035] hover:bg-white/10 text-[10px] font-bold text-neutral-300 flex items-center gap-2 transition-all"
                  >
                    <ChevronLeft size={14} /> {selectedSeriesForCast ? (language === 'tr' ? 'Dizilere dön' : 'Back to Series') : (language === 'tr' ? 'Profile dön' : 'Back to Profile')}
                  </button>
                  <div className="min-w-0 text-right">
                    <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-neutral-600">{language === 'tr' ? 'Avatar stüdyosu' : 'Avatar studio'}</span>
                    <span className="block mt-1 truncate text-sm font-black text-white">{selectedSeriesForCast?.name || (language === 'tr' ? 'Dizini seç' : 'Select series')}</span>
                  </div>
                </div>

                {!selectedSeriesForCast && (
                  <div className="mt-5 flex gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" />
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
                        placeholder={language === 'tr' ? 'Dizi ara...' : 'Search series...'}
                        disabled={!hasTmdbApiKey}
                        className="w-full h-12 pl-11 pr-4 rounded-2xl border border-white/10 bg-white/[0.035] text-xs text-white outline-none placeholder-neutral-600 focus:border-white/30 transition-all"
                      />
                    </div>
                    <button type="button" onClick={() => hasTmdbApiKey && avatarSearchQuery.trim() && onAvatarSearch(avatarSearchQuery)} disabled={!hasTmdbApiKey || !avatarSearchQuery.trim() || avatarSearchLoading} className="h-12 px-6 rounded-2xl bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 text-black text-[10px] font-black transition-all">
                      {language === 'tr' ? 'Ara' : 'Search'}
                    </button>
                  </div>
                )}

                {(avatarSearchLoading || castLoading) ? (
                  <div className="mt-5 h-[420px] rounded-3xl border border-white/8 bg-black/20 flex flex-col items-center justify-center gap-3">
                    <LoaderCircle size={26} className="animate-spin text-white" />
                    <span className="text-[10px] font-bold text-neutral-500">{castLoading ? (language === 'tr' ? 'Oyuncular hazırlanıyor...' : 'Preparing actors...') : (language === 'tr' ? 'Diziler aranıyor...' : 'Searching series...')}</span>
                  </div>
                ) : selectedSeriesForCast ? (
                  <div className="mt-6">
                    <div className="flex items-end justify-between gap-4 mb-5">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'Oyuncunu seç' : 'Select actor'}</span>
                        <p className="mt-1 text-[10px] text-neutral-600">{language === 'tr' ? 'Seçtiğin oyuncu profil fotoğrafın olacak.' : 'The actor you choose will be your profile picture.'}</p>
                      </div>
                      <span className="text-[9px] font-semibold text-neutral-600">{seriesCast.length} {language === 'tr' ? 'oyuncu' : 'actors'}</span>
                    </div>
                    {seriesCast.length > 0 ? (
                      <div className="grid grid-cols-5 sm:grid-cols-7 lg:grid-cols-9 gap-x-5 gap-y-6 max-h-[390px] overflow-y-auto hide-scrollbar pr-1">
                        {seriesCast.map((actor, index) => (
                          <button type="button" key={`${actor.name}-${index}`} onClick={() => chooseActor(actor.avatarUrl)} className="group min-w-0 flex flex-col items-center gap-2.5">
                            <div className={`w-full aspect-square rounded-full overflow-hidden border-2 transition-all group-hover:scale-105 ${avatar === actor.avatarUrl ? 'border-white shadow-[0_0_26px_rgba(255,255,255,0.22)]' : 'border-white/10 group-hover:border-white/45'}`}>
                              <img src={actor.avatarUrl} className="w-full h-full object-cover" alt={actor.name} />
                            </div>
                            <span className="w-full truncate text-center text-[9px] font-bold text-neutral-500 group-hover:text-white">{actor.name}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="h-[340px] rounded-3xl border border-dashed border-white/10 flex items-center justify-center text-xs text-neutral-600">{language === 'tr' ? 'Bu dizi için oyuncu görseli bulunamadı.' : 'No actor images found for this series.'}</div>
                    )}
                  </div>
                ) : (
                  <div className="mt-6">
                    <div className="flex items-end justify-between gap-4 mb-4">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{avatarSearchResults.length ? (language === 'tr' ? 'Arama sonuçları' : 'Search results') : (language === 'tr' ? 'Popüler diziler' : 'Popular series')}</span>
                        <p className="mt-1 text-[10px] text-neutral-600">
                          {!hasTmdbApiKey
                            ? (language === 'tr' ? 'Bu surumde TMDB anahtari bulunamadi. Guncel paketi kurunca oyuncu gorselleri otomatik gelir.' : 'This build does not include a TMDB key. Actor images load automatically in a correctly bundled release.')
                            : (language === 'tr' ? 'Oyuncu kadrosunu acmak icin bir dizi sec.' : 'Select a series to open cast avatars.')}
                        </p>
                      </div>
                      <span className="text-[9px] font-semibold text-neutral-600">{seriesCatalog.length} {language === 'tr' ? 'dizi' : 'series'}</span>
                    </div>
                    {!hasTmdbApiKey ? (
                      <div className="h-[260px] rounded-3xl border border-dashed border-white/10 bg-black/20 flex items-center justify-center px-8 text-center text-xs leading-6 text-neutral-500">
                        {language === 'tr'
                          ? 'TMDB API anahtari bu pakete gomulmemis. Release build GitHub Secret ile yeniden alindiginda populer diziler ve oyuncu profil fotograflari otomatik yuklenir.'
                          : 'This package was built without a TMDB API key. Rebuilding the release with the GitHub Secret will load popular series and actor profile photos automatically.'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-4 max-h-[390px] overflow-y-auto hide-scrollbar pr-1 pb-1">
                        {seriesCatalog.map(item => (
                          <button type="button" key={`${item.mediaType}-${item.id}`} onClick={() => onFetchSeriesCast(item.id, item.name, item.mediaType)} title={item.name} className="group relative aspect-[2/3] rounded-2xl overflow-hidden border-2 border-transparent hover:border-white/45 transition-all hover:-translate-y-1 bg-neutral-900" aria-label={item.name}>
                            <img src={item.posterUrl} className="w-full h-full object-cover" alt={item.name} />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-transparent" />
                            <span className="absolute inset-x-2 bottom-2 truncate text-[9px] font-black text-white">{item.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid lg:grid-cols-[240px_1fr] gap-10 items-center min-h-[400px] animate-fade-in">
                <div className="flex flex-col items-center">
                  <button type="button" onClick={() => setAvatarPickerOpen(true)} className="group relative w-48 h-48 rounded-[38px] overflow-hidden border-2 border-white/15 hover:border-white/50 bg-neutral-950 shadow-[0_28px_80px_rgba(0,0,0,0.55)] transition-all hover:-translate-y-1" title={language === 'tr' ? 'Profil resmi seç' : 'Select profile avatar'} aria-label={language === 'tr' ? 'Profil resmi seç' : 'Select profile avatar'}>
                    {avatar ? renderAvatar(avatar, 'w-full h-full') : <div className="w-full h-full flex items-center justify-center"><UserRound size={46} className="text-neutral-600" /></div>}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-14 flex items-center justify-center gap-2 text-[10px] font-black text-white opacity-80 group-hover:opacity-100">
                      <Search size={14} /> {avatar ? (language === 'tr' ? 'Resmi değiştir' : 'Change avatar') : (language === 'tr' ? 'İsteğe bağlı' : 'Optional')}
                    </div>
                  </button>
                  <span className="mt-5 max-w-full truncate text-lg font-black text-white">{name.trim() || t('profiles.profileName')}</span>
                  <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-neutral-600">{language === 'tr' ? 'Canlı önizleme' : 'Live preview'}</span>
                </div>

                <div className="min-w-0">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t('profiles.profileName')}</label>
                  <input autoFocus maxLength={15} value={name} onChange={(event) => onNameChange(event.target.value)} placeholder={language === 'tr' ? 'Sana nasıl hitap edelim?' : 'How should we call you?'} className="mt-2 w-full h-14 px-5 rounded-2xl border border-white/10 bg-white/[0.035] text-sm font-semibold text-white outline-none placeholder-neutral-600 focus:border-white/30 focus:bg-white/[0.055] transition-all" />

                  <div className="mt-7 flex items-end justify-between gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'İçerik tercihin' : 'Content Preferences'}</label>
                      <p className="mt-1 text-[10px] text-neutral-600">{language === 'tr' ? 'Birden fazla seçebilirsin. Ana sayfan buna göre sıralanır.' : 'You can select multiple. Your home page will be ordered accordingly.'}</p>
                    </div>
                    <span className="shrink-0 text-[9px] font-bold text-neutral-600">{contentPreferences.length ? `${contentPreferences.length} ${language === 'tr' ? 'seçili' : 'selected'}` : (language === 'tr' ? 'Dengeli' : 'Balanced')}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 xl:grid-cols-5 gap-2">
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
                          aria-pressed={selected}
                          onClick={() => toggleContentPreference(option.id)}
                          className={`h-16 rounded-2xl border px-3 flex flex-col items-start justify-center gap-2 transition-all ${selected ? 'border-white bg-white text-black shadow-[0_12px_30px_rgba(255,255,255,0.10)]' : 'border-white/8 bg-white/[0.025] text-neutral-500 hover:border-white/25 hover:bg-white/[0.055] hover:text-white'}`}
                        >
                          <option.icon size={15} />
                          <span className="text-[10px] font-black">{optionLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-[10px] leading-relaxed text-neutral-600">{language === 'tr' ? 'Profil resmi isteğe bağlı. Seçmezsen otomatik bir renkli avatar atanır.' : 'Profile avatar is optional. A colorful avatar is assigned automatically if you skip it.'}</p>
                </div>
              </div>
            ))}

            {step === 2 && (
              <div className="animate-fade-in">
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { id: 'none', label: language === 'tr' ? 'Sonra Ekle' : 'Add Later', detail: language === 'tr' ? 'Profili şimdi oluştur' : 'Create profile now', icon: Clock3 },
                    { id: 'm3u', label: language === 'tr' ? 'M3U Linki' : 'M3U Link', detail: language === 'tr' ? 'Tek bağlantıyla kur' : 'Setup with single link', icon: Link2 },
                    { id: 'xtream', label: 'Xtream Codes', detail: language === 'tr' ? 'Hesabınla bağlan' : 'Connect with credentials', icon: Server }
                  ].map(option => (
                    <button type="button"
                      key={option.id}
                      onClick={() => onPlaylistTypeChange(option.id as 'none' | 'm3u' | 'xtream')}
                      className={`min-h-28 rounded-2xl border p-4 text-left transition-all ${playlistType === option.id ? 'border-white/45 bg-white text-black shadow-[0_18px_50px_rgba(255,255,255,0.10)]' : 'border-white/8 bg-white/[0.025] text-neutral-400 hover:border-white/20 hover:bg-white/[0.05] hover:text-white'}`}
                    >
                      <option.icon size={18} />
                      <span className="block mt-4 text-xs font-black">{option.label}</span>
                      <span className={`block mt-1 text-[9px] font-semibold ${playlistType === option.id ? 'text-black/55' : 'text-neutral-600'}`}>{option.detail}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-6 rounded-3xl border border-white/8 bg-black/25 p-5">
                  {playlistType === 'none' && (
                    <div className="min-h-32 flex flex-col items-center justify-center text-center">
                      <Clock3 size={24} className="text-neutral-600" />
                      <p className="mt-3 text-xs font-bold text-neutral-300">{language === 'tr' ? 'Listeyi daha sonra ekleyebilirsin' : 'You can add playlist later'}</p>
                      <p className="mt-1 text-[10px] text-neutral-600">{language === 'tr' ? 'Ayarlar → Playlistler bölümünden kurulumu tamamlayabilirsin.' : 'You can complete setup in Settings → Playlists later.'}</p>
                    </div>
                  )}
                  {playlistType === 'm3u' && (
                    <div className="animate-fade-in">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'M3U bağlantısı' : 'M3U link'}</label>
                      <input value={m3uUrl} onChange={(event) => onM3uUrlChange(event.target.value)} placeholder={language === 'tr' ? 'https://sunucu.com/listeniz.m3u' : 'https://server.com/playlist.m3u'} className="mt-3 w-full h-12 px-4 rounded-2xl border border-white/10 bg-white/[0.035] text-xs text-white outline-none placeholder-neutral-600 focus:border-white/30 transition-all" />
                    </div>
                  )}
                  {playlistType === 'xtream' && (
                    <div className="grid gap-3 animate-fade-in">
                      <input value={xtreamUrl} onChange={(event) => onXtreamUrlChange(event.target.value)} placeholder={language === 'tr' ? 'Sunucu adresi' : 'Server address'} className="w-full h-12 px-4 rounded-2xl border border-white/10 bg-white/[0.035] text-xs text-white outline-none placeholder-neutral-600 focus:border-white/30 transition-all" />
                      <div className="grid sm:grid-cols-2 gap-3">
                        <input value={xtreamUser} onChange={(event) => onXtreamUserChange(event.target.value)} placeholder={language === 'tr' ? 'Kullanıcı adı' : 'Username'} className="w-full h-12 px-4 rounded-2xl border border-white/10 bg-white/[0.035] text-xs text-white outline-none placeholder-neutral-600 focus:border-white/30 transition-all" />
                        <input type="password" value={xtreamPass} onChange={(event) => onXtreamPassChange(event.target.value)} placeholder={language === 'tr' ? 'Şifre' : 'Password'} className="w-full h-12 px-4 rounded-2xl border border-white/10 bg-white/[0.035] text-xs text-white outline-none placeholder-neutral-600 focus:border-white/30 transition-all" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t('settings.playlists.updateInterval')}</label>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {[
                      { value: 6, label: language === 'tr' ? '6 Saat' : '6 Hours' },
                      { value: 12, label: language === 'tr' ? '12 Saat' : '12 Hours' },
                      { value: 24, label: language === 'tr' ? '1 Gün' : '1 Day' },
                      { value: 168, label: language === 'tr' ? '7 Gün' : '7 Days' }
                    ].map(option => (
                      <button type="button" key={option.value} onClick={() => onUpdateIntervalChange(option.value as 6 | 12 | 24 | 168)} className={`h-11 rounded-xl border text-[10px] font-black transition-all ${updateInterval === option.value ? 'border-white bg-white text-black' : 'border-white/8 bg-white/[0.025] text-neutral-500 hover:text-white hover:border-white/20'}`}>{option.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="max-w-2xl mx-auto animate-fade-in">
                <div className="flex flex-col items-center text-center">
                  <div className="w-28 h-28 rounded-[28px] overflow-hidden border-2 border-white/20 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">{renderAvatar(avatar, 'w-full h-full')}</div>
                  <h3 className="mt-5 text-2xl font-black text-white">{name.trim()}</h3>
                  <p className="mt-2 text-xs text-neutral-500">{language === 'tr' ? 'Profilin oluşturulmaya hazır.' : 'Your profile is ready to be created.'}</p>
                </div>

                <div className="mt-8 grid sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                    <span className="text-[9px] font-black uppercase tracking-wider text-neutral-600">{language === 'tr' ? 'IPTV bağlantısı' : 'IPTV Connection'}</span>
                    <span className="block mt-2 text-xs font-bold text-white">{playlistType === 'none' ? (language === 'tr' ? 'Daha sonra eklenecek' : 'Will be added later') : playlistType === 'm3u' ? (language === 'tr' ? 'M3U bağlantısı' : 'M3U Connection') : 'Xtream Codes'}</span>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                    <span className="text-[9px] font-black uppercase tracking-wider text-neutral-600">{language === 'tr' ? 'Güncelleme aralığı' : 'Update Interval'}</span>
                    <span className="block mt-2 text-xs font-bold text-white">{updateInterval === 168 ? (language === 'tr' ? '7 günde bir' : 'Every 7 days') : updateInterval === 24 ? (language === 'tr' ? 'Her gün' : 'Every day') : (language === 'tr' ? `${updateInterval} saatte bir` : `Every ${updateInterval} hours`)}</span>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                  <span className="text-[9px] font-black uppercase tracking-wider text-neutral-600">{t('settings.appearance.theme')}</span>
                  <span className="block mt-2 text-xs font-bold text-white">
                    {contentPreferences.length
                      ? contentPreferenceOptions
                          .filter(option => contentPreferencesSet.has(option.id))
                          .map(option => option.id === 'series' ? t('navbar.series') :
                                          option.id === 'movies' ? t('navbar.movies') :
                                          option.id === 'live' ? t('navbar.liveTv') :
                                          option.id === 'sports' ? (language === 'tr' ? 'Spor' : 'Sports') :
                                          (language === 'tr' ? 'Çocuk' : 'Kids'))
                          .join(' · ')
                      : (language === 'tr' ? 'Dengeli ana sayfa' : 'Balanced homepage')}
                  </span>
                </div>

                <div className="mt-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.055] p-4 flex items-start gap-3">
                  <Check size={17} className="mt-0.5 text-emerald-400 shrink-0" />
                  <p className="text-[10px] leading-relaxed text-emerald-100/65">{language === 'tr' ? 'Profil oluşturulduktan sonra kanal listen hazırlanacak ve doğrudan ana sayfaya yönlendirileceksin.' : 'Once the profile is created, your channel list will be prepared and you will be directed straight to the homepage.'}</p>
                </div>
              </div>
            )}
          </div>

          {!avatarPickerOpen && <footer className="h-20 shrink-0 px-6 md:px-9 border-t border-white/8 flex items-center justify-between gap-3 bg-black/20">
            <button type="button"
              onClick={() => step === 1 ? onClose() : setStep(current => current - 1)}
              disabled={isSaving}
              className="h-11 px-5 rounded-2xl border border-white/10 bg-white/[0.025] hover:bg-white/[0.07] disabled:opacity-40 text-xs font-bold text-neutral-300 hover:text-white flex items-center gap-2 transition-all"
            >
              <ArrowLeft size={14} /> {step === 1 ? t('common.cancel') : t('common.back')}
            </button>

            {step < 3 ? (
              <button type="button"
                onClick={() => canContinue && setStep(current => current + 1)}
                disabled={!canContinue}
                className="h-11 px-6 rounded-2xl bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 text-black text-xs font-black flex items-center gap-2 transition-all"
              >
                {language === 'tr' ? 'Devam Et' : 'Continue'} <ArrowRight size={14} />
              </button>
            ) : (
              <button type="button"
                onClick={onSave}
                disabled={isSaving}
                className="h-11 px-6 rounded-2xl bg-white hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-400 text-black text-xs font-black flex items-center gap-2 transition-all shadow-[0_14px_38px_rgba(255,255,255,0.10)]"
              >
                {isSaving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} strokeWidth={3} />}
                {isSaving ? (language === 'tr' ? 'Hazırlanıyor' : 'Preparing...') : t('profiles.setupWizard.createProfile')}
              </button>
            )}
          </footer>}
        </main>
      </div>
    </div>
  );
}
