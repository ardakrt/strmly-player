import { memo } from 'react';
import { Search, ArrowLeft, Settings, ChevronDown } from 'lucide-react';
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

export const Navbar = memo(function Navbar({
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
  profiles,
  handleSelectProfile,
  handleLogoutProfile
}: NavbarProps) {
  const { t, language } = useSettings();
  if (!loaded) return null;

  return (
    <div className={`pointer-events-none fixed top-0 left-0 right-0 z-50 px-3 sm:px-5 lg:px-8 transition-[padding] duration-300 ${
      scrolled ? 'pt-2.5' : 'pt-4'
    }`}>
      <nav
        aria-label="Ana navigasyon"
        className={`pointer-events-auto navbar-liquid-glass mx-auto flex w-full items-center justify-between gap-2 px-2.5 sm:px-3 transition-[max-width,height,background-color,border-color,box-shadow,backdrop-filter] duration-500 ease-in-out rounded-full ${
          scrolled
            ? 'navbar-liquid-glass--scrolled h-11 max-w-[1040px]'
            : 'h-12 max-w-[1180px]'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center h-full">
          <button
            type="button"
            aria-label={t('navbar.home')}
            className="flex shrink-0 items-center group cursor-pointer focusable-item rounded-full px-2 sm:px-3"
            onClick={() => { setSelectedGroup('Ana Sayfa'); setSearchInput(''); setSearchQuery(''); }}
          >
            <span className="text-[14px] font-black tracking-[-0.015em] text-white leading-none transition-opacity duration-200 group-hover:opacity-80">Strmly</span>
          </button>

          <div className="hide-scrollbar flex min-w-0 flex-1 items-center h-full gap-0.5 overflow-x-auto px-1 sm:ml-1 sm:px-2">
            {[
              { id: 'Ana Sayfa', label: t('navbar.home') },
              { id: 'Canlı TV', label: t('navbar.liveTv') },
              { id: 'Sinema', label: t('navbar.movies') },
              { id: 'Diziler', label: t('navbar.series') },
              { id: 'Favorilerim', label: t('navbar.favorites') },
              { id: 'İndirilenler', label: language === 'tr' ? 'Kaydedilenler' : 'Saved' }
            ].map(link => {
              const isActive = selectedGroup === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    setSelectedGroup(link.id);
                    setSearchInput('');
                    setSearchQuery('');
                  }}
                  className={`navbar-nav-item relative shrink-0 px-3 sm:px-3.5 py-1.5 rounded-full border text-[10px] sm:text-[11px] font-bold transition-all duration-200 cursor-pointer focusable-item ${isActive
                      ? 'text-white bg-white/[0.09] border-white/[0.10] shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]'
                      : 'text-neutral-400 border-transparent hover:text-white hover:bg-white/[0.045]'
                    }`}
                >
                  {link.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 relative">
          <div className="relative hidden md:flex items-center">
            <button
              type="button"
              aria-label={t('navbar.searchTitle')}
              onClick={() => { setShowSpotlight(true); setSpotlightScope('all'); }}
              className="h-8 w-44 lg:w-56 xl:w-64 bg-white/[0.07] hover:bg-white/[0.10] border border-white/[0.10] hover:border-white/[0.16] rounded-full flex items-center px-3 transition-all duration-200 group text-left cursor-pointer focusable-item"
              title={t('navbar.searchTitle')}
            >
              <Search size={14} className="text-neutral-500 group-hover:text-neutral-200 transition-colors duration-200" />
              <span className="text-[11px] text-neutral-400 group-hover:text-neutral-200 transition-colors ml-2 select-none truncate flex-1">
                {t('navbar.searchPlaceholder')}
              </span>
              <div className="hidden lg:flex items-center px-1.5 py-0.5 rounded-md bg-white/[0.045] border border-white/[0.08] text-[8px] font-bold text-neutral-500 group-hover:text-neutral-300 group-hover:border-white/15 transition-all select-none">
                Ctrl K
              </div>
            </button>
          </div>
          <div className="relative">
            <button
              type="button"
              aria-expanded={profileDropdownOpen}
              className={`h-9 rounded-full bg-white/[0.07] hover:bg-white/[0.10] border flex items-center gap-2 pl-1 pr-3 transition-all duration-200 cursor-pointer focusable-item ${
                profileDropdownOpen ? 'border-white/20 bg-white/[0.11]' : 'border-white/10'
              }`}
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            >
              <div className="relative">
                <div className="w-7 h-7 rounded-full overflow-hidden border border-white/15 flex items-center justify-center shadow-md bg-white/[0.06] transition-all duration-200">
                  {currentProfile ? (
                    isCurrentProfileGradient ? (
                      <div className="w-full h-full" style={{ background: currentProfile.avatarUrl }} />
                    ) : (
                      <img src={currentProfile.avatarUrl} alt="" className="w-full h-full object-cover" />
                    )
                  ) : (
                    <span className="text-[10px] font-black text-white/80 tracking-wider">VIP</span>
                  )}
                </div>
              </div>
              <span className="hidden lg:block max-w-26 truncate text-[11.5px] font-semibold text-neutral-300">
                {currentProfile ? currentProfile.name : t('navbar.user')}
              </span>
              <ChevronDown size={12} className={`hidden lg:block text-neutral-500 transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180 text-neutral-200' : ''}`} />
            </button>

            {profileDropdownOpen && (
              <>
                <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (() => setProfileDropdownOpen(false))(); } }} tabIndex={0} role="button" className="fixed inset-0 z-40" onClick={() => setProfileDropdownOpen(false)} />
                <div className="absolute right-0 top-11 mt-2 w-60 bg-neutral-950/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.6)] overflow-hidden z-50 animate-scale-in">
                  <div className="p-3.5 border-b border-white/5 flex items-center gap-3 bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center shadow-lg bg-white/[0.06]">
                      {currentProfile ? (
                        isCurrentProfileGradient ? (
                          <div className="w-full h-full" style={{ background: currentProfile.avatarUrl }} />
                        ) : (
                        <img src={currentProfile.avatarUrl} alt="" className="w-full h-full object-cover" />
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

                  {profiles.filter(p => p.id !== currentProfile?.id).length > 0 && (
                    <div className="p-2 border-b border-white/5 flex flex-col gap-1 max-h-[160px] overflow-y-auto hide-scrollbar text-left">
                      <span className="text-[8px] font-extrabold text-neutral-500 uppercase tracking-wider px-2 py-1 select-none">{t('navbar.otherProfiles')}</span>
                      {profiles.filter(p => p.id !== currentProfile?.id).map(prof => {
                        const isProfGradient = prof.avatarUrl.startsWith('linear-gradient');
                        return (
                          <button type="button"
                            key={prof.id}
                            onClick={() => {
                              setProfileDropdownOpen(false);
                              handleSelectProfile(prof.id);
                            }}
                            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all text-left cursor-pointer focusable-item"
                          >
                            <div className="w-6 h-6 rounded-md overflow-hidden border border-white/5 flex items-center justify-center bg-white/[0.03] shrink-0">
                              {isProfGradient ? (
                                <div className="w-full h-full" style={{ background: prof.avatarUrl }} />
                              ) : (
                                <img src={prof.avatarUrl} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-neutral-400 hover:text-white truncate flex-1">{prof.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="p-1.5 flex flex-col gap-0.5 text-left">
                    <button type="button"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-all text-[11px] text-neutral-300 hover:text-white cursor-pointer focusable-item"
                      onClick={() => { setProfileDropdownOpen(false); handleLogoutProfile(); }}
                    >
                      <ArrowLeft size={13} className="text-neutral-400 rotate-180" /> {t('navbar.changeProfile')}
                    </button>
                    <button type="button"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-all text-[11px] text-neutral-300 hover:text-white cursor-pointer focusable-item"
                      onClick={() => { setProfileDropdownOpen(false); setSelectedGroup('Ayarlar'); }}
                     aria-label="Settings">
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
});
