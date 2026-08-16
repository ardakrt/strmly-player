import { memo } from 'react';
import { Search, X, ArrowLeft, Settings, ChevronDown, RefreshCw, UserRound } from 'lucide-react';
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
  spotlightSearchInput: string;
  setSpotlightSearchInput: (val: string) => void;
  spotlightInputRef: React.RefObject<HTMLInputElement | null>;
  showSpotlight: boolean;
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
  spotlightSearchInput,
  setSpotlightSearchInput,
  spotlightInputRef,
  showSpotlight,
  profileDropdownOpen,
  setProfileDropdownOpen,
  currentProfile,
  isCurrentProfileGradient,
  profiles,
  handleSelectProfile,
  handleLogoutProfile
}: NavbarProps) {
  const { t, language, pendingPlaylistUpdate, applyPendingUpdate } = useSettings();
  if (!loaded) return null;

  const exitSearch = () => {
    setShowSpotlight(false);
    setSpotlightSearchInput('');
  };

  const openSearch = () => {
    setSpotlightScope('all');
    setShowSpotlight(true);
  };

  const clearCatalogSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  return (
    <>
      {/* Dedicated Linux-friendly window handle. It stays large enough to
          grab when maximized; double-clicking it toggles maximize natively. */}
      <div
        className="titlebar-drag-strip fixed left-0 right-0 top-0 z-[60] h-8"
        aria-hidden="true"
        title={language === 'tr' ? 'Pencereyi taşımak için sürükleyin' : 'Drag to move the window'}
      />
      <div className="pointer-events-none fixed top-0 left-0 right-0 z-50 px-3 pt-8 sm:px-5 lg:px-8 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
      <nav
        aria-label="Ana navigasyon"
        className={`pointer-events-auto navbar-liquid-glass mx-auto flex w-full items-center justify-between gap-2 px-2.5 sm:px-3 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] rounded-full ${
          scrolled || showSpotlight
            ? 'navbar-liquid-glass--scrolled h-11 max-w-[1040px]'
            : 'h-12 max-w-[1180px]'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center h-full relative z-[1]">
          <button
            type="button"
            aria-label={t('navbar.home')}
            className="flex shrink-0 items-center group cursor-pointer  rounded-full px-2 sm:px-2.5"
            onClick={() => {
              exitSearch();
              setSelectedGroup('Ana Sayfa');
              clearCatalogSearch();
            }}
          >
            <span className="text-[14px] font-black tracking-[-0.015em] text-white leading-none transition-opacity duration-200 group-hover:opacity-80">Strmly</span>
          </button>

          {/* Discreet vertical divider between logo and navigation links */}
          <div className="h-3.5 w-[1px] bg-white/12 mx-1 sm:mx-1.5 shrink-0 select-none" />

          <div className="navbar-nav-scroll-cue hide-scrollbar flex min-w-0 flex-1 items-center h-full gap-0.5 overflow-x-auto px-1 pr-6 sm:px-1.5 sm:pr-1.5">
            {[
              { id: 'Ana Sayfa', label: t('navbar.home') },
              { id: 'Canlı TV', label: t('navbar.liveTv') },
              { id: 'Sinema', label: t('navbar.movies') },
              { id: 'Diziler', label: t('navbar.series') },
              { id: 'Favorilerim', label: t('navbar.favorites') },
              { id: 'İndirilenler', label: language === 'tr' ? 'Kaydedilenler' : 'Saved' }
            ].map(link => {
              const isActive = !showSpotlight && selectedGroup === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    exitSearch();
                    setSelectedGroup(link.id);
                    clearCatalogSearch();
                  }}
                  className={`navbar-nav-item relative shrink-0 px-3 sm:px-3.5 py-1.5 rounded-full border text-xs font-bold transition-all duration-200 cursor-pointer ${isActive
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
        <div className="flex shrink-0 items-center gap-2 relative z-[1]">
          <div
            className={`relative flex h-8 items-center rounded-full border transition-all duration-300 ease-out ${
              showSpotlight
                ? 'w-[min(46vw,18rem)] sm:w-52 lg:w-64 border-white/30 bg-black/60 shadow-[0_0_24px_rgba(0,0,0,0.4)]'
                : 'w-9 md:w-44 lg:w-56 xl:w-64 border-white/[0.09] bg-white/[0.06] hover:border-white/[0.18] hover:bg-white/[0.09]'
            }`}
          >
            <Search
              size={13}
              className={`pointer-events-none absolute left-2.5 transition-colors ${
                showSpotlight ? 'text-white/80' : 'text-neutral-400'
              }`}
            />
            <input
              ref={spotlightInputRef}
              type="text"
              value={spotlightSearchInput}
              placeholder={t('navbar.searchPlaceholder')}
              aria-label={t('navbar.searchTitle')}
              autoComplete="off"
              spellCheck={false}
              onFocus={(event) => {
                if (event.currentTarget.dataset.spotlightReturnFocus === 'true') {
                  delete event.currentTarget.dataset.spotlightReturnFocus;
                  return;
                }
                openSearch();
              }}
              onChange={(event) => {
                openSearch();
                setSpotlightSearchInput(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  exitSearch();
                  event.currentTarget.blur();
                }
              }}
              className="h-full w-full min-w-0 rounded-full bg-transparent pl-8 pr-8 text-base md:text-xs font-medium text-white outline-none placeholder:text-neutral-400/80"
            />
            {showSpotlight && spotlightSearchInput ? (
              <button
                type="button"
                onClick={() => {
                  setSpotlightSearchInput('');
                  spotlightInputRef.current?.focus();
                }}
                className="absolute right-1.5 grid h-5.5 w-5.5 place-items-center rounded-full text-neutral-400 transition hover:bg-white/10 hover:text-white cursor-pointer"
                aria-label={language === 'tr' ? 'Temizle' : 'Clear'}
              >
                <X size={12} />
              </button>
            ) : !showSpotlight ? (
              <div className="pointer-events-none absolute right-2 hidden lg:flex items-center px-1.5 py-0.5 rounded-md bg-white/[0.07] border border-white/[0.12] backdrop-blur-sm text-xs font-mono font-semibold text-neutral-300 shadow-sm select-none">
                Ctrl K
              </div>
            ) : null}
          </div>
          {pendingPlaylistUpdate && (
            <button
              type="button"
              onClick={applyPendingUpdate}
              title={language === 'tr' ? 'Güncellenmiş listeyi yükle' : 'Apply updated playlist'}
              className="h-8 px-3 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-lg shadow-emerald-500/10 shrink-0"
            >
              <RefreshCw size={12} className="animate-spin" style={{ animationDuration: '4s' }} />
              <span className="hidden sm:inline">{language === 'tr' ? 'Yeni Liste Hazır' : 'Playlist Updated'} ({pendingPlaylistUpdate.channelCount})</span>
              <span className="sm:hidden">{language === 'tr' ? 'Yenile' : 'Refresh'}</span>
            </button>
          )}
          {/* Profile Dropdown */}
          <div className="relative">
            <button
              type="button"
              aria-expanded={profileDropdownOpen}
              className={`navbar-profile-btn group h-8.5 rounded-full bg-white/[0.06] hover:bg-white/[0.11] border flex items-center gap-2 pl-1 pr-2.5 transition-all duration-200 cursor-pointer  ${
                profileDropdownOpen ? 'border-white/25 bg-white/[0.12] shadow-md' : 'border-white/10 hover:border-white/20'
              }`}
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            >
              <div className="relative">
                <div className="w-6.5 h-6.5 rounded-full overflow-hidden border border-white/20 ring-1 ring-white/15 group-hover:ring-white/35 flex items-center justify-center shadow-md bg-neutral-800 transition-all duration-200">
                  {currentProfile && currentProfile.avatarUrl && !isCurrentProfileGradient ? (
                    <img src={currentProfile.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UserRound size={14} className="text-neutral-300 shrink-0" />
                  )}
                </div>
              </div>
              <span className="hidden lg:block max-w-26 truncate text-xs font-medium text-neutral-200 group-hover:text-white transition-colors">
                {currentProfile ? currentProfile.name : t('navbar.user')}
              </span>
              <ChevronDown size={12} className={`hidden lg:block text-neutral-400 group-hover:text-white transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180 text-white' : ''}`} />
            </button>

            {profileDropdownOpen && (
              <>
                <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (() => setProfileDropdownOpen(false))(); } }} tabIndex={0} role="button" className="fixed inset-0 z-40" onClick={() => setProfileDropdownOpen(false)} />
                <div className="absolute right-0 top-11 mt-2 w-60 bg-neutral-950/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.6)] overflow-hidden z-50 animate-scale-in">
                  <div className="p-3.5 border-b border-white/5 flex items-center gap-3 bg-white/[0.02]">
                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center shadow-lg bg-neutral-800 shrink-0">
                      {currentProfile && currentProfile.avatarUrl && !isCurrentProfileGradient ? (
                        <img src={currentProfile.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserRound size={17} className="text-neutral-300 shrink-0" />
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
                      <span className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider px-2 py-1 select-none">{t('navbar.otherProfiles')}</span>
                      {profiles.filter(p => p.id !== currentProfile?.id).map(prof => {
                        const isProfGradient = prof.avatarUrl.startsWith('linear-gradient');
                        return (
                          <button type="button"
                            key={prof.id}
                            onClick={() => {
                              setProfileDropdownOpen(false);
                              handleSelectProfile(prof.id);
                            }}
                            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all text-left cursor-pointer "
                          >
                            <div className="w-6 h-6 rounded-md overflow-hidden border border-white/5 flex items-center justify-center bg-neutral-800 shrink-0">
                              {prof.avatarUrl && !isProfGradient ? (
                                <img src={prof.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <UserRound size={13} className="text-neutral-300 shrink-0" />
                              )}
                            </div>
                            <span className="text-xs font-semibold text-neutral-400 hover:text-white truncate flex-1">{prof.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="p-1.5 flex flex-col gap-0.5 text-left">
                    <button type="button"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-all text-xs text-neutral-300 hover:text-white cursor-pointer"
                      onClick={() => { setProfileDropdownOpen(false); handleLogoutProfile(); }}
                    >
                      <ArrowLeft size={13} className="text-neutral-400 rotate-180" /> {t('navbar.changeProfile')}
                    </button>
                    <button type="button"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-all text-xs text-neutral-300 hover:text-white cursor-pointer"
                      onClick={() => { setProfileDropdownOpen(false); setSelectedGroup('Ayarlar'); }}
                      aria-label={t('navbar.advancedSettings')}>
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
    </>
  );
});
