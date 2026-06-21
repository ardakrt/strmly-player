import { Tv, Search, ArrowLeft, Settings } from 'lucide-react';
import type { Profile, SavedPlaylist } from '../types';
import type { PlaylistItem } from '../utils/m3uParser';
import { useSettings } from '../context/SettingsContext';

interface NavbarProps {
  loaded: boolean;
  scrolled: boolean;
  selectedGroup: string;
  setSelectedGroup: (group: string) => void;
  setSearchInput: (val: string) => void;
  setSearchQuery: (val: string) => void;
  setShowSpotlight: (show: boolean) => void;
  setSpotlightScope: (scope: 'all' | 'live' | 'movie' | 'series') => void;
  profileDropdownOpen: boolean;
  setProfileDropdownOpen: (open: boolean) => void;
  currentProfile: Profile | undefined;
  isCurrentProfileGradient: boolean;
  items: PlaylistItem[];
  playlists: SavedPlaylist[];
  activePlaylistId: string;
  profiles: Profile[];
  handleSelectProfile: (id: string) => void;
  handleLogoutProfile: () => void;
  updateAvailable?: boolean;
}

export function Navbar({
  loaded,
  scrolled,
  selectedGroup,
  setSelectedGroup,
  setSearchInput,
  setSearchQuery,
  setShowSpotlight,
  setSpotlightScope,
  profileDropdownOpen,
  setProfileDropdownOpen,
  currentProfile,
  isCurrentProfileGradient,
  items,
  playlists,
  activePlaylistId,
  profiles,
  handleSelectProfile,
  handleLogoutProfile,
  updateAvailable
}: NavbarProps) {
  const { setActiveSettingsTab, t, language } = useSettings();
  if (!loaded) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled 
        ? 'pt-3 px-4' 
        : 'pt-6 px-6 md:px-10'
    }`}>
      <nav className={`mx-auto flex items-center justify-between transition-all duration-500 ease-in-out ${
        scrolled
          ? 'w-[95%] lg:w-[90%] max-w-[1000px] h-12 bg-neutral-950/45 backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.5)] rounded-full px-5'
          : 'w-full max-w-[1400px] h-14 bg-transparent border border-transparent shadow-none px-6'
      }`}>
        <div className="flex items-center h-full">
          <div
            className="flex items-center gap-2.5 group cursor-pointer"
            onClick={() => { setSelectedGroup('Ana Sayfa'); setSearchInput(''); setSearchQuery(''); }}
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.08] border border-white/15 shadow-inner transform group-hover:scale-105 group-hover:bg-white/12 transition-all duration-300">
              <Tv size={14} className="text-white opacity-90 group-hover:opacity-100" />
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-extrabold tracking-wide text-white leading-none">STRMLY</span>
            </div>
          </div>
          <div className="flex items-center h-full px-6 gap-2">
            {[
              { id: 'Ana Sayfa', label: t('navbar.home') },
              { id: 'Canlı TV', label: t('navbar.liveTv') },
              { id: 'Sinema', label: t('navbar.movies') },
              { id: 'Diziler', label: t('navbar.series') },
              { id: 'Favorilerim', label: t('navbar.favorites') }
            ].map(link => {
              const isActive = selectedGroup === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => {
                    setSelectedGroup(link.id);
                    setSearchInput('');
                    setSearchQuery('');
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${isActive
                      ? 'text-white font-extrabold'
                      : 'text-neutral-400 hover:text-white'
                    }`}
                >
                  {link.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3 pr-1 relative">
          <div className="relative flex items-center">
            <button
              onClick={() => { setShowSpotlight(true); setSpotlightScope('all'); }}
              className={`bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-full flex items-center px-3.5 w-40 lg:w-52 transition-all duration-300 group text-left cursor-pointer ${
                scrolled ? 'h-8' : 'h-9'
              }`}
              title={t('navbar.searchTitle')}
            >
              <Search size={13} className="text-neutral-500 group-hover:text-white transition-colors duration-300" />
              <span className="text-[11px] text-neutral-400 group-hover:text-white transition-colors ml-2 select-none truncate flex-1">
                {t('navbar.searchPlaceholder')}
              </span>
              <div className="hidden md:flex items-center px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[8px] font-bold text-neutral-500 group-hover:text-neutral-400 group-hover:border-white/20 transition-all select-none">
                Ctrl K
              </div>
            </button>
          </div>
          <div className="relative">
            <button
              className={`rounded-full bg-white/[0.04] hover:bg-white/[0.08] border flex items-center gap-2 transition-all duration-300 cursor-pointer ${
                updateAvailable
                  ? 'border-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse-green'
                  : (profileDropdownOpen ? 'border-white/20 bg-white/[0.08]' : 'border-white/10')
              } ${
                scrolled ? 'h-8 pl-1 pr-3' : 'h-9 pl-1 pr-3.5'
              }`}
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            >
              <div className="relative">
                <div className={`rounded-full overflow-hidden border border-white/15 flex items-center justify-center shadow-md bg-white/[0.06] transition-all duration-300 ${
                  scrolled ? 'w-6 h-6' : 'w-7 h-7'
                }`}>
                  {currentProfile ? (
                    isCurrentProfileGradient ? (
                      <div className="w-full h-full" style={{ background: currentProfile.avatarUrl }} />
                    ) : (
                      <img src={currentProfile.avatarUrl} className="w-full h-full object-cover" />
                    )
                  ) : (
                    <span className="text-[9px] font-black text-white/80 tracking-wider">VIP</span>
                  )}
                </div>
                {updateAvailable && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 z-10">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-neutral-950"></span>
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold text-neutral-300">
                {currentProfile ? currentProfile.name : t('navbar.user')}
              </span>
            </button>

            {profileDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileDropdownOpen(false)} />
                <div className={`absolute right-0 mt-2 w-60 bg-neutral-950/85 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-scale-in ${
                  scrolled ? 'top-10' : 'top-11'
                }`}>
                  <div className="p-3.5 border-b border-white/5 flex items-center gap-3 bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center shadow-lg bg-white/[0.06]">
                      {currentProfile ? (
                        isCurrentProfileGradient ? (
                          <div className="w-full h-full" style={{ background: currentProfile.avatarUrl }} />
                        ) : (
                          <img src={currentProfile.avatarUrl} className="w-full h-full object-cover" />
                        )
                      ) : (
                        <span className="text-[9px] font-black text-white/80">VIP</span>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-white truncate">
                        {currentProfile ? currentProfile.name : `Strmly ${t('navbar.user')}`}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 border-b border-white/5 flex flex-col gap-1.5 bg-black/20 text-left">
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>{t('navbar.installedChannels')}</span>
                      <span className="font-bold text-white">{t('navbar.itemsCount').replace('{{count}}', String(items.length))}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>{t('navbar.savedPlaylists')}</span>
                      <span className="font-bold text-white">{t('navbar.playlistsCount').replace('{{count}}', String(playlists.length))}</span>
                    </div>
                    {playlists.length > 0 && (
                      <div className="flex items-center justify-between text-[10px] text-neutral-400">
                        <span>{t('navbar.activePlaylist')}</span>
                        <span className="font-bold text-white/70 truncate max-w-[110px]" title={playlists.find(p => p.id === activePlaylistId)?.name || (language === 'tr' ? 'Yok' : 'None')}>
                          {playlists.find(p => p.id === activePlaylistId)?.name || (language === 'tr' ? 'Yok' : 'None')}
                        </span>
                      </div>
                    )}
                  </div>
                  {profiles.filter(p => p.id !== currentProfile?.id).length > 0 && (
                    <div className="p-2 border-b border-white/5 flex flex-col gap-1 max-h-[160px] overflow-y-auto hide-scrollbar text-left">
                      <span className="text-[8px] font-extrabold text-neutral-500 uppercase tracking-wider px-2 py-1 select-none">{t('navbar.otherProfiles')}</span>
                      {profiles.filter(p => p.id !== currentProfile?.id).map(prof => {
                        const isProfGradient = prof.avatarUrl.startsWith('linear-gradient');
                        return (
                          <button
                            key={prof.id}
                            onClick={() => {
                              setProfileDropdownOpen(false);
                              handleSelectProfile(prof.id);
                            }}
                            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all text-left cursor-pointer"
                          >
                            <div className="w-6 h-6 rounded-md overflow-hidden border border-white/5 flex items-center justify-center bg-white/[0.03] shrink-0">
                              {isProfGradient ? (
                                <div className="w-full h-full" style={{ background: prof.avatarUrl }} />
                              ) : (
                                <img src={prof.avatarUrl} className="w-full h-full object-cover" />
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-neutral-400 hover:text-white truncate flex-1">{prof.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="p-1.5 flex flex-col gap-0.5 text-left">
                    {updateAvailable && (
                      <button
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all text-[11px] font-bold cursor-pointer mb-1"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setSelectedGroup('Ayarlar');
                          setActiveSettingsTab('about');
                        }}
                      >
                        <span className="flex h-2 w-2 relative shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        {t('navbar.updateAvailable')}
                      </button>
                    )}
                    <button
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-all text-[11px] text-neutral-300 hover:text-white cursor-pointer"
                      onClick={() => { setProfileDropdownOpen(false); handleLogoutProfile(); }}
                    >
                      <ArrowLeft size={13} className="text-neutral-400 rotate-180" /> {t('navbar.changeProfile')}
                    </button>
                    <button
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-all text-[11px] text-neutral-300 hover:text-white cursor-pointer"
                      onClick={() => { setProfileDropdownOpen(false); setSelectedGroup('Ayarlar'); }}
                    >
                      <Settings size={13} className="text-neutral-400" /> {t('navbar.advancedSettings')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}
