import { Heart, Play, Tv } from 'lucide-react';
import { APP_VIEWS } from '../navigation/views';
import { useSettings } from '../context/SettingsContext';

interface FavoritesEmptyStateProps {
  onGoToLiveTv: () => void;
  onGoToHome: () => void;
}

export function FavoritesEmptyState({ onGoToLiveTv, onGoToHome }: FavoritesEmptyStateProps) {
  const { language } = useSettings();
  return (
    <div className="flex min-h-[calc(100vh-180px)] items-center justify-center px-6 animate-fade-in">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-red-400/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <Heart size={24} fill="currentColor" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white md:text-2xl">
          {language === 'tr' ? 'Henüz favorin yok' : 'No favorites yet'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          {language === 'tr'
            ? 'Kanalların, filmlerin veya dizilerin üzerindeki kalp simgesine tıklayarak favori listenizi oluşturabilirsiniz.'
            : 'Tap the heart icon on channels, movies, or series to build your favorites list.'}
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onGoToLiveTv}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-xs font-bold text-black transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Tv size={14} aria-hidden="true" />
            {language === 'tr' ? "Canlı TV'ye Git" : 'Go to Live TV'}
          </button>
          <button
            type="button"
            onClick={onGoToHome}
            aria-label={APP_VIEWS.home}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-5 text-xs font-bold text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <Play size={13} fill="currentColor" aria-hidden="true" />
            {APP_VIEWS.home}
          </button>
        </div>
      </div>
    </div>
  );
}
