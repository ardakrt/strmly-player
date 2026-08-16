export interface SeriesCastMember {
  name: string;
  character: string;
  avatarUrl: string;
}

export function CircularSaveProgress({ progress }: { progress: number }) {
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const safeProgress = Math.max(0, Math.min(100, progress || 0));
  const offset = circumference - (safeProgress / 100) * circumference;

  return (
    <span className="relative flex h-5 w-5 items-center justify-center">
      <svg className="h-5 w-5 -rotate-90" viewBox="0 0 20 20" aria-hidden="true">
        <circle
          cx="10"
          cy="10"
          r={radius}
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          className="text-blue-400/20"
        />
        <circle
          cx="10"
          cy="10"
          r={radius}
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-blue-300 transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <span className="absolute text-[6px] font-black leading-none text-blue-100 tabular-nums">
        {safeProgress > 0 ? Math.round(safeProgress) : ''}
      </span>
    </span>
  );
}

interface SeriesCastModalProps {
  cast: SeriesCastMember[];
  language: string;
  seriesName: string;
  onClose: () => void;
}

export function SeriesCastModal({
  cast,
  language,
  seriesName,
  onClose,
}: SeriesCastModalProps) {
  return (
    <div
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={language === 'tr' ? 'Oyuncu Kadrosu' : 'Cast & Crew'}
      className="fixed inset-0 z-[4000] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in"
      onClick={onClose}
    >
      <div
        className="series-modal-sheet relative flex w-full max-w-lg flex-col gap-4 rounded-[22px] p-6 animate-scale-in"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-50 w-8 h-8 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          aria-label={language === 'tr' ? 'Kapat' : 'Close'}
        >
          ✕
        </button>

        <div className="flex flex-col text-left">
          <span className="text-[10px] uppercase tracking-widest font-extrabold text-neutral-500">
            {language === 'tr' ? 'Oyuncu Kadrosu' : 'Cast & Crew'}
          </span>
          <h3 className="text-lg font-black text-white mt-0.5 truncate max-w-[85%]">
            {seriesName}
          </h3>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mt-2 max-h-[360px] overflow-y-auto pr-1.5 custom-modal-scrollbar">
          {cast.map((member, index) => (
            <div
              key={`${member.name}-${index}`}
              className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center"
            >
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
  );
}
