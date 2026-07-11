import { Heart, Play, Tv } from 'lucide-react';
import { APP_VIEWS } from '../navigation/views';

interface FavoritesEmptyStateProps {
  onGoToLiveTv: () => void;
  onGoToHome: () => void;
}

export function FavoritesEmptyState({ onGoToLiveTv, onGoToHome }: FavoritesEmptyStateProps) {
  return (
    <div className="min-h-[calc(100vh-180px)] flex items-center justify-center animate-fade-in">
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-neutral-950/45 backdrop-blur-2xl p-8 md:p-10 text-center shadow-[0_28px_90px_rgba(0,0,0,0.45)] overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="mx-auto mb-6 w-20 h-20 rounded-[24px] bg-white/[0.06] border border-white/10 flex items-center justify-center text-red-500 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
          <Heart size={30} fill="currentColor" />
        </div>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">Henüz favorin yok</h2>
        <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
          Kanalların, filmlerin veya dizilerin üzerindeki kalp simgesine tıklayarak favori listenizi oluşturabilirsiniz.
        </p>
        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button type="button"
            onClick={onGoToLiveTv}
            className="h-11 px-5 rounded-full bg-white text-black hover:bg-neutral-200 transition-all font-bold text-xs flex items-center gap-2"
           aria-label="TV">
            <Tv size={15} /> Canlı TV&apos;ye Git
          </button>
          <button type="button"
            onClick={onGoToHome}
            className="h-11 px-5 rounded-full bg-white/8 hover:bg-white/14 border border-white/10 transition-all font-bold text-xs text-white flex items-center gap-2"
           aria-label="Play">
            <Play size={14} fill="currentColor" /> {APP_VIEWS.home}
          </button>
        </div>
      </div>
    </div>
  );
}
