export interface MoveDownloadsProgress {
  percent: number;
  currentFile: string;
  filesMoved: number;
  totalFiles: number;
}

interface MoveDownloadsDialogProps {
  language: 'tr' | 'en';
  t: (key: string) => string;
  folderPath: string;
  activeAccent: string;
  moveExisting: boolean;
  isMoving: boolean;
  progress: MoveDownloadsProgress | null;
  onToggleMoveExisting: () => void;
  onCancel: () => void;
  onApply: () => void | Promise<void>;
}

export function MoveDownloadsDialog({ language, t, folderPath, activeAccent, moveExisting, isMoving, progress, onToggleMoveExisting, onCancel, onApply }: MoveDownloadsDialogProps) {
  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none">
      <div className="relative flex w-full max-w-md flex-col gap-5 rounded-3xl border border-white/10 bg-neutral-950 p-6 text-left shadow-2xl">
        <div className="flex flex-col gap-1.5"><h3 className="text-lg font-black leading-tight text-white">{language === 'tr' ? 'İndirme Konumunu Değiştir' : 'Change Download Directory'}</h3><p className="text-xs font-medium leading-relaxed text-neutral-400">{language === 'tr' ? `Yeni klasör konumu: ${folderPath}` : `New directory location: ${folderPath}`}</p></div>
        {isMoving ? (
          <div className="flex flex-col gap-4 py-2 text-left">
            <div className="flex items-center justify-between text-xs font-bold text-white"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent" /><span>{language === 'tr' ? 'Dosyalar Taşınıyor...' : 'Moving Files...'}</span></span><span>%{progress?.percent ?? 0}</span></div>
            <div className="h-3 w-full overflow-hidden rounded-full border border-white/5 bg-white/5 p-0.5" role="progressbar" aria-label={language === 'tr' ? 'Dosya taşıma ilerlemesi' : 'File move progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress?.percent ?? 0}><div className="h-full rounded-full bg-[var(--accent-color)] shadow-[0_0_8px_var(--accent-glow)] transition-[width] duration-300" style={{ width: `${progress?.percent ?? 0}%` }} /></div>
            <div className="mt-1 flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/[0.01] p-3"><div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-400"><span>{language === 'tr' ? 'Taşınan Ögeler' : 'Moved Items'}</span><span className="text-white">{progress ? `${progress.filesMoved} / ${progress.totalFiles}` : '0 / 0'}</span></div>{progress?.currentFile && <div className="mt-1 truncate border-t border-white/5 pt-1.5 font-mono text-[10px] leading-relaxed text-neutral-500 select-text"><span className="font-bold text-neutral-400">{language === 'tr' ? 'Dosya:' : 'File:'}</span> {progress.currentFile}</div>}</div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4"><div className="flex flex-col gap-0.5"><span className="text-xs font-bold text-white">{language === 'tr' ? 'Mevcut Dosyaları Taşı' : 'Move Existing Files'}</span><span className="text-[10px] font-medium text-neutral-500">{t('settings.details.moveExisting')}</span></div><button type="button" role="switch" aria-checked={moveExisting} aria-label={language === 'tr' ? 'Mevcut dosyaları taşı' : 'Move existing files'} onClick={onToggleMoveExisting} className={`relative h-6.5 w-12 rounded-full border p-[3px] transition-all duration-300 ${moveExisting ? 'border-transparent shadow-[0_0_12px_var(--accent-glow)]' : 'border-white/10 bg-black/40 hover:border-white/20'}`} style={moveExisting ? { backgroundColor: 'var(--accent-color)' } : {}}><span className={`block h-4.5 w-4.5 rounded-full shadow-md transition-transform duration-300 ${moveExisting ? 'translate-x-5' : 'translate-x-0'}`} style={{ backgroundColor: moveExisting ? (activeAccent === '#FFFFFF' || activeAccent === '#fff' ? '#000000' : '#FFFFFF') : '#9CA3AF' }} /></button></div>
        )}
        {!isMoving ? <div className="mt-2 flex items-center gap-3"><button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 text-center text-xs font-bold text-white transition-all hover:border-white/20 hover:bg-white/10">{language === 'tr' ? 'İptal' : 'Cancel'}</button><button type="button" onClick={onApply} className="flex-1 rounded-xl bg-white py-3 text-center text-xs font-black uppercase tracking-wider text-black transition-all hover:bg-neutral-200">{language === 'tr' ? 'Uygula' : 'Apply'}</button></div> : <div className="mt-1 text-center text-[10px] font-medium text-neutral-500">{t('settings.details.transferWarning')}</div>}
      </div>
    </div>
  );
}
