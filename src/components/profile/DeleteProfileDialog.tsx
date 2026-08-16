import { Trash2 } from 'lucide-react';

interface Props {
  language: 'tr' | 'en';
  profileName: string;
  cancelLabel: string;
  title: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function DeleteProfileDialog({ cancelLabel, language, onCancel, onConfirm, profileName, title }: Props) {
  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 select-none animate-fade-in">
      <button type="button" aria-label={cancelLabel} className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-[#070709]/95 border border-white/10 rounded-[32px] p-6 md:p-8 flex flex-col items-center text-center shadow-[0_36px_130px_rgba(0,0,0,0.8)] z-10 overflow-hidden">
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-red-500/35 to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-20 w-56 h-56 rounded-full bg-red-500/5 blur-3xl pointer-events-none" />
        <div className="w-14 h-14 rounded-2xl bg-red-950/20 border border-red-500/20 flex items-center justify-center text-red-500 shadow-[0_12px_30px_rgba(239,68,68,0.1)] mb-5 animate-pulse">
          <Trash2 size={24} className="text-red-400" />
        </div>
        <h3 className="text-lg font-black text-white tracking-tight">{title}</h3>
        <p className="mt-3 text-xs md:text-sm text-neutral-400 leading-relaxed">
          {language === 'tr' ? <><strong className="text-white">"{profileName}"</strong> profilini ve bu profile ait tüm kişisel verileri (geçmiş, favoriler, playlistler) silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</> : <>Are you sure you want to delete <strong className="text-white">"{profileName}"</strong> and all personal data associated with it (history, favorites, playlists)? This action cannot be undone.</>}
        </p>
        <div className="mt-7 flex gap-3 w-full">
          <button type="button" onClick={onCancel} className="flex-1 h-11 rounded-2xl border border-white/10 hover:border-white/20 hover:bg-white/[0.035] text-xs font-bold tracking-wider uppercase transition-all cursor-pointer text-white">{cancelLabel}</button>
          <button type="button" onClick={() => void onConfirm()} className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-xs font-black tracking-wider uppercase transition-all cursor-pointer shadow-[0_14px_38px_rgba(239,68,68,0.15)]">{language === 'tr' ? 'Evet, Sil' : 'Yes, Delete'}</button>
        </div>
      </div>
    </div>
  );
}
