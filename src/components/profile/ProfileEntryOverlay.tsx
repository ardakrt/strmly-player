import { Check, LoaderCircle, UserRound } from 'lucide-react';
import type { Profile } from '../../types';
import type { ProfileSetupStatus } from '../../hooks/useProfiles';
import { contentPreferenceIds } from './profileScreenTypes';

interface Props {
  avatar: string;
  enteringProfile: Profile | null;
  entryStage: number;
  language: 'tr' | 'en';
  profileName: string;
  setupStatus: ProfileSetupStatus;
  setupMayTakeTimeMessage: string;
  t: (key: string) => string;
}

export function ProfileEntryOverlay({ avatar, enteringProfile, entryStage, language, profileName, setupStatus, setupMayTakeTimeMessage, t }: Props) {
  return (
        <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-xl flex items-center justify-center p-5 animate-fade-in select-none">
          {setupStatus.active ? (
            <div className="relative w-full max-w-[520px] overflow-hidden rounded-[32px] border border-white/12 bg-[#09090b]/95 p-6 md:p-8 shadow-[0_36px_130px_rgba(0,0,0,0.8)]">
              <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              <div className="absolute -top-24 -right-20 w-56 h-56 rounded-full bg-[var(--accent-color)] opacity-[0.07] blur-3xl pointer-events-none" />

              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/15 bg-white/[0.06] flex items-center justify-center shrink-0 shadow-xl">
                  {avatar ? (
                    avatar.startsWith('linear-gradient') ? (
                      <div className="w-full h-full" style={{ background: avatar }} />
                    ) : (
                      <img src={avatar} className="w-full h-full object-cover" alt="" />
                    )
                  ) : (
                    <UserRound size={22} className="text-neutral-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">{profileName || 'Yeni Profil'}</span>
                  <h3 className="mt-1 text-xl font-black text-white tracking-tight">{setupStatus.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-400">{setupStatus.detail}</p>
                </div>
              </div>

              <div className="relative mt-7 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-[var(--accent-color)] shadow-[0_0_18px_var(--accent-glow)] transition-[width] duration-500 ease-out"
                  style={{ width: `${setupStatus.progress ?? Math.max(8, setupStatus.step * 20)}%` }}
                />
              </div>

              <div className="mt-6 grid grid-cols-5 gap-2">
                {[
                  language === 'tr' ? 'Bağlantı' : 'Connection',
                  language === 'tr' ? 'İçerikler' : 'Content',
                  language === 'tr' ? 'Kayıt' : 'Save',
                  'TMDB',
                  language === 'tr' ? 'Hazır' : 'Ready'
                ].map((label, index) => {
                  const step = index + 1;
                  const completed = setupStatus.step > step;
                  const active = setupStatus.step === step;
                  return (
                    <div key={label} className="flex flex-col items-center gap-2 text-center">
                      <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                        completed
                          ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-black'
                          : active
                            ? 'bg-white/10 border-white/30 text-white shadow-[0_0_22px_rgba(255,255,255,0.10)]'
                            : 'bg-black/20 border-white/8 text-neutral-600'
                      }`}>
                        {completed ? <Check size={14} strokeWidth={3} /> : active ? <LoaderCircle size={14} className="animate-spin" /> : <span className="text-[10px] font-black">{step}</span>}
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${active || completed ? 'text-neutral-300' : 'text-neutral-600'}`}>{label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-7 flex items-center justify-between gap-4 border-t border-white/8 pt-4">
                <span className="text-[10px] leading-relaxed text-neutral-500">
                  {setupMayTakeTimeMessage}
                </span>
                {setupStatus.itemCount !== undefined && (
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] font-black text-neutral-300">
                    {language === 'tr'
                      ? `${setupStatus.itemCount.toLocaleString('tr-TR')} içerik`
                      : `${setupStatus.itemCount.toLocaleString('en-US')} items`}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 overflow-hidden bg-[#030304] flex items-center justify-center">
              {enteringProfile && (
                <>
                  <div className="absolute inset-0 scale-110 opacity-30">
                    {enteringProfile.avatarUrl.startsWith('linear-gradient') ? (
                      <div className="w-full h-full" style={{ background: enteringProfile.avatarUrl }} />
                    ) : (
                      <img src={enteringProfile.avatarUrl} className="w-full h-full object-cover blur-[100px] scale-125 saturate-150" alt="" />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(to_bottom,rgba(0,0,0,0.54),rgba(0,0,0,0.90))]" />
                </>
              )}
              <div className="absolute inset-0 shadow-[inset_0_0_240px_100px_rgba(0,0,0,0.8)]" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

              <div className="relative z-10 w-full max-w-[400px] px-8 py-10 rounded-[36px] border border-white/10 bg-[#09090b]/72 backdrop-blur-2xl shadow-[0_32px_100px_rgba(0,0,0,0.7)] flex flex-col items-center text-center animate-fade-in">
                <div className="mb-8 flex items-center gap-2.5 text-white/60">
                  <img src="./icon.png" className="w-6 h-6 object-contain opacity-80" alt="" />
                  <span className="text-[10px] font-black tracking-[0.28em]">STRMLY</span>
                </div>

                <div className="relative">
                  <div className="absolute -inset-2 rounded-[34px] bg-[var(--accent-color)]/5 blur-xl" />
                  <div className="relative w-24 h-24 rounded-[28px] overflow-hidden border-2 border-white/20 bg-neutral-950 shadow-[0_24px_70px_rgba(0,0,0,0.6)]">
                    {enteringProfile ? (
                      enteringProfile.avatarUrl.startsWith('linear-gradient') ? (
                        <div className="w-full h-full" style={{ background: enteringProfile.avatarUrl }} />
                      ) : (
                        <img src={enteringProfile.avatarUrl} className="w-full h-full object-cover" alt={enteringProfile.name} />
                      )
                    ) : (
                      <UserRound size={30} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-neutral-500" />
                    )}
                  </div>
                </div>

                <span className="mt-6 text-[8px] font-black uppercase tracking-[0.24em] text-neutral-500">{t('profiles.entry.welcome')}</span>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-white">{enteringProfile?.name || t('profiles.entry.fallbackName')}</h2>

                {enteringProfile?.contentPreferences?.length ? (
                  <div className="mt-3.5 flex flex-wrap justify-center gap-1.5">
                    {(() => {
                      const prefsSet = new Set(enteringProfile.contentPreferences || []);
                      return contentPreferenceIds.filter(id => prefsSet.has(id)).map(id => {
                        const optLabel = t(`profiles.contentTypes.${id}`);
                        return (
                          <span key={id} className="rounded-full border border-white/5 bg-white/[0.04] px-2.5 py-1 text-[8px] font-bold text-neutral-400">{optLabel}</span>
                        );
                      });
                    })()}
                  </div>
                ) : null}

                <div className="mt-8 w-full max-w-[260px]">
                  <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full transition-[width] duration-750 ease-out"
                      style={{ 
                        width: `${[28, 58, 92, 100][entryStage]}%`,
                        backgroundColor: 'var(--accent-color)',
                        boxShadow: '0 0 10px var(--accent-glow)'
                      }}
                    />
                  </div>
                  <div className="mt-3.5 flex items-center justify-center gap-2">
                    <span className="relative flex w-1.5 h-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: 'var(--accent-color)' }} />
                      <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent-color)' }} />
                    </span>
                    <span className="text-[10px] font-bold tracking-wide text-neutral-400">
                      {[
                        t('profiles.entry.preparingProfile'),
                        t('profiles.entry.loadingLibrary'),
                        t('profiles.entry.preparingHome'),
                        t('profiles.entry.ready')
                      ][entryStage]}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
  );
}
