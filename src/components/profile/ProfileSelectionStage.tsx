import { ArrowUpRight, Pencil, Plus, Settings2, UserRound } from 'lucide-react';
import type { Profile } from '../../types';
import { getPreferenceLabel } from './profileScreenTypes';

interface Props {
  focusedProfileId: string | null;
  language: 'tr' | 'en';
  mode: 'select' | 'manage';
  profiles: Profile[];
  t: (key: string) => string;
  onCreate: () => void;
  onEdit: (profile: Profile) => void;
  onEnter: (profile: Profile) => void;
  onFocusProfile: (id: string | null) => void;
  onModeChange: (mode: 'select' | 'manage') => void;
  onOpenContextMenu: (event: React.MouseEvent, profile: Profile) => void;
}

export function ProfileSelectionStage(props: Props) {
  const {
    focusedProfileId, language, mode, onCreate, onEdit, onEnter,
    onFocusProfile, onModeChange, onOpenContextMenu, profiles, t,
  } = props;
  return (
    <>
      <ProfileAmbient profiles={profiles} focusedProfileId={focusedProfileId} />
      <div className="flex-1 z-10 overflow-y-auto hide-scrollbar select-none page-transition-enter w-full">
        <div className="relative min-h-full w-full max-w-[1500px] mx-auto px-5 sm:px-8 md:px-12 py-6 sm:py-8 md:py-10 flex flex-col">
          <header className="flex w-full items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3" aria-label="Strmly">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.06] shadow-[0_12px_40px_rgba(0,0,0,0.32)]">
                <img src="./icon.png" className="h-7 w-7 object-contain" alt="" />
              </div>
              <span className="truncate text-sm font-black tracking-[0.18em] text-white/90">STRMLY</span>
            </div>
            {mode === 'select' ? (
              <button type="button" onClick={() => onModeChange('manage')} aria-label={t('profiles.editProfiles')}
                className="flex h-11 w-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.035] text-xs font-bold text-neutral-300 transition-[background-color,color,border-color] duration-200 hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)] sm:w-auto sm:px-4 motion-reduce:transition-none">
                <Settings2 size={14} /> <span className="hidden sm:inline">{t('profiles.editProfiles')}</span>
              </button>
            ) : (
              <button type="button" onClick={() => onModeChange('select')}
                className="min-h-11 whitespace-nowrap rounded-full bg-white px-5 text-xs font-black text-black transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)] active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none">
                {t('profiles.finish')}
              </button>
            )}
          </header>

          <main className="flex flex-1 flex-col items-center justify-center py-12 sm:py-16 md:py-20">
            <div className="mb-9 flex max-w-2xl flex-col items-center text-center md:mb-12">
              {mode === 'manage' && <span className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-[var(--accent-color)]">{language === 'tr' ? 'Düzenleme modu' : 'Edit mode'}</span>}
              <h1 className="min-w-0 [overflow-wrap:anywhere] text-4xl font-black leading-none tracking-[-0.045em] text-white sm:text-5xl md:text-6xl">{mode === 'manage' ? t('profiles.editProfiles') : t('profiles.title')}</h1>
              {mode === 'manage' && <p className="mt-4 max-w-lg text-sm leading-relaxed text-neutral-400">{language === 'tr' ? 'Ayarlarını değiştirmek istediğin profili seç.' : 'Choose the profile whose settings you want to change.'}</p>}
            </div>
            {mode === 'manage' && profiles.length === 0 ? (
              <EmptyManageState language={language} message={t('profiles.messages.noProfilesToEditDescription')} onCreate={onCreate} />
            ) : (
              <div className="w-full flex flex-wrap items-center justify-center gap-4 sm:gap-5 md:gap-7">
                {profiles.map(profile => (
                  <ProfileCard key={profile.id} profile={profile} focused={focusedProfileId === profile.id} language={language} mode={mode}
                    onFocus={() => onFocusProfile(profile.id)} onContextMenu={event => onOpenContextMenu(event, profile)}
                    onClick={() => mode === 'manage' ? onEdit(profile) : onEnter(profile)} />
                ))}
                {profiles.length < 5 && mode === 'select' && <AddProfileCard focused={focusedProfileId === null} label={t('profiles.newProfile')} onCreate={onCreate} onFocus={() => onFocusProfile(null)} />}
              </div>
            )}
            {mode === 'select' && profiles.length > 0 && <div className="mt-9 hidden items-center gap-2 text-[11px] font-semibold text-neutral-500 sm:flex md:mt-12"><span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-neutral-300">Enter</span><span>{language === 'tr' ? 'ile devam et' : 'to continue'}</span></div>}
          </main>
        </div>
      </div>
    </>
  );
}

function ProfileAmbient({ profiles, focusedProfileId }: { profiles: Profile[]; focusedProfileId: string | null }) {
  return <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">{profiles.map(profile => <div key={`ambient-${profile.id}`} className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${focusedProfileId === profile.id ? 'opacity-100' : 'opacity-0'}`}><div className="absolute left-1/2 top-[52%] h-[58vh] w-[34vw] min-w-[280px] max-w-[620px] -translate-x-1/2 -translate-y-1/2 opacity-70">{profile.avatarUrl.startsWith('linear-gradient') ? <div className="h-full w-full rounded-[44%] blur-[140px] opacity-[0.14]" style={{ background: profile.avatarUrl }} /> : profile.avatarUrl ? <img src={profile.avatarUrl} className="h-full w-full rounded-[44%] object-cover blur-[140px] opacity-[0.12] saturate-75" alt="" /> : null}</div></div>)}</div>;
}

function ProfileCard({ profile, focused, language, mode, onClick, onContextMenu, onFocus }: { profile: Profile; focused: boolean; language: 'tr' | 'en'; mode: 'select' | 'manage'; onClick: () => void; onContextMenu: (event: React.MouseEvent) => void; onFocus: () => void }) {
  return <button type="button" onMouseEnter={onFocus} onFocus={onFocus} onContextMenu={onContextMenu} onClick={onClick}
    aria-label={mode === 'manage' ? `${profile.name} — ${language === 'tr' ? 'düzenle' : 'edit'}` : profile.name}
    className={`group relative w-[138px] text-left transition-[transform,opacity] duration-200 focus-visible:outline-none sm:w-[156px] md:w-[184px] motion-reduce:transform-none motion-reduce:transition-none ${focused ? 'z-10 opacity-100 md:-translate-y-2 md:scale-[1.045]' : 'opacity-60 hover:opacity-90'}`}>
    <div className={`relative aspect-[4/5] overflow-hidden rounded-[26px] border bg-neutral-950 shadow-[0_22px_64px_rgba(0,0,0,0.42)] transition-[border-color,box-shadow] duration-200 group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-[var(--accent-color)] ${focused ? 'border-[var(--accent-color)] shadow-[0_28px_86px_rgba(0,0,0,0.58)]' : 'border-white/10 group-hover:border-white/25'}`}>
      {profile.avatarUrl.startsWith('linear-gradient') || !profile.avatarUrl ? <div className="w-full h-full bg-neutral-800 flex items-center justify-center"><UserRound size={56} className="text-neutral-300" /></div> : <img src={profile.avatarUrl} className="h-full w-full object-cover" alt={profile.name} />}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5"><span className="block truncate text-base font-black tracking-tight text-white sm:text-lg">{profile.name}</span>{focused && profile.contentPreferences?.length ? <span className="mt-1.5 block truncate text-[10px] font-bold text-neutral-300">{profile.contentPreferences.slice(0, 3).map(preference => getPreferenceLabel(preference, language)).join(' · ')}</span> : null}</div>
      <div className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full shadow-xl transition-[opacity,transform,background-color] duration-200 ${mode === 'manage' ? 'bg-white text-black' : 'border border-white/20 bg-black/70 text-white'} ${focused ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'}`}>{mode === 'manage' ? <Pencil size={14} /> : <ArrowUpRight size={16} />}</div>
    </div>
  </button>;
}

function AddProfileCard({ focused, label, onCreate, onFocus }: { focused: boolean; label: string; onCreate: () => void; onFocus: () => void }) {
  return <button type="button" onMouseEnter={onFocus} onFocus={onFocus} onClick={onCreate} className={`group relative w-[138px] text-left transition-[transform,opacity] duration-200 focus-visible:outline-none sm:w-[156px] md:w-[184px] ${focused ? 'z-10 opacity-100 md:-translate-y-2 md:scale-[1.045]' : 'opacity-70 hover:opacity-100'}`}><div className={`relative flex aspect-[4/5] flex-col items-center justify-center overflow-hidden rounded-[26px] border bg-white/[0.025] shadow-[0_22px_64px_rgba(0,0,0,0.32)] group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-[var(--accent-color)] ${focused ? 'border-[var(--accent-color)] bg-white/[0.055]' : 'border-white/12 group-hover:border-white/25'}`}><div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-white group-hover:bg-white group-hover:text-black"><Plus size={24} /></div><span className="mt-5 max-w-[80%] text-center text-sm font-black text-neutral-200">{label}</span></div></button>;
}

function EmptyManageState({ language, message, onCreate }: { language: 'tr' | 'en'; message: string; onCreate: () => void }) {
  return <div className="flex flex-col items-center justify-center p-8 md:p-10 rounded-[32px] border border-white/10 bg-white/[0.03] text-center max-w-md w-full"><div className="w-16 h-16 rounded-2xl border border-white/10 bg-white/[0.06] flex items-center justify-center mb-5"><UserRound size={30} /></div><h3 className="text-xl font-black">{language === 'tr' ? 'Düzenlenecek Profil Bulunamadı' : 'No Profiles Found to Edit'}</h3><p className="mt-2.5 text-xs md:text-sm text-neutral-400">{message}</p><button type="button" onClick={onCreate} className="mt-6 inline-flex items-center gap-2 px-6 h-11 rounded-2xl bg-white text-black font-black text-xs uppercase"><Plus size={16} />{language === 'tr' ? 'Profil Oluştur' : 'Create Profile'}</button></div>;
}
