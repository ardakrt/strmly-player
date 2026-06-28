import React, { useEffect, useState } from 'react';
import { Plus, X, Trash2, ChevronLeft, Pencil, UserRound, Search, Check, LoaderCircle, Settings2, ArrowUpRight } from 'lucide-react';
import type { Profile, AvatarSearchResult, ContentPreference } from '../types';
import type { ProfileSetupStatus } from '../hooks/useProfiles';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { CreateProfileWizard } from './CreateProfileWizard';
import { useSettings } from '../context/SettingsContext';

interface LocalSeries {
  id: number;
  name: string;
  posterUrl: string;
}

interface SeriesCast {
  name: string;
  avatarUrl: string;
}

const contentPreferenceLabels: Array<{ id: ContentPreference; label: string }> = [
  { id: 'series', label: 'Dizi' },
  { id: 'movies', label: 'Film' },
  { id: 'sports', label: 'Spor' },
  { id: 'live', label: 'Canlı TV' },
  { id: 'kids', label: 'Çocuk' }
];

interface ProfileScreenProps {
  profiles: Profile[];
  profileSelectMode: 'select' | 'manage' | 'create' | 'edit';
  profileFormName: string;
  profileFormAvatar: string;
  profileContentPreferences: ContentPreference[];
  editingProfileId: string | null;
  profilePlaylistType: 'none' | 'm3u' | 'xtream';
  profileM3uUrl: string;
  profileXtreamUrl: string;
  profileXtreamUser: string;
  profileXtreamPass: string;
  profileAutoUpdateIntervalHours: 6 | 12 | 24 | 168;
  avatarSearchQuery: string;
  avatarSearchResults: AvatarSearchResult[];
  avatarSearchLoading: boolean;
  trendingAvatars: string[];
  localSeries: LocalSeries[];
  selectedSeriesForCast: { id: number; name: string } | null;
  seriesCast: SeriesCast[];
  castLoading: boolean;
  isParsing: boolean;
  profileSetupStatus: ProfileSetupStatus;
  profileEntryReady: boolean;
  toast: { show: boolean; message: string };
  activeTheme: string;
  accentStyles: React.CSSProperties;
  setProfileSelectMode: (mode: 'select' | 'manage' | 'create' | 'edit') => void;
  setProfileFormName: (name: string) => void;
  setProfileFormAvatar: (avatar: string) => void;
  setProfileContentPreferences: (preferences: ContentPreference[]) => void;
  setEditingProfileId: (id: string | null) => void;
  setProfilePlaylistType: (type: 'none' | 'm3u' | 'xtream') => void;
  setProfileM3uUrl: (url: string) => void;
  setProfileXtreamUrl: (url: string) => void;
  setProfileXtreamUser: (user: string) => void;
  setProfileXtreamPass: (pass: string) => void;
  setProfileAutoUpdateIntervalHours: (hours: 6 | 12 | 24 | 168) => void;
  setAvatarSearchQuery: (query: string) => void;
  setAvatarSearchResults: (results: AvatarSearchResult[]) => void;
  setSelectedSeriesForCast: (series: { id: number; name: string } | null) => void;
  setSeriesCast: (cast: SeriesCast[]) => void;
  onSelectProfile: (id: string) => void | Promise<void>;
  onSaveProfile: () => void;
  onDeleteProfile: (id: string) => void | Promise<void>;
  onAvatarSearch: (query: string) => void;
  onFetchSeriesCast: (id: number, name: string, mediaType: 'movie' | 'tv') => void;
}

