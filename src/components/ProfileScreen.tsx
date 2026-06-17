import React, { useState } from 'react';
import { Plus, X, Trash2, ChevronLeft, Pencil, UserRound, Clock3, Link2, Server, Search } from 'lucide-react';
import type { Profile, AvatarSearchResult } from '../types';

interface LocalSeries {
  id: number;
  name: string;
  posterUrl: string;
}

interface SeriesCast {
  name: string;
  avatarUrl: string;
}

interface ProfileScreenProps {
  profiles: Profile[];
  profileSelectMode: 'select' | 'manage' | 'create' | 'edit';
  profileFormName: string;
  profileFormAvatar: string;
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
  toast: { show: boolean; message: string };
  activeTheme: string;
  accentStyles: React.CSSProperties;
  setProfileSelectMode: (mode: 'select' | 'manage' | 'create' | 'edit') => void;
  setProfileFormName: (name: string) => void;
  setProfileFormAvatar: (avatar: string) => void;
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
  onSelectProfile: (id: string) => void;
  onSaveProfile: () => void;
  onDeleteProfile: (id: string) => void;
  onAvatarSearch: (query: string) => void;
  onFetchSeriesCast: (id: number, name: string, mediaType: 'movie' | 'tv') => void;
}

export const ProfileScreen = (props: ProfileScreenProps) => {
  const {
    profiles, profileSelectMode, profileFormName, profileFormAvatar,
    editingProfileId, profilePlaylistType, profileM3uUrl, profileXtreamUrl,
    profileXtreamUser, profileXtreamPass, profileAutoUpdateIntervalHours, avatarSearchQuery, avatarSearchResults,
    avatarSearchLoading, trendingAvatars, localSeries, selectedSeriesForCast,
    seriesCast, castLoading, isParsing, toast, activeTheme, accentStyles,
    setProfileSelectMode, setProfileFormName, setProfileFormAvatar,
    setEditingProfileId, setProfilePlaylistType, setProfileM3uUrl,
    setProfileXtreamUrl, setProfileXtreamUser, setProfileXtreamPass, setProfileAutoUpdateIntervalHours,
    setAvatarSearchQuery, setAvatarSearchResults, setSelectedSeriesForCast,
    setSeriesCast, onSelectProfile, onSaveProfile, onDeleteProfile,
    onAvatarSearch, onFetchSeriesCast
  } = props;

  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  const renderAvatarSelectorContent = () => {
    if (selectedSeriesForCast) {
      if (seriesCast.length === 0) {
        return (
          <div className="h-[440px] border border-dashed border-white/5 rounded-2xl flex items-center justify-center bg-black/40 text-neutral-500 text-xs animate-fade-in">
            Diziye ait oyuncu görseli bulunamadı.
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
          Yerli dizi listesi yüklenemedi. TMDB bağlantısını kontrol edin.
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
    >
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_24%_18%,rgba(255,255,255,0.07),transparent_30%),radial-gradient(circle_at_82%_72%,rgba(255,255,255,0.045),transparent_32%),linear-gradient(135deg,#050507_0%,#101116_45%,#030304_100%)]" />
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.035] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:72px_72px]" />
      <div className="absolute inset-x-0 bottom-0 z-0 h-56 pointer-events-none bg-gradient-to-t from-black via-black/70 to-transparent" />
      {isParsing && (
        <div className="fixed inset-0 z-[4000] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4 animate-fade-in select-none">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-white/5" />
            <div className="absolute inset-0 rounded-full border-4 border-t-[var(--accent-color)] animate-spin shadow-[0_0_15px_var(--accent-glow)]" />
          </div>
          <span className="text-sm font-semibold tracking-wide text-neutral-300">İçerikler Yükleniyor...</span>
        </div>
      )}
      {toast.show && (
        <div className="fixed top-6 right-6 z-[5000] px-5 py-3.5 bg-neutral-950/80 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center gap-3.5 shadow-2xl max-w-sm animate-scale-in">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-color)] animate-ping" />
          <span className="text-xs font-semibold text-neutral-200 tracking-wide">{toast.message}</span>
        </div>
      )}

      <div className="flex-1 z-10 overflow-y-auto hide-scrollbar select-none animate-fade-in w-full">
        <div className="min-h-full w-full max-w-[1320px] mx-auto px-6 md:px-10 py-10 md:py-14 flex items-center">
          <div className="w-full grid grid-cols-1 lg:grid-cols-[0.95fr_1.35fr] gap-8 lg:gap-12 items-center">
            <section className="flex flex-col gap-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center shadow-[0_18px_50px_rgba(255,255,255,0.12)]">
                  <img src="./icon.png" className="w-9 h-9 object-contain" alt="Strmly Logo" />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-none">STRMLY</h1>
                </div>
              </div>

              <div className="max-w-xl flex flex-col gap-4">
                <h2 className="text-2xl md:text-4xl font-black tracking-tight text-white leading-tight">
                  İzlemeye kaldığın yerden devam et.
                </h2>
                <p className="text-sm text-neutral-400 leading-relaxed max-w-md">
                  {profileSelectMode === 'manage'
                    ? 'Düzenlemek istediğin profili seç. Her profil kendi liste, favori ve izleme geçmişini korur.'
                    : 'Profilini seç, kişisel kanal listen ve izleme geçmişinle doğrudan ana ekrana geç.'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-lg">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 backdrop-blur-md">
                  <span className="block text-lg font-black text-white">{profiles.length}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Profil</span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 backdrop-blur-md">
                  <span className="block text-lg font-black text-white">4K</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Hazır</span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 backdrop-blur-md">
                  <span className="block text-lg font-black text-white">VOD</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Destek</span>
                </div>
              </div>
            </section>

            <section className="relative rounded-[28px] border border-white/10 bg-black/35 backdrop-blur-2xl shadow-[0_28px_90px_rgba(0,0,0,0.45)] p-5 md:p-7 overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-white tracking-tight">
                    {profileSelectMode === 'manage' ? 'Profilleri Yönet' : 'Profil Seç'}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    {profileSelectMode === 'manage' ? 'Düzenlemek için bir kart seç.' : 'Başlamak için bir profil kartına tıkla.'}
                  </p>
                </div>
                {profileSelectMode === 'select' ? (
                  <button
                    onClick={() => setProfileSelectMode('manage')}
                    className="h-10 px-4 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/10 text-[10px] font-black text-neutral-300 hover:text-white tracking-widest uppercase transition-all"
                  >
                    Yönet
                  </button>
                ) : (
                  <button
                    onClick={() => setProfileSelectMode('select')}
                    className="h-10 px-5 rounded-xl bg-white hover:bg-neutral-200 text-black text-[10px] font-black tracking-widest uppercase transition-all"
                  >
                    Tamam
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                {profiles.map(profile => {
                  const isGradient = profile.avatarUrl.startsWith('linear-gradient');
                  return (
                    <button
                      key={profile.id}
                      onClick={() => {
                        if (profileSelectMode === 'manage') {
                          setEditingProfileId(profile.id);
                          setProfileFormName(profile.name);
                          setProfileFormAvatar(profile.avatarUrl);
                          setProfileAutoUpdateIntervalHours(profile.autoUpdateIntervalHours || 24);
                          setProfileSelectMode('edit');
                          setIsAvatarPickerOpen(false);
                        } else {
                          onSelectProfile(profile.id);
                        }
                      }}
                      className="group text-left rounded-3xl border border-white/8 bg-white/[0.035] hover:bg-white/[0.07] hover:border-white/20 p-3.5 transition-all duration-300 hover:-translate-y-1 shadow-[0_14px_40px_rgba(0,0,0,0.28)]"
                    >
                      <div className="relative aspect-square rounded-2xl overflow-hidden bg-neutral-950 border border-white/10">
                        {isGradient ? (
                          <div className="w-full h-full" style={{ background: profile.avatarUrl }} />
                        ) : (
                          <img src={profile.avatarUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={profile.name} />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
                        {profileSelectMode === 'manage' && (
                          <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/65 border border-white/15 backdrop-blur-md flex items-center justify-center text-white">
                            <Pencil size={13} />
                          </div>
                        )}
                      </div>
                      <div className="pt-3 flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-black text-white">{profile.name}</span>
                        <ChevronLeft size={14} className="rotate-180 text-neutral-500 group-hover:text-white transition-colors" />
                      </div>
                    </button>
                  );
                })}

                {profiles.length < 5 && profileSelectMode === 'select' && (
                  <button
                    onClick={() => {
                      setProfileFormName('');
                      setProfileFormAvatar(trendingAvatars[profiles.length % trendingAvatars.length] || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=185');
                      setProfilePlaylistType('none');
                      setProfileAutoUpdateIntervalHours(24);
                      setEditingProfileId(null);
                      setProfileSelectMode('create');
                      setIsAvatarPickerOpen(false);
                    }}
                    className="group rounded-3xl border border-dashed border-white/14 bg-white/[0.025] hover:bg-white/[0.065] hover:border-white/30 p-3.5 transition-all duration-300 hover:-translate-y-1 min-h-[190px] flex flex-col justify-between overflow-hidden relative"
                  >
                    <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/[0.06] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="aspect-square rounded-2xl bg-black/35 border border-white/8 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute -left-5 top-5 w-12 h-12 rounded-2xl bg-white/[0.05] rotate-[-12deg]" />
                      <div className="absolute -right-4 bottom-5 w-14 h-14 rounded-2xl bg-white/[0.04] rotate-[10deg]" />
                      <div className="relative w-12 h-12 rounded-2xl bg-white/[0.08] group-hover:bg-white group-hover:text-black text-neutral-300 flex items-center justify-center transition-all shadow-[0_16px_45px_rgba(0,0,0,0.35)]">
                        <Plus size={22} />
                      </div>
                    </div>
                    <div className="pt-3 text-left">
                      <span className="block text-sm font-black text-neutral-300 group-hover:text-white">Profil Ekle</span>
                      <span className="block text-[10px] text-neutral-600 mt-0.5">Avatar ve liste kurulumu</span>
                    </div>
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
        {(profileSelectMode === 'create' || profileSelectMode === 'edit') && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 select-none animate-fade-in">
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
                      {profileSelectMode === 'edit' ? 'Profil Ayarları' : 'Yeni İzleme Alanı'}
                    </span>
                    <h3 className="mt-0.5 text-xl font-black text-white tracking-tight">
                      {profileSelectMode === 'edit' ? 'Profili Düzenle' : 'Profil Oluştur'}
                    </h3>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {profileSelectMode === 'edit' ? 'İsim ve avatar bilgisini güncelle.' : 'Kendi IPTV listen için temiz bir profil hazırla.'}
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
                      title="Profil resmi seç / değiştir"
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
                          <span className="text-[10px] font-black tracking-wider text-white uppercase">Değiştir</span>
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
                      {profileFormName || 'Profil Adı'}
                    </span>
                    <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-wider">
                      {isAvatarPickerOpen ? 'Avatar paneli açık' : 'Avatarı değiştirmek için görsele tıkla'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 w-full rounded-2xl border border-white/8 bg-white/[0.025] p-3">
                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">Profil Adı</label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="Profil adını girin..."
                      value={profileFormName}
                      onChange={(e) => setProfileFormName(e.target.value)}
                      className="w-full h-10 px-4 rounded-2xl bg-black/35 border border-white/8 focus:border-white/25 text-sm outline-none text-white transition-all placeholder-neutral-600 font-semibold"
                    />
                  </div>

                  <div className="flex flex-col gap-2 w-full rounded-2xl border border-white/8 bg-white/[0.025] p-3">
                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">Liste guncelleme araligi</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { value: 6, label: '6 Saat' },
                        { value: 12, label: '12 Saat' },
                        { value: 24, label: '1 Gun' },
                        { value: 168, label: '7 Gun' }
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
                      Suresi doldugunda liste arka planda guncellenir.
                    </span>
                  </div>
                  {profileSelectMode === 'create' && (
                    <div className="flex flex-col gap-3 w-full rounded-2xl border border-white/8 bg-white/[0.025] p-3">
                      <div>
                        <label className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">IPTV Kurulumu</label>
                        <p className="mt-0.5 text-[10px] text-neutral-600">Boş bırakabilirsin; listeyi sonra ayarlardan eklersin.</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { id: 'none', label: 'Sonra Ekle', icon: Clock3 },
                          { id: 'm3u', label: 'M3U Linki', icon: Link2 },
                          { id: 'xtream', label: 'Xtream', icon: Server }
                        ].map(type => (
                          <button
                            key={type.id}
                            onClick={() => setProfilePlaylistType(type.id as any)}
                            className={`h-12 rounded-2xl border px-3 py-2 text-left transition-all cursor-pointer ${
                              profilePlaylistType === type.id
                                ? 'bg-white text-black border-white shadow-[0_14px_38px_rgba(255,255,255,0.12)]'
                                : 'bg-black/25 border-white/7 text-neutral-400 hover:text-white hover:border-white/18 hover:bg-white/[0.04]'
                            }`}
                          >
                            {React.createElement(type.icon, { size: 14, className: 'mb-0.5' })}
                            <span className="block text-[10px] font-black uppercase tracking-wider">{type.label}</span>
                          </button>
                        ))}
                      </div>

                      {profilePlaylistType === 'm3u' && (
                        <div className="flex flex-col gap-2.5 animate-fade-in w-full">
                          <input
                            type="text"
                            placeholder="M3U Oynatma Listesi URL'si..."
                            value={profileM3uUrl}
                            onChange={(e) => setProfileM3uUrl(e.target.value)}
                            className="w-full h-11 px-3.5 rounded-2xl bg-black/35 border border-white/8 text-xs outline-none text-white focus:border-white/25 transition-all placeholder-neutral-600 font-medium"
                          />
                        </div>
                      )}

                      {profilePlaylistType === 'xtream' && (
                        <div className="flex flex-col gap-2 animate-fade-in w-full">
                          <input
                            type="text"
                            placeholder="Sunucu adresi"
                            value={profileXtreamUrl}
                            onChange={(e) => setProfileXtreamUrl(e.target.value)}
                            className="w-full h-11 px-3.5 rounded-2xl bg-black/35 border border-white/8 text-xs outline-none text-white focus:border-white/25 transition-all placeholder-neutral-600 font-medium"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Kullanıcı adı"
                              value={profileXtreamUser}
                              onChange={(e) => setProfileXtreamUser(e.target.value)}
                              className="w-full h-11 px-3.5 rounded-2xl bg-black/35 border border-white/8 text-xs outline-none text-white focus:border-white/25 transition-all placeholder-neutral-600 font-medium"
                            />
                            <input
                              type="password"
                              placeholder="Şifre"
                              value={profileXtreamPass}
                              onChange={(e) => setProfileXtreamPass(e.target.value)}
                              className="w-full h-11 px-3.5 rounded-2xl bg-black/35 border border-white/8 text-xs outline-none text-white focus:border-white/25 transition-all placeholder-neutral-600 font-medium"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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
                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">Profil Resmi Seç</label>
                    <span className="text-[9px] text-neutral-600 font-semibold">Dizi, film veya oyuncu görseli</span>
                  </div>
                  <div className="flex flex-col gap-3 w-full min-w-[320px] md:min-w-[480px]">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600" />
                        <input
                          type="text"
                          placeholder="TMDB'den oyuncu, film veya dizi ara..."
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
                        {avatarSearchLoading ? 'Aranıyor...' : 'Ara'}
                      </button>
                    </div>
                    <div className="flex flex-col gap-2.5 mt-1">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
                          {selectedSeriesForCast
                            ? `Dizi Oyuncuları: ${selectedSeriesForCast.name}`
                            : avatarSearchResults.length > 0
                              ? 'Arama Sonuçları'
                              : 'Yerli Diziler (Oyuncu seçmek için tıklayın)'}
                        </span>
                        {selectedSeriesForCast && (
                          <button
                            onClick={() => {
                              setSelectedSeriesForCast(null);
                              setSeriesCast([]);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[9px] font-black text-neutral-300 hover:text-white uppercase transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <ChevronLeft size={10} /> {avatarSearchResults.length > 0 ? 'Aramaya Dön' : 'Dizilere Dön'}
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
                    onClick={() => {
                      if (confirm("Bu profili ve tüm kişisel verilerini (geçmiş, favoriler, playlistler) silmek istediğinize emin misiniz?")) {
                        onDeleteProfile(editingProfileId!);
                      }
                    }}
                    className="px-4.5 h-11 bg-red-950/40 hover:bg-red-900/40 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer shrink-0"
                    title="Profili Sil"
                  >
                    <Trash2 size={13} fill="none" className="text-red-400" /> Sil
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
                  Vazgeç
                </button>

                <button
                  onClick={onSaveProfile}
                  className="flex-1 h-11 rounded-2xl bg-white hover:bg-neutral-200 text-black text-xs font-black tracking-wider uppercase transition-all duration-200 cursor-pointer shadow-[0_14px_38px_rgba(255,255,255,0.10)]"
                >
                  {profileSelectMode === 'edit' ? 'Kaydet' : 'Kaydet ve İzle'}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
