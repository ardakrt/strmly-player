import { useEffect, useState } from 'react';
import { Play, Heart } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import type { PlaylistItem } from '../utils/m3uParser';
import { getTmdbApiKey, resolveTmdbImageSrc, tmdbCache, getTmdbLanguage } from '../utils/tmdb';
import { useSettings } from '../context/SettingsContext';

interface TmdbData {
  id?: number;
  match: string;
  rating: string;
  year: string;
  desc: string;
  poster?: string;
  backdrop?: string;
}

interface ChannelModalProps {
  channel: PlaylistItem;
  tmdbData: TmdbData | null;
  onClose: () => void;
  onPlay: (channel: PlaylistItem) => void;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

interface CastMember {
  name: string;
  character: string;
  avatarUrl: string;
}

export const ChannelModal = ({ 
  channel, 
  tmdbData, 
  onClose, 
  onPlay, 
  isFavorite,
  onToggleFavorite
}: ChannelModalProps) => {
  const { t, language } = useSettings();
  const [cast, setCast] = useState<CastMember[]>([]);
  const [showCastModal, setShowCastModal] = useState(false);

  useEffect(() => {
    if (!tmdbData?.id) {
      setCast([]);
      return;
    }

    let cancelled = false;
    const cacheKey = `cast-movie-${tmdbData.id}`;

    const loadCast = async () => {
      try {
        const cached = await tmdbCache.get(cacheKey);
        if (cached && Array.isArray(cached)) {
          if (!cancelled) setCast(cached);
          return;
        }

        const apiKey = getTmdbApiKey();
        const creditsPath = `/3/movie/${tmdbData.id}/credits?api_key=${apiKey}&language=${getTmdbLanguage()}`;
        
        let rawCast: any[] = [];
        if (window.electronAPI && window.electronAPI.fetchTmdb) {
          const res = await window.electronAPI.fetchTmdb(creditsPath) as any;
          if (res && Array.isArray(res.cast)) rawCast = res.cast;
        } else {
          const res = await fetch(`https://api.themoviedb.org${creditsPath}`);
          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.cast)) rawCast = data.cast;
          }
        }

        const castWithPhotos = rawCast.filter(item => item.profile_path).slice(0, 18);
        const resolvedCast = await Promise.all(
          castWithPhotos.map(async (item) => {
            const avatarUrl = await resolveTmdbImageSrc(item.profile_path, 'w185');
            return {
              name: item.name,
              character: item.character,
              avatarUrl: avatarUrl || ''
            };
          })
        );

        const finalCast = resolvedCast.filter(item => item.avatarUrl);
        if (finalCast.length > 0) {
          await tmdbCache.set(cacheKey, finalCast);
        }

        if (!cancelled) setCast(finalCast);
      } catch (err) {
        console.error("Failed to load movie cast:", err);
      }
    };

    loadCast();

