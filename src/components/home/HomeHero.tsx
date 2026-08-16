import { ChevronLeft, ChevronRight, Heart, Info, Play } from 'lucide-react';
import type { PlaylistItem } from '../../utils/m3uParser';

interface HomeHeroProps {
  language: 'tr' | 'en';
  t: (key: string) => string;
  isPlaylistHero: boolean;
  featuredTmdbData: any;
  currentHeroItem: PlaylistItem | null;
  fallbackHeroItem: any;
  heroTitle: string;
  heroTitleSize: string;
  heroDesc: string;
  heroPrimaryLabel: string;
  heroInfoLabel: string;
  heroFavoriteId: string;
  heroIsFavorite: boolean;
  loadedBackdrop: string | null;
  prevBackdrop: string | null;
  displayFeaturedIndex: number;
  activeShowcaseList: any[];
  onChangeShowcase: (offset: number) => void;
  onSelectShowcase: (index: number) => void;
  onPlayStream: (item: PlaylistItem) => void;
  onOpenDetails: (item: PlaylistItem) => void;
  onToggleFavorite: (itemId: string, event?: React.MouseEvent) => void;
  onShowToast: (message: string) => void;
}

export function HomeHero(props: HomeHeroProps) {
  const {
    language, t, isPlaylistHero, featuredTmdbData, currentHeroItem, fallbackHeroItem,
    heroTitle, heroTitleSize, heroDesc, heroPrimaryLabel, heroInfoLabel, heroFavoriteId,
    heroIsFavorite, loadedBackdrop, prevBackdrop, displayFeaturedIndex, activeShowcaseList,
    onChangeShowcase, onSelectShowcase, onPlayStream, onOpenDetails, onToggleFavorite, onShowToast,
  } = props;
  return (
  <div className="relative group/hero-outer -mx-6 md:-mx-10 w-[calc(100%+3rem)] md:w-[calc(100%+5rem)] bg-[var(--bg-surface)]">
    {/* Hero only — poster never bleeds under rails */}
    <div
      className="relative z-10 w-full h-[480px] md:h-[78vh] max-h-[820px] rounded-none overflow-hidden flex items-end select-none bg-[var(--bg-surface)]"
    >
      {prevBackdrop && (
        <img
          src={prevBackdrop}
          alt=""
          className="home-hero-artwork absolute inset-0 w-full h-full object-cover home-hero-image-drift"
          style={{ objectPosition: 'center 25%', zIndex: 1 }}
        />
      )}
      {loadedBackdrop && (
        <img
          key={loadedBackdrop}
          src={loadedBackdrop}
          alt=""
          className="home-hero-artwork absolute inset-0 w-full h-full object-cover home-hero-image-fade"
          style={{ objectPosition: 'center 25%', zIndex: 2 }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      {/* Soft black floor — blend into elevated OLED surface, not pure void */}
      <div className="home-hero-floor absolute inset-0 z-10 pointer-events-none" />
      {/* Top-down Scrim for nav contrast */}
      <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#0a0a0c]/85 via-[#0a0a0c]/30 to-transparent z-10 pointer-events-none" />
      <div className="home-hero-left-scrim absolute inset-0 z-10 pointer-events-none" />
      <div className="home-hero-image-overlay absolute inset-0 z-[11] pointer-events-none" />
      <div className="home-hero-grain absolute inset-0 z-[12] pointer-events-none" />

      <div
        key={`hero-copy-${displayFeaturedIndex}`}
        className="home-hero-copy absolute left-8 right-8 md:left-16 md:right-auto bottom-[28%] md:bottom-[32%] max-w-xl md:max-w-2xl flex flex-col gap-3.5 md:gap-4 z-20 select-none"
      >
        {featuredTmdbData?.logo ? (
          <div key={featuredTmdbData.logo} className="home-hero-title-logo-shell z-10 flex justify-start">
            <img
              src={featuredTmdbData.logo}
              alt={heroTitle}
              className="home-hero-title-logo max-h-[4.25rem] md:max-h-28 object-contain object-left w-auto max-w-[min(100%,420px)]"
            />
          </div>
        ) : (
          <h1 className={`home-hero-title text-4xl md:text-6xl ${heroTitleSize} font-black tracking-[-0.04em] text-white leading-[0.95] z-10`}>
            {heroTitle}
          </h1>
        )}

        {/* Single quiet meta line — no chips */}
        {isPlaylistHero && (() => {
          const metaParts: string[] = [];
          if (featuredTmdbData?.match) {
            metaParts.push(language === 'tr' ? `%${featuredTmdbData.match} Eşleşme` : `${featuredTmdbData.match}% Match`);
          }
          if (featuredTmdbData?.year) metaParts.push(featuredTmdbData.year);
          if (featuredTmdbData?.rating && parseFloat(featuredTmdbData.rating) > 0) {
            metaParts.push(`★ ${featuredTmdbData.rating}`);
          }
          if (featuredTmdbData?.duration) metaParts.push(featuredTmdbData.duration);
          if (!metaParts.length) return null;
          return (
            <p className="text-[12px] md:text-[13px] font-medium text-white/50 tracking-wide z-10">
              <span className="text-emerald-400/90 font-semibold">{metaParts[0]}</span>
              {metaParts.slice(1).map((part) => (
                <span key={part}>
                  <span className="mx-2 text-white/20">·</span>
                  <span className="text-white/55">{part}</span>
                </span>
              ))}
            </p>
          );
        })()}

        {heroDesc ? (
          <p className="text-[13px] md:text-[15px] text-white/65 leading-[1.55] font-normal max-w-xl z-10 line-clamp-3">
            {heroDesc}
          </p>
        ) : null}

        <div className="flex items-center gap-3 mt-0.5 z-10">
          <button
            type="button"
            onClick={() => {
              if (isPlaylistHero && currentHeroItem) {
                if (currentHeroItem.type === 'series') {
                      onOpenDetails(currentHeroItem);
                } else {
                      onPlayStream(currentHeroItem);
                }
              } else if (fallbackHeroItem) {
                    onShowToast(language === 'tr' ? `${fallbackHeroItem.title} çalma listenizden aranıyor...` : `Searching for ${fallbackHeroItem.title} in your playlist...`);
              }
            }}
            className="h-11 px-6 bg-white text-black font-bold rounded-lg flex items-center gap-2 hover:bg-white/90 transition-colors duration-200 active:scale-[0.98] text-sm cursor-pointer"
            aria-label={heroPrimaryLabel}
          >
            <Play size={15} fill="#000" className="ml-0.5" />
            {heroPrimaryLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              if (isPlaylistHero && currentHeroItem) {
                    onOpenDetails(currentHeroItem);
              } else {
                    onShowToast(t('home.ownPlaylistDetails'));
              }
            }}
            className="h-11 px-5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold flex items-center gap-2 transition-colors duration-200 active:scale-[0.98] cursor-pointer text-sm"
            aria-label={heroInfoLabel}
          >
            <Info size={15} className="opacity-80" />
            {heroInfoLabel}
          </button>
          {isPlaylistHero && currentHeroItem ? (
            <button
              type="button"
                  onClick={(e) => onToggleFavorite(heroFavoriteId, e)}
              className={`h-11 w-11 rounded-lg flex items-center justify-center transition-colors duration-200 cursor-pointer ${
                heroIsFavorite
                  ? 'text-red-400 hover:text-red-300'
                  : 'text-white/45 hover:text-white/80'
              }`}
              aria-label={language === 'tr' ? (heroIsFavorite ? 'Favoriden çıkar' : 'Favoriye ekle') : (heroIsFavorite ? 'Remove favorite' : 'Add favorite')}
              title={language === 'tr' ? (heroIsFavorite ? 'Favoriden çıkar' : 'Favoriye ekle') : (heroIsFavorite ? 'Remove favorite' : 'Add favorite')}
            >
              <Heart size={18} fill={heroIsFavorite ? 'currentColor' : 'none'} />
            </button>
          ) : null}
        </div>
      </div>
      {activeShowcaseList.length > 1 && (
        <>
          <button
            type="button"
            aria-label={language === 'tr' ? 'Önceki tanıtım' : 'Previous showcase'}
                onClick={() => onChangeShowcase(-1)}
            className="absolute left-4 top-1/2 z-30 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/20 text-white/60 opacity-0 backdrop-blur-xl transition-all hover:bg-white/10 hover:text-white group-hover/hero-outer:opacity-100 focus-visible:opacity-100"
          >
            <ChevronLeft size={19} />
          </button>
          <button
            type="button"
            aria-label={language === 'tr' ? 'Sonraki tanıtım' : 'Next showcase'}
                onClick={() => onChangeShowcase(1)}
            className="absolute right-4 top-1/2 z-30 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/20 text-white/60 opacity-0 backdrop-blur-xl transition-all hover:bg-white/10 hover:text-white group-hover/hero-outer:opacity-100 focus-visible:opacity-100"
          >
            <ChevronRight size={19} />
          </button>
        </>
      )}

      <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-2 backdrop-blur-xl">
        {activeShowcaseList.map((_, idx) => (
          <button
            key={`showcase-dot-${idx}`}
            type="button"
            aria-label={`${language === 'tr' ? 'Vitrin' : 'Showcase'} ${idx + 1}`}
                onClick={() => onSelectShowcase(idx)}
            className={`h-1.5 rounded-full transition-all duration-300 ${displayFeaturedIndex === idx ? 'w-6 bg-white/90' : 'w-1.5 bg-white/30 hover:bg-white/60'}`}
          />
        ))}
      </div>

    </div>
  </div>

  );
}
