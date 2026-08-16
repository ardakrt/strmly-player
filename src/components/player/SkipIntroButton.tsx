import { Play } from 'lucide-react';

export function SkipIntroButton({ language, onSkip }: { language: 'tr' | 'en'; onSkip: () => void }) {
  return (
    <button type="button" onClick={(event) => { event.stopPropagation(); onSkip(); }} className="group absolute bottom-28 right-8 z-30 flex items-center gap-2 rounded-lg border border-white/20 bg-black/75 px-5 py-2.5 text-sm font-bold text-white shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-[var(--accent-color)]/50 hover:bg-black/90 active:scale-95">
      <Play size={14} className="fill-white transition-transform group-hover:scale-110" aria-hidden="true" />
      <span>{language === 'tr' ? 'Girişi Atla' : 'Skip Intro'}</span>
    </button>
  );
}