export const ProfileScreen = (props: ProfileScreenProps) => {
  const {
    profiles, profileSelectMode, profileFormName, profileFormAvatar, profileContentPreferences,
    editingProfileId, profilePlaylistType, profileM3uUrl, profileXtreamUrl,
    profileXtreamUser, profileXtreamPass, profileAutoUpdateIntervalHours, avatarSearchQuery, avatarSearchResults,
    avatarSearchLoading, localSeries, selectedSeriesForCast,
    seriesCast, castLoading, isParsing, profileSetupStatus, profileEntryReady, toast, activeTheme, accentStyles,
    setProfileSelectMode, setProfileFormName, setProfileFormAvatar, setProfileContentPreferences,
    setEditingProfileId, setProfilePlaylistType, setProfileM3uUrl,
    setProfileXtreamUrl, setProfileXtreamUser, setProfileXtreamPass, setProfileAutoUpdateIntervalHours,
    setAvatarSearchQuery, setAvatarSearchResults, setSelectedSeriesForCast,
    setSeriesCast, onSelectProfile, onSaveProfile, onDeleteProfile,
    onAvatarSearch, onFetchSeriesCast
  } = props;

  const { t, language } = useSettings();

  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [focusedProfileId, setFocusedProfileId] = useState<string | null>(profiles[0]?.id ?? null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [profileContextMenu, setProfileContextMenu] = useState<{ x: number; y: number; profile: Profile } | null>(null);
  const [enteringProfile, setEnteringProfile] = useState<Profile | null>(null);
  const [entryStage, setEntryStage] = useState(0);

  const enterProfile = (profile: Profile) => {
    setEnteringProfile(profile);
    setEntryStage(0);
    void Promise.resolve(onSelectProfile(profile.id)).catch(() => setEnteringProfile(null));
  };

  const handleDeleteConfirm = async () => {
    if (editingProfileId) {
      await onDeleteProfile(editingProfileId);
      setProfileSelectMode('select');
      setEditingProfileId(null);
      setIsAvatarPickerOpen(false);
      setShowDeleteConfirm(false);
    }
  };

  const openProfileEditor = (profile: Profile) => {
    setEditingProfileId(profile.id);
    setProfileFormName(profile.name);
    setProfileFormAvatar(profile.avatarUrl);
    setProfileContentPreferences(profile.contentPreferences || []);
    setProfileAutoUpdateIntervalHours(profile.autoUpdateIntervalHours || 24);
    setProfileSelectMode('edit');
    setIsAvatarPickerOpen(false);
  };

  const profileContextItems: ContextMenuItem[] = profileContextMenu ? [
    {
      id: 'open-profile',
      label: language === 'tr' ? 'Profili aç' : 'Open Profile',
      icon: <ArrowUpRight size={16} />,
      onSelect: () => enterProfile(profileContextMenu.profile)
    },
    {
      id: 'edit-profile',
      label: language === 'tr' ? 'Profili düzenle' : 'Edit Profile',
      icon: <Pencil size={15} />,
      onSelect: () => openProfileEditor(profileContextMenu.profile)
    },
    {
      id: 'delete-profile',
      label: language === 'tr' ? 'Profili sil' : 'Delete Profile',
      icon: <Trash2 size={15} />,
      danger: true,
      separatorBefore: true,
      onSelect: () => {
        const profile = profileContextMenu.profile;
        setEditingProfileId(profile.id);
        setProfileFormName(profile.name);
        setProfileFormAvatar(profile.avatarUrl);
        setShowDeleteConfirm(true);
      }
    }
  ] : [];

  useEffect(() => {
    if (!focusedProfileId || !profiles.some(profile => profile.id === focusedProfileId)) {
      setFocusedProfileId(profiles[0]?.id ?? null);
    }
  }, [focusedProfileId, profiles]);

  useEffect(() => {
    if (!isParsing || !enteringProfile || profileSetupStatus.active) return;
    const timers = [
      window.setTimeout(() => setEntryStage(1), 450),
      window.setTimeout(() => setEntryStage(2), 1100)
    ];
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [isParsing, enteringProfile, profileSetupStatus.active]);

  useEffect(() => {
    if (profileEntryReady && enteringProfile) setEntryStage(3);
  }, [profileEntryReady, enteringProfile]);

  const renderAvatarSelectorContent = () => {
    if (selectedSeriesForCast) {
      if (seriesCast.length === 0) {
        return (
          <div className="h-[440px] border border-dashed border-white/5 rounded-2xl flex items-center justify-center bg-black/40 text-neutral-500 text-xs animate-fade-in">
            {language === 'tr' ? 'Diziye ait oyuncu görseli bulunamadı.' : 'No actor images found for this series.'}
          </div>
        );
      }
      return (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 max-h-[440px] overflow-y-auto pr-1 hide-scrollbar border border-white/5 rounded-2xl p-2.5 bg-black/40 animate-fade-in">
          {seriesCast.map((actor, idx) => (
            <button
              key={idx}
              onClick={() => setProfileFormAvatar(actor.avatarUrl)}
              className={`flex flex-col items-center gap-1.5 p-1.5 rounded-xl border transition-all duration-200 transform hover:scale-103 cursor-pointer ${
                profileFormAvatar === actor.avatarUrl
                  ? 'border-white bg-white/[0.04] shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                  : 'border-transparent hover:border-white/10 hover:bg-white/[0.01]'
              }`}
            >
              <div className="w-16 h-16 rounded-full overflow-hidden border border-white/10 shadow-md">
                <img src={actor.avatarUrl} className="w-full h-full object-cover" alt={actor.name} loading="lazy" />
              </div>
              <span className="text-[9px] font-bold text-neutral-400 text-center truncate w-full" title={actor.name}>
                {actor.name}
              </span>
            </button>
          ))}
        </div>
      );
    }

    if (avatarSearchResults.length > 0) {
      return (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3 max-h-[440px] overflow-y-auto pr-1 hide-scrollbar border border-white/5 rounded-2xl p-2.5 bg-black/40 animate-fade-in">
          {avatarSearchResults.map((item) => (
            <button
              key={item.id}
              onClick={() => onFetchSeriesCast(item.id, item.name, item.mediaType)}
              className="group aspect-[2/3] rounded-xl overflow-hidden border border-transparent hover:border-white/20 transition-all duration-300 transform hover:scale-105 cursor-pointer relative shadow-lg"
              title={item.name}
            >
              <img src={item.posterUrl} className="w-full h-full object-cover" alt={item.name} loading="lazy" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center">
                <span className="text-[8px] font-black text-white text-center truncate w-full">
                  {item.name}
                </span>
              </div>
            </button>
          ))}
        </div>
      );
    }

    if (localSeries.length === 0) {
      return (
        <div className="h-[440px] border border-dashed border-white/5 rounded-2xl flex items-center justify-center bg-black/40 text-neutral-500 text-xs animate-fade-in">
          {language === 'tr' ? 'Yerli dizi listesi yüklenemedi. TMDB bağlantısını kontrol edin.' : 'Failed to load local series list. Check your TMDB connection.'}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3 max-h-[440px] overflow-y-auto pr-1 hide-scrollbar border border-white/5 rounded-2xl p-2.5 bg-black/40 animate-fade-in">
        {localSeries.map((series) => (
          <button
            key={series.id}
            onClick={() => onFetchSeriesCast(series.id, series.name, 'tv')}
            className="group aspect-[2/3] rounded-xl overflow-hidden border border-transparent hover:border-white/20 transition-all duration-300 transform hover:scale-105 cursor-pointer relative shadow-lg"
            title={series.name}
          >
            <img src={series.posterUrl} className="w-full h-full object-cover" alt={series.name} loading="lazy" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center">
              <span className="text-[8px] font-black text-white text-center truncate w-full">
                {series.name}
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div
      className={`app-wrapper flex flex-col h-screen bg-[var(--bg-main)] text-white relative overflow-hidden select-none ${activeTheme}`}
      style={accentStyles}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="absolute inset-0 z-0 pointer-events-none bg-[#050506]" />
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {profiles.map(profile => {
          const isActiveAmbient = focusedProfileId === profile.id;
          const isGradient = profile.avatarUrl.startsWith('linear-gradient');
          return (
            <div
              key={`ambient-${profile.id}`}
              className={`absolute inset-0 transition-opacity duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${isActiveAmbient ? 'opacity-100' : 'opacity-0'}`}
              style={{ willChange: 'opacity' }}
            >
              <div className="absolute left-1/2 top-[47%] w-[62vw] h-[62vw] max-w-[980px] max-h-[980px] -translate-x-1/2 -translate-y-1/2">
                {isGradient ? (
                  <div className="w-full h-full rounded-full blur-[120px] opacity-20 scale-[0.82]" style={{ background: profile.avatarUrl }} />
                ) : (
                  <img
                    src={profile.avatarUrl}
                    className="w-full h-full rounded-full object-cover blur-[120px] opacity-[0.18] saturate-[1.35] scale-[0.82]"
                    alt=""
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_42%,rgba(255,255,255,0.055)_0%,rgba(255,255,255,0.018)_24%,transparent_58%),linear-gradient(to_bottom,rgba(5,5,6,0.18)_0%,rgba(5,5,6,0.38)_54%,#030304_100%)]" />
      <div className="absolute inset-0 z-0 pointer-events-none shadow-[inset_0_0_220px_90px_rgba(0,0,0,0.72)]" />
      <div className="absolute inset-x-0 top-0 z-0 h-px pointer-events-none bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {isParsing && (
        <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-xl flex items-center justify-center p-5 animate-fade-in select-none">
          {profileSetupStatus.active ? (
            <div className="relative w-full max-w-[520px] overflow-hidden rounded-[32px] border border-white/12 bg-[#09090b]/95 p-6 md:p-8 shadow-[0_36px_130px_rgba(0,0,0,0.8)]">
              <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              <div className="absolute -top-24 -right-20 w-56 h-56 rounded-full bg-[var(--accent-color)] opacity-[0.07] blur-3xl pointer-events-none" />

              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/15 bg-white/[0.06] flex items-center justify-center shrink-0 shadow-xl">
                  {profileFormAvatar ? (
                    profileFormAvatar.startsWith('linear-gradient') ? (
                      <div className="w-full h-full" style={{ background: profileFormAvatar }} />
                    ) : (
                      <img src={profileFormAvatar} className="w-full h-full object-cover" alt="" />
                    )
                  ) : (
                    <UserRound size={22} className="text-neutral-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">{profileFormName || 'Yeni Profil'}</span>
                  <h3 className="mt-1 text-xl font-black text-white tracking-tight">{profileSetupStatus.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-400">{profileSetupStatus.detail}</p>
                </div>
              </div>

              <div className="relative mt-7 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-[var(--accent-color)] shadow-[0_0_18px_var(--accent-glow)] transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.max(8, profileSetupStatus.step * 25)}%` }}
                />
              </div>

              <div className="mt-6 grid grid-cols-4 gap-2">
                {[
                  language === 'tr' ? 'Bağlantı' : 'Connection',
                  language === 'tr' ? 'İçerikler' : 'Content',
                  language === 'tr' ? 'Kayıt' : 'Save',
                  language === 'tr' ? 'Hazırlık' : 'Setup'
                ].map((label, index) => {
                  const step = index + 1;
                  const completed = profileSetupStatus.step > step;
                  const active = profileSetupStatus.step === step;
                  return (
                    <div key={label} className="flex flex-col items-center gap-2 text-center">
                      <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                        completed
                          ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-black'
                          : active
                            ? 'bg-white/10 border-white/30 text-white shadow-[0_0_22px_rgba(255,255,255,0.10)]'
                            : 'bg-black/20 border-white/8 text-neutral-600'
                      }`}>
                        {completed ? <Check size={14} strokeWidth={3} /> : active ? <LoaderCircle size={14} className="animate-spin" /> : <span className="text-[10px] font-black">{step}</span>}
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${active || completed ? 'text-neutral-300' : 'text-neutral-600'}`}>{label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-7 flex items-center justify-between gap-4 border-t border-white/8 pt-4">
                <span className="text-[10px] leading-relaxed text-neutral-500">
                  {language === 'tr' ? 'Liste boyutuna göre bu işlem kısa bir süre alabilir.' : 'Depending on the list size, this process may take a short time.'}
                </span>
                {profileSetupStatus.itemCount !== undefined && (
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] font-black text-neutral-300">
                    {language === 'tr'
                      ? `${profileSetupStatus.itemCount.toLocaleString('tr-TR')} içerik`
                      : `${profileSetupStatus.itemCount.toLocaleString('en-US')} items`}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 overflow-hidden bg-[#030304] flex items-center justify-center">
              {enteringProfile && (
                <>
                  <div className="absolute inset-0 scale-110 opacity-30">
                    {enteringProfile.avatarUrl.startsWith('linear-gradient') ? (
                      <div className="w-full h-full" style={{ background: enteringProfile.avatarUrl }} />
                    ) : (
                      <img src={enteringProfile.avatarUrl} className="w-full h-full object-cover blur-[100px] scale-125 saturate-150" alt="" />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(to_bottom,rgba(0,0,0,0.54),rgba(0,0,0,0.90))]" />
                </>
              )}
              <div className="absolute inset-0 shadow-[inset_0_0_240px_100px_rgba(0,0,0,0.8)]" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

              <div className="relative z-10 w-full max-w-[400px] px-8 py-10 rounded-[36px] border border-white/10 bg-[#09090b]/72 backdrop-blur-2xl shadow-[0_32px_100px_rgba(0,0,0,0.7)] flex flex-col items-center text-center animate-fade-in">
                <div className="mb-8 flex items-center gap-2.5 text-white/60">
                  <img src="./icon.png" className="w-6 h-6 object-contain opacity-80" alt="" />
                  <span className="text-[10px] font-black tracking-[0.28em]">STRMLY</span>
                </div>

                <div className="relative">
                  <div className="absolute -inset-2 rounded-[34px] bg-[var(--accent-color)]/5 blur-xl" />
                  <div className="relative w-24 h-24 rounded-[28px] overflow-hidden border-2 border-white/20 bg-neutral-950 shadow-[0_24px_70px_rgba(0,0,0,0.6)]">
                    {enteringProfile ? (
                      enteringProfile.avatarUrl.startsWith('linear-gradient') ? (
                        <div className="w-full h-full" style={{ background: enteringProfile.avatarUrl }} />
                      ) : (
                        <img src={enteringProfile.avatarUrl} className="w-full h-full object-cover" alt={enteringProfile.name} />
                      )
                    ) : (
                      <UserRound size={30} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-neutral-500" />
                    )}
                  </div>
                </div>

                <span className="mt-6 text-[8px] font-black uppercase tracking-[0.24em] text-neutral-500">{language === 'tr' ? 'Hoş geldin' : 'Welcome'}</span>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-white">{enteringProfile?.name || (language === 'tr' ? 'Profilin' : 'Your profile')}</h2>

                {enteringProfile?.contentPreferences?.length ? (
                  <div className="mt-3.5 flex flex-wrap justify-center gap-1.5">
                    {contentPreferenceLabels.filter(option => enteringProfile.contentPreferences?.includes(option.id)).map(option => {
                      const optLabel = option.id === 'series' ? (language === 'tr' ? 'Dizi' : 'Series') :
                                       option.id === 'movies' ? (language === 'tr' ? 'Film' : 'Movies') :
                                       option.id === 'sports' ? (language === 'tr' ? 'Spor' : 'Sports') :
                                       option.id === 'live' ? (language === 'tr' ? 'Canlı TV' : 'Live TV') :
                                       (language === 'tr' ? 'Çocuk' : 'Kids');
                      return (
                        <span key={option.id} className="rounded-full border border-white/5 bg-white/[0.04] px-2.5 py-1 text-[8px] font-bold text-neutral-400">{optLabel}</span>
                      );
                    })}
                  </div>
                ) : null}

                <div className="mt-8 w-full max-w-[260px]">
                  <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full transition-[width] duration-750 ease-out"
                      style={{ 
                        width: `${[28, 58, 92, 100][entryStage]}%`,
                        backgroundColor: 'var(--accent-color)',
                        boxShadow: '0 0 10px var(--accent-glow)'
                      }}
                    />
                  </div>
                  <div className="mt-3.5 flex items-center justify-center gap-2">
                    <span className="relative flex w-1.5 h-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: 'var(--accent-color)' }} />
                      <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent-color)' }} />
                    </span>
                    <span className="text-[10px] font-bold tracking-wide text-neutral-400">
                      {[
                        language === 'tr' ? 'Profilin hazırlanıyor' : 'Preparing your profile',
                        language === 'tr' ? 'Kütüphanen düzenleniyor' : 'Organizing your library',
                        language === 'tr' ? 'Ana sayfan kişiselleştiriliyor' : 'Personalizing your homepage',
                        language === 'tr' ? 'Hazır' : 'Ready'
                      ][entryStage]}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {toast.show && (
        <div className="fixed top-6 right-6 z-[5000] px-5 py-3.5 bg-neutral-950/80 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center gap-3.5 shadow-2xl max-w-sm animate-scale-in">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-color)] animate-ping" />
          <span className="text-xs font-semibold text-neutral-200 tracking-wide">{toast.message}</span>
        </div>
      )}

      <div className="flex-1 z-10 overflow-y-auto hide-scrollbar select-none page-transition-enter w-full">
        <div className="relative min-h-full w-full max-w-[1480px] mx-auto px-6 md:px-12 py-10 md:py-14 flex flex-col items-center justify-center">
          <div className="absolute top-8 right-8 md:top-10 md:right-12">
            {profileSelectMode === 'select' ? (
              <button
                onClick={() => setProfileSelectMode('manage')}
                className="h-10 px-4 rounded-full border border-white/10 bg-black/30 hover:bg-white/10 text-[10px] font-black text-neutral-400 hover:text-white tracking-widest uppercase transition-all backdrop-blur-xl flex items-center gap-2"
              >
                <Settings2 size={14} /> {t('profiles.editProfiles')}
              </button>
            ) : (
              <button
                onClick={() => setProfileSelectMode('select')}
                className="h-10 px-5 rounded-full bg-white hover:bg-neutral-200 text-black text-[10px] font-black tracking-widest uppercase transition-all"
              >
                {t('profiles.finish')}
              </button>
            )}
          </div>

          <div className="flex flex-col items-center text-center mb-10 md:mb-12">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-11 h-11 rounded-2xl bg-white text-black flex items-center justify-center shadow-[0_18px_55px_rgba(255,255,255,0.12)]">
                <img src="./icon.png" className="w-8 h-8 object-contain" alt="Strmly Logo" />
              </div>
              <span className="text-2xl md:text-3xl font-black tracking-tight text-white">STRMLY</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-none">
              {profileSelectMode === 'manage' ? t('profiles.editProfiles') : t('profiles.title')}
            </h1>
            <p className="mt-4 max-w-xl text-xs md:text-sm text-neutral-400 leading-relaxed">
              {profileSelectMode === 'manage'
                ? (language === 'tr' ? 'Düzenlemek istediğin profili seç. Her profil kendi listesini ve izleme geçmişini korur.' : 'Select the profile you want to edit. Each profile maintains its own list and watch history.')
                : t('profiles.subtitle')}
            </p>
          </div>

          <div className="w-full flex flex-wrap items-start justify-center gap-7 md:gap-9">
            {profiles.map(profile => {
              const isGradient = profile.avatarUrl.startsWith('linear-gradient');
              const isFocused = focusedProfileId === profile.id;
              return (
                <button
                  key={profile.id}
                  onMouseEnter={() => setFocusedProfileId(profile.id)}
                  onFocus={() => setFocusedProfileId(profile.id)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setFocusedProfileId(profile.id);
                    setProfileContextMenu({ x: event.clientX, y: event.clientY, profile });
                  }}
                  onClick={() => {
                    if (profileSelectMode === 'manage') {
                      openProfileEditor(profile);
                    } else {
                      enterProfile(profile);
                    }
                  }}
                  className={`group relative w-[164px] md:w-[190px] text-center transition-all duration-500 ${isFocused ? 'md:-translate-y-2' : 'opacity-75 hover:opacity-100'}`}
                >
                  <div className="relative">
                    {!isGradient && (
                      <img src={profile.avatarUrl} className={`absolute -inset-3 w-[calc(100%+24px)] h-[calc(100%+24px)] rounded-[34px] object-cover blur-2xl transition-opacity duration-500 ${isFocused ? 'opacity-30' : 'opacity-0'}`} alt="" />
                    )}
                    <div className={`relative aspect-square rounded-[30px] overflow-hidden bg-neutral-950 border-2 transition-all duration-500 shadow-[0_24px_70px_rgba(0,0,0,0.5)] ${isFocused ? 'border-white/70 scale-[1.035]' : 'border-white/10 group-hover:border-white/35'}`}>
                      {isGradient ? (
                        <div className="w-full h-full" style={{ background: profile.avatarUrl }} />
                      ) : (
                        <img src={profile.avatarUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={profile.name} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-transparent" />
                      <div className={`absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
                        profileSelectMode === 'manage'
                          ? 'bg-white text-black'
                          : 'bg-black/65 border border-white/20 text-white backdrop-blur-xl'
                      } ${isFocused ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-90'}`}>
                        {profileSelectMode === 'manage' ? <Pencil size={14} /> : <ArrowUpRight size={16} />}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 px-1">
                    <span className="block truncate text-base font-black text-white">{profile.name}</span>
                  </div>
                </button>
              );
            })}

            {profiles.length < 5 && profileSelectMode === 'select' && (
              <button
                onMouseEnter={() => setFocusedProfileId(null)}
                onClick={() => {
                  setProfileFormName('');
                  setProfileFormAvatar('');
                  setProfileContentPreferences([]);
                  setSelectedSeriesForCast(null);
                  setSeriesCast([]);
                  setProfilePlaylistType('none');
                  setProfileAutoUpdateIntervalHours(24);
                  setEditingProfileId(null);
                  setProfileSelectMode('create');
                  setIsAvatarPickerOpen(false);
                }}
                className="group w-[164px] md:w-[190px] text-center opacity-65 hover:opacity-100 transition-all duration-500 hover:-translate-y-2"
              >
                <div className="aspect-square rounded-[30px] border-2 border-dashed border-white/15 group-hover:border-white/45 bg-black/25 group-hover:bg-white/[0.05] flex items-center justify-center transition-all duration-500 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
                  <div className="w-16 h-16 rounded-full bg-white/[0.07] group-hover:bg-white text-neutral-300 group-hover:text-black flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                    <Plus size={26} />
                  </div>
                </div>
                <div className="mt-4 px-1">
                  <span className="block text-base font-black text-neutral-300 group-hover:text-white">{t('profiles.newProfile')}</span>
                  <span className="mt-1.5 block text-[10px] font-semibold text-neutral-600">{language === 'tr' ? 'Avatar ve liste kurulumu' : 'Avatar and list setup'}</span>
                </div>
              </button>
            )}
          </div>

        </div>
      </div>

      {profileContextMenu && (
        <ContextMenu
          x={profileContextMenu.x}
          y={profileContextMenu.y}
          title={profileContextMenu.profile.name}
          subtitle={language === 'tr' ? 'Profil işlemleri' : 'Profile Actions'}
          items={profileContextItems}
          onClose={() => setProfileContextMenu(null)}
        />
      )}

      {profileSelectMode === 'create' && (
        <CreateProfileWizard
          name={profileFormName}
          avatar={profileFormAvatar}
          contentPreferences={profileContentPreferences}
          playlistType={profilePlaylistType}
          m3uUrl={profileM3uUrl}
          xtreamUrl={profileXtreamUrl}
          xtreamUser={profileXtreamUser}
          xtreamPass={profileXtreamPass}
          updateInterval={profileAutoUpdateIntervalHours}
          avatarSearchQuery={avatarSearchQuery}
          avatarSearchResults={avatarSearchResults}
          avatarSearchLoading={avatarSearchLoading}
          localSeries={localSeries}
          selectedSeriesForCast={selectedSeriesForCast}
          seriesCast={seriesCast}
          castLoading={castLoading}
          isSaving={isParsing}
          onNameChange={setProfileFormName}
          onAvatarChange={setProfileFormAvatar}
          onContentPreferencesChange={setProfileContentPreferences}
          onPlaylistTypeChange={setProfilePlaylistType}
          onM3uUrlChange={setProfileM3uUrl}
          onXtreamUrlChange={setProfileXtreamUrl}
          onXtreamUserChange={setProfileXtreamUser}
          onXtreamPassChange={setProfileXtreamPass}
          onUpdateIntervalChange={setProfileAutoUpdateIntervalHours}
          onAvatarSearchQueryChange={setAvatarSearchQuery}
          onAvatarSearchResultsChange={setAvatarSearchResults}
          onSelectedSeriesForCastChange={setSelectedSeriesForCast}
          onSeriesCastChange={setSeriesCast}
          onAvatarSearch={onAvatarSearch}
          onFetchSeriesCast={onFetchSeriesCast}
          onClose={() => {
            setProfileSelectMode('select');
            setEditingProfileId(null);
          }}
          onSave={onSaveProfile}
        />
      )}

        {profileSelectMode === 'edit' && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 select-none page-transition-enter">
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => {
              setProfileSelectMode(editingProfileId ? 'manage' : 'select');
              setEditingProfileId(null);
              setIsAvatarPickerOpen(false);
            }} />

            <div className={`relative w-full transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] bg-[#070709]/95 border border-white/10 rounded-[32px] p-4 md:p-6 flex flex-col gap-4 shadow-[0_30px_110px_rgba(0,0,0,0.68)] z-10 overflow-y-auto overflow-x-hidden max-h-[92vh] hide-scrollbar ${
              isAvatarPickerOpen
                ? 'max-w-xl md:max-w-6xl xl:max-w-7xl'
                : 'max-w-lg'
            }`}>
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />
              <div className="absolute -top-28 -right-24 w-64 h-64 rounded-full bg-white/[0.035] blur-3xl pointer-events-none" />
              <div className="relative flex justify-between items-start gap-4 border-b border-white/6 pb-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white text-black flex items-center justify-center shadow-[0_12px_34px_rgba(255,255,255,0.12)]">
                    <UserRound size={18} strokeWidth={2.4} />
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-neutral-500 tracking-[0.22em] uppercase">
                      {profileSelectMode === 'edit' ? (language === 'tr' ? 'Profil Ayarları' : 'Profile Settings') : (language === 'tr' ? 'Yeni İzleme Alanı' : 'New Viewing Space')}
                    </span>
                    <h3 className="mt-0.5 text-xl font-black text-white tracking-tight">
                      {profileSelectMode === 'edit' ? (language === 'tr' ? 'Profili Düzenle' : 'Edit Profile') : (language === 'tr' ? 'Profil Oluştur' : 'Create Profile')}
                    </h3>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {profileSelectMode === 'edit'
                        ? (language === 'tr' ? 'İsim, avatar ve içerik tercihlerini güncelle.' : 'Update name, avatar, and content preferences.')
                        : (language === 'tr' ? 'Kendi IPTV listen için temiz bir profil hazırla.' : 'Setup a clean profile for your IPTV playlist.')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setProfileSelectMode(editingProfileId ? 'manage' : 'select');
                    setEditingProfileId(null);
                    setIsAvatarPickerOpen(false);
                  }}
                  className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/8 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex flex-row w-full transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] overflow-hidden">
                <div className={`flex flex-col gap-4 shrink-0 transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] items-center ${
                  isAvatarPickerOpen
                    ? 'w-full md:w-[320px]'
                    : 'w-full'
                }`}>
                  <div className="relative group/avatar mt-1">
                    <button
                      onClick={() => setIsAvatarPickerOpen(!isAvatarPickerOpen)}
                      className="relative w-24 h-24 md:w-28 md:h-28 rounded-[28px] p-1.5 border border-white/12 hover:border-white/35 bg-white/[0.04] shadow-[0_22px_70px_rgba(0,0,0,0.42)] overflow-hidden transition-all duration-300 hover:scale-[1.025] active:scale-[0.98] cursor-pointer block"
                      title={language === 'tr' ? 'Profil resmi seç / değiştir' : 'Select / change profile picture'}
                    >
                      <div className="w-full h-full rounded-[21px] overflow-hidden flex items-center justify-center bg-black/45">
                        {profileFormAvatar ? (
                          profileFormAvatar.startsWith('linear-gradient') ? (
                            <div className="w-full h-full" style={{ background: profileFormAvatar }} />
                          ) : (
                            <img src={profileFormAvatar} className="w-full h-full object-cover" alt="Preview" />
                          )
                        ) : (
                          <UserRound size={34} className="text-neutral-500" />
                        )}
                        <div className="absolute inset-0 bg-black/62 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-[10px] font-black tracking-wider text-white uppercase">
                            {language === 'tr' ? 'Değiştir' : 'Change'}
                          </span>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => setIsAvatarPickerOpen(!isAvatarPickerOpen)}
                      className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full border border-white/10 shadow-lg flex items-center justify-center transition-all duration-300 cursor-pointer ${
                        isAvatarPickerOpen
                          ? 'bg-white text-black border-white hover:bg-neutral-200'
                          : 'bg-neutral-900 hover:bg-neutral-800 text-white'
                      }`}
                    >
                      {isAvatarPickerOpen ? (
                        <X size={12} strokeWidth={2.5} />
                      ) : (
                        <Pencil size={12} strokeWidth={2.5} />
                      )}
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5 text-center w-full z-10">
                    <span className="text-base font-black text-white tracking-tight truncate max-w-full block">
                      {profileFormName || (language === 'tr' ? 'Profil Adı' : 'Profile Name')}
                    </span>
                    <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-wider">
                      {isAvatarPickerOpen
                        ? (language === 'tr' ? 'Avatar paneli açık' : 'Avatar panel is open')
                        : (language === 'tr' ? 'Avatarı değiştirmek için görsele tıkla' : 'Click image to change avatar')}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 w-full rounded-2xl border border-white/8 bg-white/[0.025] p-3">
                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
                      {language === 'tr' ? 'Profil Adı' : 'Profile Name'}
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder={language === 'tr' ? 'Profil adını girin...' : 'Enter profile name...'}
                      value={profileFormName}
                      onChange={(e) => setProfileFormName(e.target.value)}
                      className="w-full h-10 px-4 rounded-2xl bg-black/35 border border-white/8 focus:border-white/25 text-sm outline-none text-white transition-all placeholder-neutral-600 font-semibold"
                    />
                  </div>

                  <div className="flex flex-col gap-2 w-full rounded-2xl border border-white/8 bg-white/[0.025] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
                        {language === 'tr' ? 'İçerik tercihleri' : 'Content Preferences'}
                      </label>
                      <span className="text-[9px] text-neutral-600">
                        {profileContentPreferences.length || (language === 'tr' ? 'Dengeli' : 'Balanced')}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {contentPreferenceLabels.map(option => {
                        const selected = profileContentPreferences.includes(option.id);
                        const optLabel = option.id === 'series' ? (language === 'tr' ? 'Dizi' : 'Series') :
                                         option.id === 'movies' ? (language === 'tr' ? 'Film' : 'Movies') :
                                         option.id === 'sports' ? (language === 'tr' ? 'Spor' : 'Sports') :
                                         option.id === 'live' ? (language === 'tr' ? 'Canlı TV' : 'Live TV') :
                                         (language === 'tr' ? 'Çocuk' : 'Kids');
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setProfileContentPreferences(selected
                              ? profileContentPreferences.filter(item => item !== option.id)
                              : [...profileContentPreferences, option.id]
                            )}
                            className={`h-9 rounded-xl border text-[9px] font-black transition-all ${selected ? 'border-white bg-white text-black' : 'border-white/7 bg-black/25 text-neutral-500 hover:border-white/20 hover:text-white'}`}
                          >
                            {optLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 w-full rounded-2xl border border-white/8 bg-white/[0.025] p-3">
                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
                      {language === 'tr' ? 'Liste güncelleme aralığı' : 'Playlist update interval'}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { value: 6, label: language === 'tr' ? '6 Saat' : '6 Hours' },
                        { value: 12, label: language === 'tr' ? '12 Saat' : '12 Hours' },
                        { value: 24, label: language === 'tr' ? '1 Gün' : '1 Day' },
                        { value: 168, label: language === 'tr' ? '7 Gün' : '7 Days' }
                      ].map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setProfileAutoUpdateIntervalHours(option.value as 6 | 12 | 24 | 168)}
                          className={`h-10 rounded-xl border text-[10px] font-black transition-all cursor-pointer ${
                            profileAutoUpdateIntervalHours === option.value
                              ? 'border-white bg-white text-black'
                              : 'border-white/7 bg-black/25 text-neutral-400 hover:border-white/18 hover:bg-white/[0.04] hover:text-white'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <span className="text-[10px] leading-relaxed text-neutral-600">
                      {language === 'tr' ? 'Süresi dolduğunda liste arka planda güncellenir.' : 'The playlist is updated in the background when the period expires.'}
                    </span>
                  </div>
                </div>
                <div className={`hidden md:block w-[1px] bg-white/5 self-stretch transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${
                  isAvatarPickerOpen ? 'mx-6 opacity-100' : 'mx-0 w-0 opacity-0'
                }`} />
                <div className={`flex flex-col gap-4 overflow-hidden transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${
                  isAvatarPickerOpen
                    ? 'flex-1 max-w-4xl xl:max-w-5xl opacity-100 translate-x-0'
                    : 'w-0 max-w-0 opacity-0 pointer-events-none translate-x-8 h-0'
                }`}>
                  <div className="flex items-center justify-between shrink-0">
                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
                      {language === 'tr' ? 'Profil Resmi Seç' : 'Select Profile Picture'}
                    </label>
                    <span className="text-[9px] text-neutral-600 font-semibold">
                      {language === 'tr' ? 'Dizi, film veya oyuncu görseli' : 'Series, movie or actor image'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3 w-full min-w-[320px] md:min-w-[480px]">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600" />
                        <input
                          type="text"
                          placeholder={language === 'tr' ? "TMDB'den oyuncu, film veya dizi ara..." : "Search actors, movies or series from TMDB..."}
                          value={avatarSearchQuery}
                          onChange={(e) => {
                            setAvatarSearchQuery(e.target.value);
                            if (!e.target.value.trim()) {
                              setAvatarSearchResults([]);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') onAvatarSearch(avatarSearchQuery);
                          }}
                          className="w-full h-11 pl-10 pr-3.5 rounded-2xl bg-white/[0.025] border border-white/8 text-xs outline-none text-white placeholder-neutral-600 focus:border-white/25 transition-all font-medium"
                        />
                      </div>
                      <button
                        onClick={() => onAvatarSearch(avatarSearchQuery)}
                        disabled={avatarSearchLoading}
                        className="h-11 px-5 rounded-2xl bg-white hover:bg-neutral-200 disabled:bg-white/20 text-black text-[10px] font-black uppercase transition-all duration-200 shrink-0 cursor-pointer flex items-center justify-center"
                      >
                        {avatarSearchLoading ? (language === 'tr' ? 'Aranıyor...' : 'Searching...') : (language === 'tr' ? 'Ara' : 'Search')}
                      </button>
                    </div>
                    <div className="flex flex-col gap-2.5 mt-1">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
                          {selectedSeriesForCast
                            ? (language === 'tr' ? `Dizi Oyuncuları: ${selectedSeriesForCast.name}` : `Series Cast: ${selectedSeriesForCast.name}`)
                            : avatarSearchResults.length > 0
                              ? (language === 'tr' ? 'Arama Sonuçları' : 'Search Results')
                              : (language === 'tr' ? 'Yerli Diziler (Oyuncu seçmek için tıklayın)' : 'Local Series (Click to choose actor)')}
                        </span>
                        {selectedSeriesForCast && (
                          <button
                            onClick={() => {
                              setSelectedSeriesForCast(null);
                              setSeriesCast([]);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[9px] font-black text-neutral-300 hover:text-white uppercase transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <ChevronLeft size={10} /> {avatarSearchResults.length > 0 ? (language === 'tr' ? 'Aramaya Dön' : 'Back to Search') : (language === 'tr' ? 'Dizilere Dön' : 'Back to Series')}
                          </button>
                        )}
                      </div>

                      {avatarSearchLoading || castLoading ? (
                        <div className="h-[440px] border border-white/5 rounded-2xl flex items-center justify-center bg-black/40 animate-fade-in">
                          <div className="relative w-8 h-8">
                            <div className="absolute inset-0 rounded-full border-2 border-white/5" />
                            <div className="absolute inset-0 rounded-full border-2 border-t-[var(--accent-color)] animate-spin" />
                          </div>
                        </div>
                      ) : (
                        renderAvatarSelectorContent()
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 border-t border-white/6 pt-4 mt-0">
                {profileSelectMode === 'edit' && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4.5 h-11 bg-red-950/40 hover:bg-red-900/40 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer shrink-0"
                    title={language === 'tr' ? 'Profili Sil' : 'Delete Profile'}
                  >
                    <Trash2 size={13} fill="none" className="text-red-400" /> {language === 'tr' ? 'Sil' : 'Delete'}
                  </button>
                )}

                <button
                  onClick={() => {
                    setProfileSelectMode(editingProfileId ? 'manage' : 'select');
                    setEditingProfileId(null);
                    setIsAvatarPickerOpen(false);
                  }}
                  className="flex-1 h-11 rounded-2xl border border-white/10 hover:border-white/20 hover:bg-white/[0.035] text-xs font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer"
                >
                  {language === 'tr' ? 'Vazgeç' : 'Cancel'}
                </button>

                <button
                  onClick={onSaveProfile}
                  disabled={isParsing}
                  className="flex-1 h-11 rounded-2xl bg-white hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-400 disabled:cursor-wait text-black text-xs font-black tracking-wider uppercase transition-all duration-200 cursor-pointer shadow-[0_14px_38px_rgba(255,255,255,0.10)] flex items-center justify-center gap-2"
                >
                  {isParsing && <LoaderCircle size={14} className="animate-spin" />}
                  {isParsing ? (language === 'tr' ? 'Hazırlanıyor' : 'Preparing...') : (profileSelectMode === 'edit' ? t('common.save') : (language === 'tr' ? 'Kaydet ve İzle' : 'Save & Watch'))}
                </button>
              </div>
            </div>
          </div>
        )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 select-none animate-fade-in">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setShowDeleteConfirm(false)} />
          
          <div className="relative w-full max-w-md transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] bg-[#070709]/95 border border-white/10 rounded-[32px] p-6 md:p-8 flex flex-col items-center text-center shadow-[0_36px_130px_rgba(0,0,0,0.8)] z-10 overflow-hidden">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-red-500/35 to-transparent pointer-events-none" />
            <div className="absolute -top-24 -right-20 w-56 h-56 rounded-full bg-red-500/5 blur-3xl pointer-events-none" />
            
            <div className="w-14 h-14 rounded-2xl bg-red-950/20 border border-red-500/20 flex items-center justify-center text-red-500 shadow-[0_12px_30px_rgba(239,68,68,0.1)] mb-5 animate-pulse">
              <Trash2 size={24} className="text-red-400" />
            </div>

            <h3 className="text-lg font-black text-white tracking-tight">{t('profiles.deleteProfileTitle')}</h3>
            <p className="mt-3 text-xs md:text-sm text-neutral-400 leading-relaxed">
              {language === 'tr' ? (
                <>
                  <strong className="text-white">"{profileFormName}"</strong> profilini ve bu profile ait tüm kişisel verileri (geçmiş, favoriler, playlistler) silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                </>
              ) : (
                <>
                  Are you sure you want to delete <strong className="text-white">"{profileFormName}"</strong> and all personal data associated with it (history, favorites, playlists)? This action cannot be undone.
                </>
              )}
            </p>

            <div className="mt-7 flex gap-3 w-full">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-11 rounded-2xl border border-white/10 hover:border-white/20 hover:bg-white/[0.035] text-xs font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer text-white hover:text-white"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-xs font-black tracking-wider uppercase transition-all duration-200 cursor-pointer shadow-[0_14px_38px_rgba(239,68,68,0.15)] flex items-center justify-center gap-2"
              >
                {language === 'tr' ? 'Evet, Sil' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
