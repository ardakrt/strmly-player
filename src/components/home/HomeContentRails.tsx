import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ContentPreference } from '../../types';
import type { PlaylistItem } from '../../utils/m3uParser';
import { HomeRailHeader, Top10Card, VodPosterCard } from './HomeVodCards';

interface HomeContentRailsProps {
  language: 'tr' | 'en';
  t: (key: string) => string;
  visibleBlocks: number;
  sectionPosition: (section: 'discovery' | 'live' | 'movies' | 'series') => number;
  liveChannels: PlaylistItem[];
  discoveryItems: any[];
  top10Movies?: PlaylistItem[];
  top10Series?: any[];
  popularMovies: PlaylistItem[];
  popularSeries: any[];
  recentlyWatchedCount: number;
  favoriteCount: number;
  contentPreferences: ContentPreference[];
  globalFavorites: string[];
  railArrowClass: string;
  renderLiveCard: (item: PlaylistItem) => ReactNode;
  onScroll: (sliderId: string, direction: 'left' | 'right') => void;
  onToggleFavorite: (itemId: string, event?: React.MouseEvent) => void;
  onOpenDetails: (item: PlaylistItem) => void;
  onContextMenu: (event: React.MouseEvent, item: any) => void;
  onShowAll: (group: string) => void;
}

function RailFrame({ language, id, arrowClass, children, top10 = false, onScroll }: { language: 'tr' | 'en'; id: string; arrowClass: string; children: ReactNode; top10?: boolean; onScroll: (direction: 'left' | 'right') => void }) {
  return (
    <div className="relative group/row">
      <button type="button" aria-label={language === 'tr' ? 'Sola kaydır' : 'Scroll left'} onClick={() => onScroll('left')} className={`${arrowClass} left-1`}><ChevronLeft size={18} /></button>
      <div id={id} className={`${top10 ? 'top10-slider gap-3 md:gap-4 pt-2' : 'gap-3.5 pt-1'} flex overflow-x-auto pb-5 pr-20 hide-scrollbar snap-x scroll-smooth slider-fading-mask`}>{children}</div>
      <button type="button" aria-label={language === 'tr' ? 'Sağa kaydır' : 'Scroll right'} onClick={() => onScroll('right')} className={`${arrowClass} right-1`}><ChevronRight size={18} /></button>
    </div>
  );
}

