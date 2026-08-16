import { memo, useEffect, useState } from 'react';
import { X, RefreshCw, FileText } from 'lucide-react';
import { getTranslation } from '../utils/translations';
import type { Language } from '../utils/translations';

interface UpdateToastProps {
  visible: boolean;
  version: string;
  releaseNotes?: string;
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
  progressPercent: number;
  downloadSpeed: string;
  errorMessage?: string;
  onInstall: () => Promise<void> | void;
  onDismiss: () => void;
  language: Language;
}

export const UpdateToast = memo(function UpdateToast({
  visible,
  version,
  releaseNotes,
  status,
  progressPercent,
  downloadSpeed,
  errorMessage,
  onInstall,
  onDismiss,
  language,
}: UpdateToastProps) {
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!visible || status !== 'available') setIsStarting(false);
  }, [status, visible]);

  if (!visible || status === 'idle' || status === 'checking') return null;

  const handleInstallClick = async () => {
    setIsStarting(true);
    try {
      await onInstall();
    } catch {
      setIsStarting(false);
    }
  };

  const isDownloading = status === 'downloading';
  const isDownloaded = status === 'downloaded';
  const isError = status === 'error';

  return (
    <div
      role="status"
      aria-live="polite"
      className="update-toast-glass fixed bottom-5 right-5 z-layer-toast w-[356px] max-w-[calc(100vw-2.5rem)] rounded-3xl p-4 text-white select-none"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* App Logo Pill Icon */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-black/40 p-1.5 shadow-inner">
            <img src="./icon.png" alt="Strmly" className="w-full h-full object-contain" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] leading-tight font-extrabold text-white">
                {isError
                  ? getTranslation('updateToast.error', language)
                  : getTranslation('updateToast.title', language)}
              </span>
              {version && (
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/10 shrink-0 whitespace-nowrap">
                  v{version}
                </span>
              )}
            </div>

            <p className="text-[11px] leading-relaxed font-medium text-neutral-300/80 mt-1">
              {isError
                ? errorMessage || getTranslation('updateToast.errorDescription', language)
                : isDownloaded
                ? getTranslation('updateToast.installing', language)
                : isDownloading
                ? `${getTranslation('updateToast.downloading', language).replace('{{percent}}', String(progressPercent))}${downloadSpeed ? ` (${downloadSpeed})` : ''}`
                : getTranslation('updateToast.subtitle', language)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          title={getTranslation('updateToast.later', language)}
          aria-label={getTranslation('updateToast.later', language)}
        >
          <X size={14} />
        </button>
      </div>

      {/* GitHub Release Notes Section */}
      {releaseNotes && !isError && (
        <div className="mt-3 max-h-24 overflow-y-auto rounded-2xl bg-white/[0.04] border border-white/10 p-2.5 text-[11px] leading-relaxed hide-scrollbar">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white/40 mb-1">
            <FileText size={11} />
            <span>{language === 'tr' ? 'Güncelleme Notları' : 'Release Notes'}</span>
          </div>
          <div className="whitespace-pre-line text-neutral-300 font-medium text-[11px]">
            {releaseNotes}
          </div>
        </div>
      )}

      {/* Liquid Progress Bar */}
      {(isDownloading || progressPercent > 0) && !isDownloaded && !isError && (
        <div className="mt-3.5 w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, Math.max(0, progressPercent))}%`,
            }}
          />
        </div>
      )}

      {/* Action Buttons: Short labels that NEVER wrap */}
      <div className="mt-3.5 flex items-center justify-end gap-2">
        {status === 'available' && (
          <button
            type="button"
            onClick={onDismiss}
            className="h-8 rounded-full border border-white/10 bg-white/[0.06] px-4 text-[11px] font-extrabold uppercase tracking-wider text-white transition-colors hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {getTranslation('updateToast.later', language)}
          </button>
        )}

        {!isError && (
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={isStarting || isDownloading || isDownloaded}
            className="flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-5 text-[11px] font-extrabold uppercase tracking-wider text-black shadow-md transition-colors hover:bg-neutral-200 active:bg-neutral-300 disabled:cursor-wait disabled:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {isStarting || isDownloading || isDownloaded ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                <span>{isDownloaded ? getTranslation('updateToast.installingShort', language) : `%${progressPercent}`}</span>
              </>
            ) : (
              <span>{getTranslation('updateToast.updateBtn', language)}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
});
