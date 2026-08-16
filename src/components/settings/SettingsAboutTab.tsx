import { ExternalLink, FileText, Globe } from "lucide-react";
import { PageHeader } from "../SettingsControls";

export interface SettingsUpdateState {
  status: "idle" | "checking" | "available" | "downloading" | "not-available" | "downloaded" | "error";
  message: string;
  version?: string;
  progress?: number;
}

interface SettingsAboutTabProps {
  language: "tr" | "en";
  t: (key: string) => string;
  appVersion: string;
  updateState: SettingsUpdateState;
  onCheckUpdates: () => void;
  onInstallUpdate: () => void;
}

const primaryAction = "h-11 w-full rounded-xl bg-white px-6 text-xs font-extrabold uppercase tracking-wider text-black outline-none transition-colors duration-150 hover:bg-neutral-200 active:bg-neutral-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)]";

export function SettingsAboutTab({
  language,
  t,
  appVersion,
  updateState,
  onCheckUpdates,
  onInstallUpdate,
}: SettingsAboutTabProps) {
  return (
    <>
      <PageHeader
        title={language === "tr" ? "Strmly Hakkında" : "About Strmly"}
        description={language === "tr" ? "Sürüm bilgisi, güncellemeler ve proje bağlantıları." : "Version information, updates, and project links."}
      />
      <div className="relative flex flex-col items-center overflow-hidden py-8 text-center">
        <div className="group relative mb-4">
          <div className="settings-brand-logo-shell flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/15 bg-neutral-950 transition-transform duration-150 group-hover:scale-[1.03]">
            <img src="./icon.png" className="h-16 w-16 object-contain" alt="Strmly" />
          </div>
          <span className="absolute -bottom-2.5 left-1/2 w-max -translate-x-1/2 rounded-full border border-white/15 bg-neutral-900 px-3 py-0.5 text-[10px] font-black tracking-wider text-white shadow-lg">v{appVersion}</span>
        </div>
        <h3 className="mt-3 text-3xl font-black not-italic leading-none tracking-tight text-white">STRMLY</h3>
        <p className="mt-4 max-w-lg text-xs font-medium leading-relaxed text-neutral-400">{t("settings.details.about")}</p>

        <div className="mt-8 flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6 shadow-2xl">
          <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:flex-row">
            <a href="https://github.com/ardakrt/strmly-player" target="_blank" rel="noopener noreferrer" className="inline-flex h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-bold text-neutral-200 outline-none transition-colors duration-150 hover:border-white/20 hover:bg-white/[0.08] active:bg-white/[0.11] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)]">
              <Globe size={14} aria-hidden="true" /><span>GitHub</span><ExternalLink size={11} className="opacity-60" aria-hidden="true" />
            </a>
            <a href="https://github.com/ardakrt/strmly-player/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="inline-flex h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-bold text-neutral-200 outline-none transition-colors duration-150 hover:border-white/20 hover:bg-white/[0.08] active:bg-white/[0.11] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)]">
              <FileText size={14} aria-hidden="true" /><span>{language === "tr" ? "Lisans" : "License"}</span><ExternalLink size={11} className="opacity-60" aria-hidden="true" />
            </a>
          </div>
          <div className="h-px w-full bg-white/5" aria-hidden="true" />
          <div className="flex w-full flex-col items-center gap-3" aria-live="polite">
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">{language === "tr" ? "Uygulama güncellemesi" : "Application update"}</span>
              {updateState.status !== "idle" && (
                <p className="mt-0.5 text-xs font-semibold text-neutral-300">
                  {updateState.status === "available" ? t("settings.updates.available").replace("{{version}}", updateState.version || "") : updateState.message}
                </p>
              )}
            </div>
            {updateState.status === "idle" && <button type="button" onClick={onCheckUpdates} className={primaryAction}>{language === "tr" ? "Güncellemeleri denetle" : "Check for updates"}</button>}
            {updateState.status === "checking" && <div className="my-1 h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" role="status" aria-label={language === "tr" ? "Güncellemeler denetleniyor" : "Checking for updates"} />}
            {updateState.status === "available" && <button type="button" onClick={onInstallUpdate} className={primaryAction}>{language === "tr" ? "Güncelle" : "Update"}</button>}
            {updateState.status === "downloading" && (
              <div className="mt-1 flex w-full flex-col gap-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={language === "tr" ? "Güncelleme indirme ilerlemesi" : "Update download progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(updateState.progress ?? 0)}>
                  <div className="h-full bg-[var(--accent-color)] transition-[width] duration-300" style={{ width: `${updateState.progress ?? 0}%` }} />
                </div>
                <span className="text-right text-[10px] font-extrabold text-neutral-500">%{Math.round(updateState.progress ?? 0)} {language === "tr" ? "indiriliyor" : "downloading"}</span>
              </div>
            )}
            {updateState.status === "downloaded" && <button type="button" onClick={onInstallUpdate} className="h-11 w-full rounded-xl bg-emerald-500 px-6 text-xs font-extrabold uppercase tracking-wider text-white outline-none transition-colors duration-150 hover:bg-emerald-600 active:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{language === "tr" ? "Kur ve yeniden başlat" : "Install and restart"}</button>}
            {(updateState.status === "not-available" || updateState.status === "error") && <button type="button" onClick={onCheckUpdates} className="h-11 w-full rounded-xl bg-white/10 px-6 text-xs font-extrabold uppercase tracking-wider text-white outline-none transition-colors duration-150 hover:bg-white/20 active:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)]">{language === "tr" ? "Yeniden denetle" : "Check again"}</button>}
          </div>
        </div>
        <p className="mt-6 select-none text-[10px] font-semibold text-neutral-600">© 2026 Strmly</p>
      </div>
    </>
  );
}
