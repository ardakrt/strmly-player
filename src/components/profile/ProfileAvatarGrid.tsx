import type { AvatarSearchResult } from '../../types';
import type { LocalSeries, SeriesCast } from './profileScreenTypes';

interface Props {
  avatarSearchResults: AvatarSearchResult[];
  language: 'tr' | 'en';
  localSeries: LocalSeries[];
  profileFormAvatar: string;
  selectedSeriesForCast: { id: number; name: string } | null;
  seriesCast: SeriesCast[];
  emptyLocalSeriesMessage: string;
  onFetchSeriesCast: (id: number, name: string, mediaType: 'movie' | 'tv') => void;
  onSelectAvatar: (avatarUrl: string) => void;
}

const posterGridClass = 'grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3 max-h-[440px] overflow-y-auto pr-1 hide-scrollbar border border-white/5 rounded-2xl p-2.5 bg-black/40 animate-fade-in';

export function ProfileAvatarGrid(props: Props) {
  const {
    avatarSearchResults, emptyLocalSeriesMessage, language, localSeries,
    onFetchSeriesCast, onSelectAvatar, profileFormAvatar,
    selectedSeriesForCast, seriesCast,
  } = props;

  if (selectedSeriesForCast) {
    if (seriesCast.length === 0) {
      return <EmptyGrid message={language === 'tr' ? 'Diziye ait oyuncu görseli bulunamadı.' : 'No actor images found for this series.'} />;
    }
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 max-h-[440px] overflow-y-auto pr-1 hide-scrollbar border border-white/5 rounded-2xl p-2.5 bg-black/40 animate-fade-in">
        {seriesCast.map(actor => (
          <button type="button" key={`${actor.name}-${actor.avatarUrl}`} onClick={() => onSelectAvatar(actor.avatarUrl)}
            className={`flex flex-col items-center gap-1.5 p-1.5 rounded-xl border transition-all duration-200 transform hover:scale-103 cursor-pointer ${profileFormAvatar === actor.avatarUrl ? 'border-white bg-white/[0.04] shadow-[0_0_12px_rgba(255,255,255,0.2)]' : 'border-transparent hover:border-white/10 hover:bg-white/[0.01]'}`}>
            <div className="w-16 h-16 rounded-full overflow-hidden border border-white/10 shadow-md">
              <img src={actor.avatarUrl} className="w-full h-full object-cover" alt={actor.name} loading="lazy" />
            </div>
            <span className="text-[9px] font-bold text-neutral-400 text-center truncate w-full" title={actor.name}>{actor.name}</span>
          </button>
        ))}
      </div>
    );
  }

  if (avatarSearchResults.length > 0) {
    return <PosterGrid items={avatarSearchResults} onSelect={item => onFetchSeriesCast(item.id, item.name, item.mediaType)} />;
  }
  if (localSeries.length === 0) return <EmptyGrid message={emptyLocalSeriesMessage} />;
  return <PosterGrid items={localSeries} onSelect={item => onFetchSeriesCast(item.id, item.name, 'tv')} />;
}

function EmptyGrid({ message }: { message: string }) {
  return <div className="h-[440px] border border-dashed border-white/5 rounded-2xl flex items-center justify-center bg-black/40 text-neutral-500 text-xs animate-fade-in">{message}</div>;
}

function PosterGrid<T extends { id: number; name: string; posterUrl: string }>({
  items,
  onSelect,
}: {
  items: T[];
  onSelect: (item: T) => void;
}) {
  return (
    <div className={posterGridClass}>
      {items.map(item => (
        <button type="button" key={item.id} onClick={() => onSelect(item)}
          className="group aspect-[2/3] rounded-xl overflow-hidden border border-transparent hover:border-white/20 transition-all duration-300 transform hover:scale-105 cursor-pointer relative shadow-lg"
          title={item.name} aria-label={item.name}>
          <img src={item.posterUrl} className="w-full h-full object-cover" alt={item.name} loading="lazy" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center">
            <span className="text-[8px] font-black text-white text-center truncate w-full">{item.name}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
