import { Activity } from 'lucide-react';
import type { PlaylistItem } from '../utils/m3uParser';
import type { SavedPlaylist } from '../types';

interface DiagnosticsViewProps {
  selectedGroup: string;
  searchQuery: string;
  items: PlaylistItem[];
  itemStats: { total: number; live: number; movie: number; series: number };
  playlists: SavedPlaylist[];
  activePlaylistId: string;
  isCheckingHealth: boolean;
  checkerLog: string[];
  runPlaylistDiagnostics: () => void;
}

export function DiagnosticsView({
  selectedGroup,
  searchQuery,
  items,
  itemStats,
  playlists,
  activePlaylistId,
  isCheckingHealth,
  checkerLog,
  runPlaylistDiagnostics
}: DiagnosticsViewProps) {
  if (selectedGroup !== 'İstatistikler' || searchQuery.trim() !== '') return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
      <div className="lg:col-span-1 flex flex-col gap-6">
        <div className="bg-neutral-950/40 border border-white/5 rounded-[28px] p-6 flex flex-col gap-5 shadow-lg">
          <span className="text-[10px] tracking-widest font-extrabold text-neutral-500 uppercase">Dağılım İstatistikleri</span>

          <div className="flex flex-col gap-4">
            {[
              { label: 'Canlı TV Kanalları', count: itemStats.live, color: 'bg-neutral-100' },
              { label: 'Sinema Filmleri (VOD)', count: itemStats.movie, color: 'bg-neutral-400' },
              { label: 'Televizyon Dizileri', count: itemStats.series, color: 'bg-neutral-600' }
            ].map((stat, idx) => {
              const pct = items.length ? (stat.count / items.length) * 100 : 0;
              return (
                <div key={idx} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-300">{stat.label}</span>
                    <span className="text-neutral-500 font-bold">{stat.count} Öğe (%{pct.toFixed(0)})</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${stat.color}`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-white/5 pt-4 mt-1 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Toplam Çözümlenen Kanal:</span>
              <span className="font-bold text-white">{itemStats.total}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Aktif Çalma Listesi:</span>
              <span className="font-bold text-[var(--accent-color)]">
                {playlists.find(p => p.id === activePlaylistId)?.name || 'YOK'}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="lg:col-span-2 bg-neutral-950/40 border border-white/5 rounded-[28px] p-6 flex flex-col gap-4 shadow-lg h-full min-h-[400px]">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex flex-col">
            <span className="text-[10px] tracking-widest font-extrabold text-neutral-500 uppercase">Bağlantı Sağlık Kontrolü</span>
            <span className="text-[10px] text-neutral-400 mt-0.5">M3U listesindeki ilk 20 kanalın yanıt hızı ve aktiflik durumları asenkron denetlenir.</span>
          </div>

          <button
            onClick={runPlaylistDiagnostics}
            disabled={isCheckingHealth}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 ${isCheckingHealth ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-white text-black hover:bg-neutral-200'
              }`}
          >
            {isCheckingHealth ? 'Test Ediliyor...' : 'Sağlık Testini Başlat'}
          </button>
        </div>
        <div className="flex-1 bg-black/60 border border-white/5 rounded-2xl p-4 font-mono text-[11px] text-neutral-400 overflow-y-auto max-h-[300px] flex flex-col gap-1 shadow-inner">
          {checkerLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-12 h-full text-neutral-600">
              <Activity size={24} className="mb-2 opacity-50" />
              <span>Terminal hazırdır. Testi başlatmak için butona basın.</span>
            </div>
          ) : (
            checkerLog.map((log, idx) => (
              <div key={idx} className="leading-relaxed whitespace-pre-wrap">{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