export function HomeContentRails(props: HomeContentRailsProps) {
  const { language, t } = props;
  const vodCards = (items: any[], prefix: string) => items.map((item) => <VodPosterCard key={`${prefix}-${item.id}`} channel={item} globalFavorites={props.globalFavorites} toggleFavorite={props.onToggleFavorite} handleOpenDetails={props.onOpenDetails} onContextMenu={props.onContextMenu} requireTmdbPoster />);
  return (
    <>
      {props.visibleBlocks >= props.sectionPosition('live') && props.liveChannels.length > 0 && <div className="flex flex-col gap-2.5 select-none animate-fade-in" style={{ order: props.sectionPosition('live') }}><HomeRailHeader title={language === 'tr' ? 'Hızlı Canlı TV' : 'Quick Live TV'} mutedLabel={language === 'tr' ? 'Popüler' : 'Popular'} /><RailFrame language={language} id="slider-quick-live-tv" arrowClass={props.railArrowClass} onScroll={(direction) => props.onScroll('slider-quick-live-tv', direction)}>{props.liveChannels.map(props.renderLiveCard)}</RailFrame></div>}

      {props.visibleBlocks >= props.sectionPosition('discovery') && props.discoveryItems.length > 0 && <div className="flex flex-col gap-2.5 select-none animate-fade-in" style={{ order: props.sectionPosition('discovery') }}><HomeRailHeader title={t('home.discovery.title')} mutedLabel={props.recentlyWatchedCount > 0 || props.favoriteCount > 0 ? t('home.discovery.personalized') : props.contentPreferences.length ? t('home.discovery.preferences') : t('home.discovery.highlights')} /><RailFrame language={language} id="slider-discovery-home" arrowClass={props.railArrowClass} onScroll={(direction) => props.onScroll('slider-discovery-home', direction)}>{vodCards(props.discoveryItems, 'discover-home')}</RailFrame></div>}

      {props.visibleBlocks >= 2 && ((props.top10Movies?.length ?? 0) > 0 || (props.visibleBlocks >= 3 && (props.top10Series?.length ?? 0) > 0)) && <div className="top10-stack order-2 flex flex-col gap-9">
        {props.top10Movies && props.top10Movies.length > 0 && <div className="top10-rail flex flex-col gap-2.5 select-none animate-fade-in"><HomeRailHeader title={language === 'tr' ? 'Top 10 Filmler' : 'Top 10 Movies'} mutedLabel={language === 'tr' ? 'TMDB seçkisi' : 'TMDB picks'} /><RailFrame language={language} id="slider-top10-movies" arrowClass={props.railArrowClass} top10 onScroll={(direction) => props.onScroll('slider-top10-movies', direction)}>{props.top10Movies.slice(0, 10).map((item, index) => <Top10Card key={`tmdb-top-movie-${item.id || index}`} rank={index + 1} rankLabel={language === 'tr' ? `${index + 1}. sıra` : `Rank ${index + 1}`} item={item} globalFavorites={props.globalFavorites} toggleFavorite={props.onToggleFavorite} handleOpenDetails={props.onOpenDetails} onContextMenu={props.onContextMenu} />)}</RailFrame></div>}
        {props.visibleBlocks >= 3 && props.top10Series && props.top10Series.length > 0 && <div className="top10-rail flex flex-col gap-2.5 select-none animate-fade-in"><HomeRailHeader title={language === 'tr' ? 'Top 10 Diziler' : 'Top 10 Series'} mutedLabel={language === 'tr' ? 'TMDB seçkisi' : 'TMDB picks'} /><RailFrame language={language} id="slider-top10-series" arrowClass={props.railArrowClass} top10 onScroll={(direction) => props.onScroll('slider-top10-series', direction)}>{props.top10Series.slice(0, 10).map((item, index) => <Top10Card key={`tmdb-top-series-${item.id || index}`} rank={index + 1} rankLabel={language === 'tr' ? `${index + 1}. sıra` : `Rank ${index + 1}`} item={item} globalFavorites={props.globalFavorites} toggleFavorite={props.onToggleFavorite} handleOpenDetails={props.onOpenDetails} onContextMenu={props.onContextMenu} />)}</RailFrame></div>}
      </div>}

      {props.visibleBlocks >= props.sectionPosition('movies') && props.popularMovies.length > 0 && <div className="flex flex-col gap-2.5 select-none animate-fade-in" style={{ order: props.sectionPosition('movies') }}><HomeRailHeader title={language === 'tr' ? 'Popüler Filmler' : 'Popular Movies'} actionLabel={language === 'tr' ? 'Tümü' : 'See all'} onAction={() => props.onShowAll('Sinema')} /><RailFrame language={language} id="slider-popular-movies" arrowClass={props.railArrowClass} onScroll={(direction) => props.onScroll('slider-popular-movies', direction)}>{vodCards(props.popularMovies, 'pop-movie')}</RailFrame></div>}
      {props.visibleBlocks >= props.sectionPosition('series') && props.popularSeries.length > 0 && <div className="flex flex-col gap-2.5 select-none animate-fade-in" style={{ order: props.sectionPosition('series') }}><HomeRailHeader title={language === 'tr' ? 'Popüler Diziler' : 'Popular Series'} actionLabel={language === 'tr' ? 'Tümü' : 'See all'} onAction={() => props.onShowAll('Diziler')} /><RailFrame language={language} id="slider-popular-series" arrowClass={props.railArrowClass} onScroll={(direction) => props.onScroll('slider-popular-series', direction)}>{vodCards(props.popularSeries, 'pop-series')}</RailFrame></div>}
    </>
  );
}
