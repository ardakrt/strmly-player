import { useState } from 'react';
import { FileText, HelpCircle, Link as LinkIcon, Server, ShieldCheck, UploadCloud, X } from 'lucide-react';

interface HomeEmptyStateProps {
  t: (key: string) => string;
  onOpenPlaylistSetup: () => void;
}

export function HomeEmptyState({ t, onOpenPlaylistSetup }: HomeEmptyStateProps) {
  const [showGuideModal, setShowGuideModal] = useState(false);
  return (
    <div className="w-full min-h-[calc(100vh-100px)] flex flex-col items-center justify-center text-center pt-24 md:pt-32 pb-16 px-4 md:px-8 max-w-4xl mx-auto animate-fade-in relative">
      {/* Subtle Ambient Radial Glows in the background */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Central Icon Emblem */}
      <div className="relative z-10 w-20 h-20 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl flex items-center justify-center shadow-2xl mb-8 group hover:scale-105 transition-transform duration-300">
        <div className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center shadow-lg">
          <UploadCloud size={26} />
        </div>
      </div>

      {/* Main Title & Subtitle */}
      <div className="relative z-10 flex flex-col items-center gap-4 max-w-2xl">
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
          {t('home.setup.title')}
        </h1>
        <p className="text-sm md:text-base text-neutral-400 leading-relaxed font-normal max-w-xl">
          {t('home.setup.description')}
        </p>
      </div>

      {/* Primary Action Buttons */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-4 mt-8">
        <button
          type="button"
          onClick={onOpenPlaylistSetup}
          className="h-13 px-9 rounded-full bg-white text-black hover:bg-neutral-100 transition-all duration-300 font-extrabold text-xs md:text-sm flex items-center justify-center gap-3 shadow-[0_0_35px_rgba(255,255,255,0.25)] hover:shadow-[0_0_45px_rgba(255,255,255,0.4)] active:scale-95 cursor-pointer"
        >
          <UploadCloud size={18} /> {t('home.setup.addPlaylist')}
        </button>
        <button
          type="button"
          onClick={() => setShowGuideModal(true)}
          className="h-13 px-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 transition-all duration-300 font-bold text-xs text-white backdrop-blur-md flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
        >
          <HelpCircle size={17} className="text-white/70" />
          {t('home.setup.requiredDetails')}
        </button>
      </div>

      {/* Minimal 3 Connection Pills (Centered horizontal row) */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 mt-12 pt-8 border-t border-white/5 w-full max-w-xl">
        <button
          type="button"
          onClick={onOpenPlaylistSetup}
          className="group px-4 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all flex items-center gap-2.5 cursor-pointer text-left"
        >
          <Server size={16} className="text-cyan-400 shrink-0" />
          <span className="text-xs font-semibold text-white/90 group-hover:text-cyan-300 transition-colors">Xtream Codes</span>
        </button>

        <button
          type="button"
          onClick={onOpenPlaylistSetup}
          className="group px-4 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all flex items-center gap-2.5 cursor-pointer text-left"
        >
          <LinkIcon size={16} className="text-purple-400 shrink-0" />
          <span className="text-xs font-semibold text-white/90 group-hover:text-purple-300 transition-colors">M3U / M3U8 URL</span>
        </button>

        <button
          type="button"
          onClick={onOpenPlaylistSetup}
          className="group px-4 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all flex items-center gap-2.5 cursor-pointer text-left"
        >
          <FileText size={16} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold text-white/90 group-hover:text-emerald-300 transition-colors">Yerel M3U</span>
        </button>
      </div>

      {/* QUICK GUIDE / INFO MODAL (Glassmorphic & Minimal) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-fade-in text-left">
          <div className="relative w-full max-w-lg bg-neutral-950/85 border border-white/15 rounded-[28px] p-6 md:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.8)] backdrop-blur-2xl flex flex-col gap-6 overflow-hidden">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              aria-label={t('common.close')}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer z-10"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="relative z-10 flex flex-col gap-1 pr-8">
              <h3 className="text-lg font-black text-white tracking-tight">
                {t('home.setup.guideTitle')}
              </h3>
              <p className="text-xs text-neutral-400">
                {t('home.setup.guideDescription')}
              </p>
            </div>

            {/* Minimal Info Items (Glass Tiles) */}
            <div className="relative z-10 flex flex-col gap-3 text-xs text-neutral-300 leading-relaxed max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
              <div className="p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/5 transition-colors flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Server size={18} />
                </div>
                <div>
                  <span className="font-bold text-white block text-xs">
                    1. {t('home.setup.xtreamTitle')}
                  </span>
                  <p className="text-neutral-400 text-[11px] mt-0.5">
                    {t('home.setup.xtreamDescription')}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/5 transition-colors flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                  <LinkIcon size={18} />
                </div>
                <div>
                  <span className="font-bold text-white block text-xs">
                    2. {t('home.setup.m3uUrlTitle')}
                  </span>
                  <p className="text-neutral-400 text-[11px] mt-0.5">
                    {t('home.setup.m3uUrlDescription')}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/5 transition-colors flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText size={18} />
                </div>
                <div>
                  <span className="font-bold text-white block text-xs">
                    3. {t('home.setup.localFileTitle')}
                  </span>
                  <p className="text-neutral-400 text-[11px] mt-0.5">
                    {t('home.setup.localFileDescription')}
                  </p>
                </div>
              </div>

              {/* Privacy Guarantee Pill */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-3 backdrop-blur-md mt-1">
                <ShieldCheck size={18} className="shrink-0 text-emerald-400" />
                <span>
                  {t('home.setup.privacy')}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="relative z-10 flex items-center justify-end gap-3 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                {t('common.close')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGuideModal(false);
                  onOpenPlaylistSetup();
                }}
                className="px-6 py-2.5 rounded-full bg-white text-black font-extrabold text-xs hover:bg-neutral-200 transition-colors flex items-center gap-2 shadow-lg cursor-pointer active:scale-95"
              >
                <UploadCloud size={15} />
                {t('home.setup.addYourPlaylist')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
