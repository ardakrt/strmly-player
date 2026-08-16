import type { ChangeEventHandler } from 'react';
import { Plus, RefreshCw, UploadCloud, X } from 'lucide-react';
import type { SavedPlaylist } from '../../types';
import { HoldToConfirmButton } from '../HoldToConfirmButton';
import { EmptyState, fieldStyle, labelStyle, PageHeader, primaryButton, secondaryButton, UPDATE_OPTIONS } from '../SettingsControls';

interface SettingsPlaylistsTabProps {
  language: 'tr' | 'en';
  t: (key: string) => string;
  playlists: SavedPlaylist[];
  activePlaylistId: string | null;
  refreshingPlaylistId: string | null;
  showAddForm: boolean;
  playlistMode: string;
  formName: string;
  m3uUrl: string;
  xtreamUrl: string;
  xtreamUser: string;
  xtreamPass: string;
  isParsing: boolean;
  onToggleAddForm: () => void;
  onChangePlaylistMode: (value: 'm3u' | 'xtream') => void;
  onChangeFormName: (value: string) => void;
  onChangeM3uUrl: (value: string) => void;
  onChangeXtreamUrl: (value: string) => void;
  onChangeXtreamUser: (value: string) => void;
  onChangeXtreamPass: (value: string) => void;
  onLoadFromUrl: () => void;
  onLoadLocal: ChangeEventHandler<HTMLInputElement>;
  onXtreamLoad: () => void;
  onSelectPlaylist: (id: string) => void;
  onDeletePlaylist: (id: string) => void;
  onRefreshPlaylist: (playlist: SavedPlaylist) => void | Promise<void>;
  onUpdateAutoInterval: (id: string, hours: 6 | 12 | 24 | 168) => void;
}

function PlaylistCard({ language, t, playlist, activePlaylistId, refreshingPlaylistId, isParsing, onSelect, onDelete, onRefresh, onUpdateAutoInterval }: {
  language: 'tr' | 'en'; t: (key: string) => string; playlist: SavedPlaylist; activePlaylistId: string | null; refreshingPlaylistId: string | null; isParsing: boolean;
  onSelect: (id: string) => void; onDelete: (id: string) => void; onRefresh: (playlist: SavedPlaylist) => void | Promise<void>; onUpdateAutoInterval: (id: string, hours: 6 | 12 | 24 | 168) => void;
}) {
  const active = playlist.id === activePlaylistId;
  const refreshing = refreshingPlaylistId === playlist.id;
  const canAutoUpdate = Boolean(playlist.url || (playlist.xtreamUrl && playlist.xtreamUser && playlist.xtreamPass));
  return (
    <div className={`rounded-2xl border p-4.5 transition-all duration-200 ${active ? 'border-[var(--accent-color)]/30 bg-white/[0.03]' : 'border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02]'}`}>
      <div className="flex items-center justify-between gap-4"><button type="button" className="group/play min-w-0 flex-1 text-left" onClick={() => onSelect(playlist.id)}><div className="flex items-center gap-2"><span className="truncate text-[14px] font-bold text-white transition-colors group-hover/play:text-[var(--accent-color)]">{playlist.name}</span>{active && <span className="rounded bg-[var(--accent-color)] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-black">{language === 'tr' ? 'Aktif' : 'Active'}</span>}</div><div className="mt-1 text-xs font-medium text-neutral-500">{playlist.channelCount || 0} {language === 'tr' ? 'içerik' : 'items'} • {playlist.groupCount || playlist.groups?.length || 0} {language === 'tr' ? 'grup' : 'groups'}</div></button><div className="flex shrink-0 items-center gap-1.5"><button type="button" disabled={isParsing || refreshingPlaylistId !== null} aria-busy={refreshing} onClick={() => onRefresh(playlist)} className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-white/8 bg-white/[0.02] px-3 text-[11px] font-semibold text-neutral-300 outline-none transition-colors duration-150 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)]"><RefreshCw size={13} aria-hidden="true" className={refreshing ? 'animate-spin text-[var(--accent-color)]' : ''} /><span>{refreshing ? (language === 'tr' ? 'Kontrol ediliyor' : 'Checking') : (language === 'tr' ? 'Güncellemeyi kontrol et' : 'Check for updates')}</span></button><HoldToConfirmButton onConfirm={() => onDelete(playlist.id)} label={language === 'tr' ? 'Sil' : 'Delete'} confirmedLabel={language === 'tr' ? 'Silindi' : 'Deleted'} variant="danger" ariaLabel={language === 'tr' ? 'Listeyi Sil' : 'Delete Playlist'} /></div></div>
      <div className="mt-4 border-t border-white/5 pt-3"><div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-neutral-500">{language === 'tr' ? 'Otomatik Güncelleme' : 'Auto Update'}</div>{canAutoUpdate ? <div className="grid grid-cols-4 gap-1.5">{UPDATE_OPTIONS.map((option) => <button type="button" key={option.value} onClick={() => onUpdateAutoInterval(playlist.id, option.value)} className={`h-7.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all ${(playlist.autoUpdateIntervalHours || 24) === option.value ? 'border-[var(--accent-color)] bg-[var(--accent-color)] text-black shadow-sm font-black' : 'border-white/5 bg-white/[0.01] text-neutral-400 hover:border-white/12 hover:bg-white/[0.03] hover:text-white'}`}>{option.value === 6 ? (language === 'tr' ? '6 Sa' : '6h') : option.value === 12 ? (language === 'tr' ? '12 Sa' : '12h') : option.value === 24 ? (language === 'tr' ? '24 Sa' : '24h') : (language === 'tr' ? '7 G' : '7d')}</button>)}</div> : <p className="text-[11px] leading-relaxed text-neutral-500">{t('settings.details.localFilesUpdate')}</p>}</div>
    </div>
  );
}