    return () => {
      cancelled = true;
    };
  }, [tmdbData?.id]);

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 select-none animate-fade-in">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} role="button" tabIndex={-1} aria-label={language === 'tr' ? 'Kapat' : 'Close'} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }} />
      <div className="w-full max-w-4xl bg-neutral-950/65 backdrop-blur-2xl border border-white/[0.08] rounded-[36px] overflow-hidden flex flex-col md:flex-row shadow-[0_32px_80px_rgba(0,0,0,0.85)] relative animate-scale-in z-10">
        <button type="button"
          onClick={onClose}
          className="absolute top-5 right-5 z-30 w-10 h-10 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-neutral-300 hover:text-white backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg cursor-pointer"
          title={language === 'tr' ? 'Kapat' : 'Close'}
         aria-label={language === 'tr' ? 'Kapat' : 'Close'}>
          ✕
        </button>
        <button type="button"
          onClick={onToggleFavorite}
          className="absolute top-5 right-17 z-30 w-10 h-10 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-red-500 backdrop-blur-md transition-all duration-300 active:scale-95 shadow-lg cursor-pointer hover:scale-105"
          title={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
          aria-label={isFavorite ? (language === 'tr' ? 'Favorilerden Çıkar' : 'Remove from Favorites') : (language === 'tr' ? 'Favorilere Ekle' : 'Add to Favorites')}
        >
          <Heart size={18} fill={isFavorite ? "currentColor" : "none"} className={isFavorite ? "text-red-500" : ""} />
        </button>
        <div className="w-full md:w-[40%] aspect-video md:aspect-[2/3] bg-black/30 relative flex items-center justify-center border-r border-white/[0.05] shrink-0 overflow-hidden">
          {tmdbData?.poster ? (
            <img src={tmdbData.poster} alt={channel.name} className="w-full h-full object-cover" />
          ) : (
            <ImageWithFallback
              src={channel.logo}
              name={channel.name}
              group={channel.group}
              size="lg"
              itemType={channel.type}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
          {channel.progress !== undefined && channel.progress > 0 && (
            <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20 z-20">
              <div 
                className="h-full bg-white transition-all duration-300"
                style={{ width: `${channel.progress}%` }}
              />
            </div>
          )}
        </div>
        <div className="p-6 md:p-8 flex flex-col justify-between flex-1 gap-5 bg-transparent overflow-hidden">
          <div className="flex flex-col gap-4 flex-1 overflow-y-auto pr-1.5 custom-modal-scrollbar">
            <div className="flex flex-col md:pr-24">
              <span className="text-[10px] tracking-widest font-extrabold text-neutral-500 uppercase">{channel.group || (language === 'tr' ? 'GENEL KATALOG' : 'GENERAL CATALOG')}</span>
              <h2 className="text-2xl font-bold tracking-tight text-white mt-1 leading-snug">{channel.name}</h2>
            </div>
            {tmdbData && (
              <div className="flex flex-wrap items-center gap-3.5 text-xs font-semibold">
                <span className="text-emerald-400">{t('common.matchScore').replace('{{score}}', (tmdbData.match || '95').replace(/[^0-9]/g, ''))}</span>
                <span className="text-neutral-400">{tmdbData.year}</span>
                <span className="px-2 py-0.5 bg-white/5 border border-white/10 text-neutral-300 rounded text-[10px] font-bold">4K ULTRA HD</span>
                <span className="px-2 py-0.5 bg-white/5 border border-white/10 text-neutral-300 rounded text-[10px] font-bold">DOLBY ATMOS 5.1</span>
                <span className="text-yellow-500 font-bold">{tmdbData.rating}</span>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-widest font-extrabold text-neutral-500">{language === 'tr' ? 'Özet' : 'Overview'}</span>
              <p className="text-xs text-neutral-300 font-light leading-relaxed pr-2 max-h-[100px] overflow-y-auto hide-scrollbar">
                {tmdbData?.desc || (language === 'tr' ? 'Bu içerik için özet bulunmuyor.' : 'No overview available for this content.')}
              </p>
            </div>
            {cast.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <button type="button"
                  onClick={() => setShowCastModal(true)}
                  className="flex items-center justify-between cursor-pointer group/cast-header select-none shrink-0 w-full bg-transparent border-0 p-0 text-left"
                >
                  <span className="text-[10px] uppercase tracking-widest font-extrabold text-neutral-500 group-hover/cast-header:text-neutral-300 transition-colors">{language === 'tr' ? 'Oyuncular' : 'Cast'}</span>
                  <span className="text-[9px] text-neutral-500 group-hover/cast-header:text-[var(--accent-color)] font-bold uppercase tracking-wider transition-colors flex items-center gap-1">
                    {language === 'tr' ? 'TÜMÜNÜ GÖR' : 'SEE ALL'}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                </button>
                <div 
                  onClick={() => setShowCastModal(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowCastModal(true); }}
                  aria-label={language === 'tr' ? 'Tüm oyuncuları gör' : 'See all cast'}
                  className="flex gap-4 overflow-x-auto pb-1.5 hide-scrollbar select-none cursor-pointer"
                >
                  {cast.slice(0, 8).map((member, idx) => (
                    <div key={`${member.name}-${idx}`} className="flex flex-col items-center gap-1 shrink-0 w-16 text-center transition-transform hover:scale-105 duration-200">
                      <img
                        src={member.avatarUrl}
                        alt={member.name}
                        className="w-10 h-10 rounded-full object-cover border border-white/10 shadow-inner"
                      />
                      <span className="text-[9px] text-neutral-200 font-bold truncate w-full" title={member.name}>
                        {member.name}
                      </span>
                      <span className="text-[8px] text-neutral-500 truncate w-full" title={member.character}>
                        {member.character}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2.5 border-t border-white/5 pt-4 shrink-0">
            <button type="button"
              onClick={() => onPlay(channel)}
              className="w-full py-3.5 bg-white hover:bg-neutral-200 font-bold text-xs uppercase text-black rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 transform cursor-pointer"
            >
              <Play size={14} fill="#000" className="text-black" />{' '}
              {channel.progress && channel.progress > 0 
                ? (language === 'tr' ? 'İzlemeye Devam Et' : 'Resume Watching')
                : (language === 'tr' ? 'Hemen İzle' : 'Watch Now')}
            </button>
          </div>
        </div>

      </div>
      {showCastModal && (
        <div 
          className="fixed inset-0 z-[4000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in"
          onClick={() => setShowCastModal(false)}
          role="button"
          tabIndex={-1}
          aria-label={language === 'tr' ? 'Kapat' : 'Close'}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowCastModal(false); }}
        >
          <div onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ((e) => e.stopPropagation())(e as any); } }} tabIndex={0} role="button" 
            className="w-full max-w-lg bg-neutral-950/90 border border-white/10 rounded-3xl p-6 shadow-2xl relative animate-scale-in flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button"
              onClick={() => setShowCastModal(false)}
              className="absolute top-4 right-4 z-50 w-8 h-8 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
            >
              ✕
            </button>

            <div className="flex flex-col text-left">
              <span className="text-[10px] uppercase tracking-widest font-extrabold text-neutral-500">{language === 'tr' ? 'Oyuncu Kadrosu' : 'Cast & Crew'}</span>
              <h3 className="text-lg font-black text-white mt-0.5 truncate max-w-[85%]">{channel.name}</h3>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mt-2 max-h-[360px] overflow-y-auto pr-1.5 custom-modal-scrollbar">
              {cast.map((member, idx) => (
                <div key={`${member.name}-${idx}`} className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
                  <img
                    src={member.avatarUrl}
                    alt={member.name}
                    className="w-14 h-14 rounded-full object-cover border border-white/10 shadow-md"
                  />
                  <div className="flex flex-col w-full min-w-0">
                    <span className="text-[10px] text-white font-extrabold truncate w-full" title={member.name}>
                      {member.name}
                    </span>
                    <span className="text-[9px] text-neutral-400 font-medium truncate w-full mt-0.5" title={member.character}>
                      {member.character}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
