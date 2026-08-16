import { ChevronLeft, LoaderCircle, Pencil, Search, Trash2, UserRound, X } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { ProfileAvatarGrid } from './ProfileAvatarGrid';
import { contentPreferenceIds, getPreferenceLabel } from './profileScreenTypes';
import type { ProfileScreenProps } from './profileScreenTypes';

interface Props {
  screenProps: ProfileScreenProps;
  isAvatarPickerOpen: boolean;
  onAvatarPickerOpenChange: (open: boolean) => void;
  onClose: () => void;
  onDeleteRequest: () => void;
}

export function EditProfileDialog({ screenProps, isAvatarPickerOpen, onAvatarPickerOpenChange, onClose, onDeleteRequest }: Props) {
  const { t, language } = useSettings();
  const {
    avatarSearchLoading, avatarSearchQuery, avatarSearchResults, castLoading,
    isParsing, localSeries, onAvatarSearch, onFetchSeriesCast, onSaveProfile,
    profileAutoUpdateIntervalHours, profileContentPreferences, profileFormAvatar,
    profileFormName, selectedSeriesForCast, seriesCast, setAvatarSearchQuery,
    setAvatarSearchResults, setProfileAutoUpdateIntervalHours,
    setProfileContentPreferences, setProfileFormAvatar, setProfileFormName,
    setSelectedSeriesForCast, setSeriesCast,
  } = screenProps;
  return (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 select-none page-transition-enter">
            <button type="button" aria-label={t('common.cancel')} className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

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
                      {language === 'tr' ? 'Profil Ayarları' : 'Profile Settings'}
                    </span>
                    <h3 className="mt-0.5 text-xl font-black text-white tracking-tight">
                      {language === 'tr' ? 'Profili Düzenle' : 'Edit Profile'}
                    </h3>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {language === 'tr' ? 'İsim, avatar ve içerik tercihlerini güncelle.' : 'Update name, avatar, and content preferences.'}
                    </p>
                  </div>
                </div>
                <button type="button"
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/8 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
                 aria-label="Close">
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
                    <button type="button"
                      onClick={() => onAvatarPickerOpenChange(!isAvatarPickerOpen)}
                      className="relative w-24 h-24 md:w-28 md:h-28 rounded-[28px] p-1.5 border border-white/12 hover:border-white/35 bg-white/[0.04] shadow-[0_22px_70px_rgba(0,0,0,0.42)] overflow-hidden transition-all duration-300 hover:scale-[1.025] active:scale-[0.98] cursor-pointer block"
                      title={language === 'tr' ? 'Profil resmi seç / değiştir' : 'Select / change profile picture'}
                     aria-label={language === 'tr' ? 'Profil resmi seç / değiştir' : 'Select / change profile picture'}>
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
                    <button type="button"
                      onClick={() => onAvatarPickerOpenChange(!isAvatarPickerOpen)}
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
                      {contentPreferenceIds.map(preference => {
                        const selected = profileContentPreferences.includes(preference);
                        const optLabel = getPreferenceLabel(preference, language);
                        return (
                          <button
                            key={preference}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setProfileContentPreferences(selected
                              ? profileContentPreferences.filter(item => item !== preference)
                              : [...profileContentPreferences, preference]
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
                      {t('profiles.messages.playlistRefreshInBackground')}
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
                      <button type="button"
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
                          <button type="button"
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
                        <ProfileAvatarGrid
                          avatarSearchResults={avatarSearchResults}
                          emptyLocalSeriesMessage={t('profiles.messages.localSeriesLoadFailed')}
                          language={language}
                          localSeries={localSeries}
                          onFetchSeriesCast={onFetchSeriesCast}
                          onSelectAvatar={setProfileFormAvatar}
                          profileFormAvatar={profileFormAvatar}
                          selectedSeriesForCast={selectedSeriesForCast}
                          seriesCast={seriesCast}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 border-t border-white/6 pt-4 mt-0">
                <button type="button"
                    onClick={onDeleteRequest}
                    className="px-4.5 h-11 bg-red-950/40 hover:bg-red-900/40 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer shrink-0"
                    title={language === 'tr' ? 'Profili Sil' : 'Delete Profile'}
                   aria-label={language === 'tr' ? 'Profili Sil' : 'Delete Profile'}>
                    <Trash2 size={13} fill="none" className="text-red-400" /> {language === 'tr' ? 'Sil' : 'Delete'}
                </button>

                <button type="button"
                  onClick={onClose}
                  className="flex-1 h-11 rounded-2xl border border-white/10 hover:border-white/20 hover:bg-white/[0.035] text-xs font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer"
                >
                  {language === 'tr' ? 'Vazgeç' : 'Cancel'}
                </button>

                <button type="button"
                  onClick={onSaveProfile}
                  disabled={isParsing}
                  className="flex-1 h-11 rounded-2xl bg-white hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-400 disabled:cursor-wait text-black text-xs font-black tracking-wider uppercase transition-all duration-200 cursor-pointer shadow-[0_14px_38px_rgba(255,255,255,0.10)] flex items-center justify-center gap-2"
                >
                  {isParsing && <LoaderCircle size={14} className="animate-spin" />}
                  {isParsing ? (language === 'tr' ? 'Hazırlanıyor' : 'Preparing...') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
  );
}