export function SettingsPlaylistsTab(props: SettingsPlaylistsTabProps) {
  const { language, t } = props;
  return (
    <>
      <PageHeader title={t('settings.playlists.title')} description={t('settings.details.playlistsPage')} />
      <div className="mb-5 flex justify-end"><button type="button" className={props.showAddForm ? secondaryButton : primaryButton} onClick={props.onToggleAddForm}>{props.showAddForm ? <X size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}{props.showAddForm ? t('common.close') : t('settings.playlists.addPlaylist')}</button></div>
      {props.showAddForm && <div className="mb-5 rounded-2xl border border-white/5 bg-white/[0.005] p-5">
        <div className="mb-4 inline-grid w-full max-w-[200px] grid-cols-2 rounded-lg border border-white/8 bg-black/40 p-0.5"><button type="button" className={`h-7.5 rounded text-[11px] font-black uppercase tracking-wider transition-all ${props.playlistMode === 'xtream' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-white'}`} onClick={() => props.onChangePlaylistMode('xtream')}>Xtream</button><button type="button" className={`h-7.5 rounded text-[11px] font-black uppercase tracking-wider transition-all ${props.playlistMode === 'm3u' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-white'}`} onClick={() => props.onChangePlaylistMode('m3u')}>M3U</button></div>
        <div className="grid gap-4 md:grid-cols-2"><label className="md:col-span-2"><div className={labelStyle}>{t('settings.playlists.playlistName')}</div><input className={`${fieldStyle} mt-1.5 w-full`} value={props.formName} onChange={(event) => props.onChangeFormName(event.target.value)} placeholder={t('settings.playlists.playlistNamePlaceholder')} /></label>
          {props.playlistMode === 'm3u' ? <><label className="md:col-span-2"><div className={labelStyle}>M3U URL</div><input className={`${fieldStyle} mt-1.5 w-full`} value={props.m3uUrl} onChange={(event) => props.onChangeM3uUrl(event.target.value)} placeholder="http://example.com/playlist.m3u" /></label><label className={secondaryButton}>{t('profiles.importLocalFile')}<input type="file" accept=".m3u" onChange={props.onLoadLocal} className="hidden" /></label><button type="button" className={primaryButton} disabled={props.isParsing || !props.m3uUrl.trim()} onClick={props.onLoadFromUrl}>{props.isParsing ? (language === 'tr' ? 'Yükleniyor...' : 'Loading...') : (language === 'tr' ? 'URL’den Yükle' : 'Load from URL')}</button></> : <><label className="md:col-span-2"><div className={labelStyle}>{language === 'tr' ? 'Sunucu Adresi' : 'Server Address'}</div><input className={`${fieldStyle} mt-1.5 w-full`} value={props.xtreamUrl} onChange={(event) => props.onChangeXtreamUrl(event.target.value)} placeholder="http://server-address.com:8080" /></label><label><div className={labelStyle}>{t('profiles.xtreamUser')}</div><input className={`${fieldStyle} mt-1.5 w-full`} value={props.xtreamUser} onChange={(event) => props.onChangeXtreamUser(event.target.value)} placeholder={language === 'tr' ? 'Kullanıcı adı' : 'Username'} /></label><label><div className={labelStyle}>{t('profiles.xtreamPass')}</div><input className={`${fieldStyle} mt-1.5 w-full`} type="password" value={props.xtreamPass} onChange={(event) => props.onChangeXtreamPass(event.target.value)} placeholder={language === 'tr' ? 'Şifre' : 'Password'} /></label><button type="button" className={`${primaryButton} mt-1 md:col-span-2`} disabled={props.isParsing || !props.xtreamUrl.trim() || !props.xtreamUser.trim() || !props.xtreamPass.trim()} onClick={props.onXtreamLoad}>{props.isParsing ? (language === 'tr' ? 'Bağlanılıyor...' : 'Connecting...') : (language === 'tr' ? 'Xtream ile Giriş Yap' : 'Login with Xtream')}</button></>}
        </div>
      </div>}
      {props.playlists.length === 0 ? <EmptyState icon={UploadCloud} title={t('settings.playlists.noPlaylists')} description={t('settings.details.playlistsEmpty')} /> : <div className="grid gap-4 xl:grid-cols-2">{props.playlists.map((playlist) => <PlaylistCard key={playlist.id} language={language} t={t} playlist={playlist} activePlaylistId={props.activePlaylistId} refreshingPlaylistId={props.refreshingPlaylistId} isParsing={props.isParsing} onSelect={props.onSelectPlaylist} onDelete={props.onDeletePlaylist} onRefresh={props.onRefreshPlaylist} onUpdateAutoInterval={props.onUpdateAutoInterval} />)}</div>}
    </>
  );
}
