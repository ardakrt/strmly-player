import { Activity, Download, HardDrive } from 'lucide-react';
import { CustomSelect, PageHeader } from '../SettingsControls';

interface SettingsDownloadsTabProps {
  language: 'tr' | 'en';
  t: (key: string) => string;
  downloadCount: number;
  completedCount: number;
  downloadsFolder: string;
  segmentConcurrency: number;
  downloadMaxHeight: number;
  onOpenDownloads: () => void;
  onSelectDownloadsFolder: () => void | Promise<void>;
  onChangeSegmentConcurrency: (value: number) => void;
  onChangeDownloadMaxHeight: (value: number) => void;
}

export function SettingsDownloadsTab({
  language,
  t,
  downloadCount,
  completedCount,
  downloadsFolder,
  segmentConcurrency,
  downloadMaxHeight,
  onOpenDownloads,
  onSelectDownloadsFolder,
  onChangeSegmentConcurrency,
  onChangeDownloadMaxHeight,
}: SettingsDownloadsTabProps) {
  return (
    <>
      <PageHeader title={language === 'tr' ? 'Kaydedilenler' : 'Saved'} description={t('settings.details.downloadsPage')} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.01] p-8 py-12 text-center shadow-xl backdrop-blur-md">
          <div className="mb-5 flex h-16 w-16 animate-pulse-slow items-center justify-center rounded-2xl border border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5 text-[var(--accent-color)] shadow-lg shadow-[var(--accent-color)]/5">
            <Download size={28} aria-hidden="true" />
          </div>
          <h3 className="text-base font-black tracking-wide text-white">{language === 'tr' ? 'Gelişmiş İndirme Yöneticisi' : 'Advanced Download Manager'}</h3>
          <p className="mt-2 max-w-sm text-xs font-medium leading-relaxed text-neutral-400">{t('settings.details.downloadManager')}</p>
          {downloadCount > 0 && (
            <div className="mb-8 mt-6 flex gap-6 rounded-xl border border-white/5 bg-black/30 px-6 py-3.5">
              <div className="text-center"><span className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'Ögeler' : 'Items'}</span><span className="mt-0.5 block text-sm font-black text-white">{downloadCount}</span></div>
              <div className="w-px bg-white/5" aria-hidden="true" />
              <div className="text-center"><span className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'Durum' : 'Status'}</span><span className="mt-0.5 block text-sm font-black text-emerald-400">{completedCount} {language === 'tr' ? 'Hazır' : 'Ready'}</span></div>
            </div>
          )}
          <button type="button" onClick={onOpenDownloads} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent-color)] px-6 text-xs font-black uppercase tracking-wider text-black shadow-lg shadow-[var(--accent-color)]/10 transition-all hover:scale-[1.02] active:scale-[0.98]">
            <Download size={14} strokeWidth={2.5} aria-hidden="true" /><span>{language === 'tr' ? 'Kaydedilenleri Yönet' : 'Manage Saved Media'}</span>
          </button>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-white/[0.01] p-6 text-left shadow-xl backdrop-blur-md">
          <div className="flex flex-col gap-1"><h4 className="flex items-center gap-2 text-sm font-black tracking-wide text-white"><HardDrive size={16} className="text-[var(--accent-color)]" aria-hidden="true" /><span>{language === 'tr' ? 'Kayıt Klasörü' : 'Save Directory'}</span></h4><p className="text-xs font-medium leading-relaxed text-neutral-400">{t('settings.details.downloadFolder')}</p></div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 truncate rounded-xl border border-white/5 bg-black/40 px-4 py-3 font-mono text-xs text-neutral-300 select-text">{downloadsFolder || (language === 'tr' ? 'Yükleniyor...' : 'Loading...')}</div>
            <button type="button" onClick={onSelectDownloadsFolder} className="flex h-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-bold text-white transition-all hover:border-white/20 hover:bg-white/10 active:scale-95">{language === 'tr' ? 'Konumu Değiştir' : 'Change Location'}</button>
          </div>
        </div>

        <div className="flex flex-col gap-5 rounded-2xl border border-white/5 bg-white/[0.01] p-6 text-left shadow-xl backdrop-blur-md">
          <div className="flex flex-col gap-1"><h4 className="flex items-center gap-2 text-sm font-black tracking-wide text-white"><Activity size={16} className="text-[var(--accent-color)]" aria-hidden="true" /><span>{language === 'tr' ? 'İndirme Performansı' : 'Download Performance'}</span></h4><p className="text-xs font-medium leading-relaxed text-neutral-400">{t('settings.details.downloadPerformance')}</p></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2"><span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'Segment paralelliği' : 'Segment concurrency'}</span><CustomSelect value={String(segmentConcurrency)} onChange={(value) => onChangeSegmentConcurrency(Math.min(8, Math.max(1, Number(value) || 6)))} options={[1, 2, 3, 4, 6, 8].map((value) => ({ value: String(value), label: language === 'tr' ? `${value} bağlantı` : `${value} connections` }))} /></div>
            <div className="flex flex-col gap-2"><span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'Maks. kalite (master HLS)' : 'Max quality (master HLS)'}</span><CustomSelect value={String(downloadMaxHeight)} onChange={(value) => onChangeDownloadMaxHeight(Number(value) || 1080)} options={[{ value: '480', label: '480p' }, { value: '720', label: '720p' }, { value: '1080', label: '1080p' }, { value: '2160', label: language === 'tr' ? 'En iyi (4K’ya kadar)' : 'Best (up to 4K)' }]} /></div>
          </div>
        </div>
      </div>
    </>
  );
}
