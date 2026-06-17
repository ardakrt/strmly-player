import { Search, Tv } from 'lucide-react';
import { QuadCell } from './QuadCell';
import type { PlaylistItem } from '../utils/m3uParser';

interface MultiScreenProps {
  multiLayout: '2x2' | 'side';
  setMultiLayout: (layout: '2x2' | 'side') => void;
  multiScreenSearchQuery: string;
  setMultiScreenSearchQuery: (query: string) => void;
  multiScreenMatches: PlaylistItem[];
  activeStreams: (PlaylistItem | null)[];
  selectedQuadIndex: number;
  setSelectedQuadIndex: (idx: number) => void;
  accentStyles: React.CSSProperties;
  onAssignStream: (channel: PlaylistItem) => void;
  onRemoveStream: (idx: number) => void;
}

export const MultiScreen = (props: MultiScreenProps) => {
  const {
    multiLayout, setMultiLayout,
    multiScreenSearchQuery, setMultiScreenSearchQuery,
    multiScreenMatches,
    activeStreams, selectedQuadIndex, setSelectedQuadIndex,
    accentStyles,
    onAssignStream, onRemoveStream
  } = props;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-fade-in flex-1">
      <div className="xl:col-span-1 bg-neutral-950/40 border border-white/5 rounded-3xl p-5 flex flex-col gap-4 max-h-[calc(100vh-10rem)] overflow-y-auto hide-scrollbar">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <span className="text-xs font-bold text-neutral-300">Yayını Aktif Hücreye Ata</span>
          <span className="px-2 py-0.5 bg-neutral-900 border border-white/5 rounded text-[9px] font-bold text-neutral-500 uppercase">
            Hücre {selectedQuadIndex + 1}
          </span>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Canlı kanal ara..."
            value={multiScreenSearchQuery}
            onChange={(e) => setMultiScreenSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-neutral-900/60 border border-white/5 focus:border-[var(--accent-color)] rounded-xl text-xs text-white placeholder-neutral-500 transition-all"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            onClick={() => setMultiLayout('2x2')}
            className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${
              multiLayout === '2x2' ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border-[var(--accent-color)]/25' : 'bg-neutral-900/40 border-white/5 text-neutral-400 hover:text-white'
            }`}
          >
            2x2 Düzen
          </button>
          <button
            onClick={() => setMultiLayout('side')}
            className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${
              multiLayout === 'side' ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border-[var(--accent-color)]/25' : 'bg-neutral-900/40 border-white/5 text-neutral-400 hover:text-white'
            }`}
          >
            Yan Panel
          </button>
        </div>
        <div className="flex flex-col gap-1.5 mt-2 max-h-[350px] overflow-y-auto hide-scrollbar pr-0.5">
          {multiScreenMatches.map(channel => (
            <div
              key={channel.id}
              onClick={() => onAssignStream(channel)}
              className="flex items-center gap-3 p-2 bg-neutral-900/30 hover:bg-white/5 border border-transparent hover:border-white/5 rounded-xl cursor-pointer transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center overflow-hidden shrink-0 border border-white/5">
                {channel.logo ? (
                  <img src={channel.logo} className="max-w-[75%] max-h-[75%] object-contain" onError={(e) => { (e.target as HTMLImageElement).src = ''; }} />
                ) : (
                  <Tv size={12} className="text-neutral-500" />
                )}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[11px] font-bold text-neutral-300 truncate">{channel.name}</span>
                <span className="text-[9px] text-neutral-500 truncate">{channel.group}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="xl:col-span-3 flex flex-col gap-4">
        {multiLayout === '2x2' ? (
          <div className="grid grid-cols-2 gap-4">
            {[0, 1, 2, 3].map(idx => (
              <QuadCell
                key={idx}
                cellIndex={idx}
                channel={activeStreams[idx]}
                isSelected={selectedQuadIndex === idx}
                onSelect={() => setSelectedQuadIndex(idx)}
                onRemove={() => onRemoveStream(idx)}
                accentStyles={accentStyles}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-4 h-full">
            <div className="flex-1">
              <QuadCell
                cellIndex={0}
                channel={activeStreams[0]}
                isSelected={selectedQuadIndex === 0}
                onSelect={() => setSelectedQuadIndex(0)}
                onRemove={() => onRemoveStream(0)}
                accentStyles={accentStyles}
              />
            </div>
            <div className="flex flex-col gap-3 w-full md:w-80 shrink-0">
              {[1, 2, 3].map(idx => (
                <QuadCell
                  key={idx}
                  cellIndex={idx}
                  channel={activeStreams[idx]}
                  isSelected={selectedQuadIndex === idx}
                  onSelect={() => setSelectedQuadIndex(idx)}
                  onRemove={() => onRemoveStream(idx)}
                  accentStyles={accentStyles}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
