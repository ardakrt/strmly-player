import { ChevronDown } from 'lucide-react';
import { CustomSelect, fieldStyle, PageHeader, SettingRow } from '../SettingsControls';

type UpdateMode = 'prompt' | 'silent' | 'manual';

interface SettingsPlaybackTabProps {
  language: 'tr' | 'en';
  t: (key: string) => string;
  defaultPlayer: string;
  autoPlayNext: boolean;
  bufferEnabled: boolean;
  iptvUpdateMode: UpdateMode;
  bufferSize: string;
  connectionTimeout: string;
  retryCount: string;
  hwAccelerationEnabled: boolean;
  onChangeDefaultPlayer: (value: string) => void;
  onToggleAutoPlayNext: () => void;
  onToggleBuffer: () => void;
  onChangeUpdateMode: (mode: UpdateMode) => void;
  onChangeBufferSize: (value: string) => void;
  onChangeConnectionTimeout: (value: string) => void;
  onChangeRetryCount: (value: string) => void;
  onToggleHardwareAcceleration: () => void | Promise<void>;
}

function Toggle({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void | Promise<void> }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${checked ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' : 'bg-white/[0.03] border-white/8'}`}
    >
      <span aria-hidden="true" className={`absolute top-1/2 h-4.5 w-4.5 -translate-y-1/2 rounded-full transition-[left,background-color] duration-150 ${checked ? 'left-5.5 bg-black' : 'left-0.5 bg-neutral-400'}`} />
    </button>
  );
}

function NumberSetting({ value, className, min, max, disabled, unit, onChange }: {
  value: string;
  className: string;
  min: number;
  max: number;
  disabled?: boolean;
  unit: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input className={`${fieldStyle} ${className}`} type="number" min={min} max={max} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} />
      <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-neutral-500">{unit}</span>
    </div>
  );
}

export function SettingsPlaybackTab(props: SettingsPlaybackTabProps) {
  const { language, t } = props;
  const seconds = language === 'tr' ? 'Saniye' : 'Seconds';
  return (
    <>
      <PageHeader title={t('settings.sections.playbackTitle')} description={t('settings.sections.playbackDescription')} />
      <div>
        <SettingRow title={language === 'tr' ? 'Oynatıcı' : 'Player'} description={language === 'tr' ? 'İçeriklerin hangi oynatıcıyla açılacağını seçin.' : 'Choose which player opens your media.'}>
          <CustomSelect
            value={props.defaultPlayer}
            onChange={props.onChangeDefaultPlayer}
            options={[
              { value: 'internal', label: language === 'tr' ? 'Strmly Oynatıcı' : 'Strmly Player' },
              { value: 'vlc', label: `VLC Player (${language === 'tr' ? 'Harici' : 'External'})` },
              { value: 'mpv', label: `MPV Player (${language === 'tr' ? 'Harici' : 'External'})` },
            ]}
          />
        </SettingRow>
        <SettingRow title={language === 'tr' ? 'Sonraki Bölümü Otomatik Oynat' : 'Autoplay Next Episode'} description={t('settings.details.autoplay')}>
          <Toggle checked={props.autoPlayNext} label={language === 'tr' ? 'Sonraki bölümü otomatik oynat' : 'Autoplay next episode'} onToggle={props.onToggleAutoPlayNext} />
        </SettingRow>
        <SettingRow title={language === 'tr' ? 'Kesintisiz Oynatma' : 'Smoother Playback'} description={t('settings.details.smootherPlayback')}>
          <Toggle checked={props.bufferEnabled} label={language === 'tr' ? 'Kesintisiz oynatma' : 'Smoother playback'} onToggle={props.onToggleBuffer} />
        </SettingRow>
        <SettingRow title={language === 'tr' ? 'Yeni içerikler nasıl eklensin?' : 'How should new content be applied?'} description={t('settings.details.updateMode')} vertical>
          <div role="radiogroup" aria-label={language === 'tr' ? 'IPTV liste güncelleme davranışı' : 'IPTV playlist update behavior'} className="grid gap-2 sm:grid-cols-3">
            {[
              { id: 'prompt' as const, tr: 'Önce Sor', en: 'Ask First' },
              { id: 'silent' as const, tr: 'Boştayken Uygula', en: 'Apply When Idle' },
              { id: 'manual' as const, tr: 'Yalnızca Elle', en: 'Manual Only' },
            ].map((option) => {
              const selected = props.iptvUpdateMode === option.id;
              return <button key={option.id} type="button" role="radio" aria-checked={selected} onClick={() => props.onChangeUpdateMode(option.id)} className={`min-h-10 rounded-xl border px-3 text-left text-[11px] font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)] ${selected ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/12 text-white' : 'border-white/[0.07] bg-white/[0.025] text-neutral-400 hover:border-white/15 hover:text-white'}`}>{language === 'tr' ? option.tr : option.en}</button>;
            })}
          </div>
        </SettingRow>
        <details className="group mt-5 rounded-xl border border-white/[0.06] bg-white/[0.01]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden">
            <span><span className="block text-xs font-bold text-neutral-200">{language === 'tr' ? 'Gelişmiş Ayarlar' : 'Advanced Settings'}</span><span className="mt-1 block text-[11px] text-neutral-500">{t('settings.details.advancedPlayback')}</span></span>
            <ChevronDown size={15} aria-hidden="true" className="shrink-0 text-neutral-500 transition-transform duration-150 group-open:rotate-180" />
          </summary>
          <div className="border-t border-white/[0.05] px-4">
            <SettingRow title={language === 'tr' ? 'Ön Yükleme Süresi' : 'Preload Duration'} description={t('settings.details.preload')}><NumberSetting value={props.bufferSize} className="!w-20 text-center disabled:cursor-not-allowed disabled:opacity-50" min={5} max={120} disabled={!props.bufferEnabled} unit={seconds} onChange={props.onChangeBufferSize} /></SettingRow>
            <SettingRow title={language === 'tr' ? 'Bağlantıyı Bekleme Süresi' : 'Connection Wait Time'} description={t('settings.details.connectionTimeout')}><NumberSetting value={props.connectionTimeout} className="!w-24 text-center" min={3} max={60} unit={seconds} onChange={props.onChangeConnectionTimeout} /></SettingRow>
            <SettingRow title={language === 'tr' ? 'Yeniden Deneme Sayısı' : 'Retry Attempts'} description={t('settings.details.retryCount')}><NumberSetting value={props.retryCount} className="!w-24 text-center" min={0} max={10} unit={language === 'tr' ? 'Deneme' : 'Retries'} onChange={props.onChangeRetryCount} /></SettingRow>
            <SettingRow title={language === 'tr' ? 'Ekran Kartını Kullan' : 'Use Graphics Card'} description={t('settings.details.hardwareAcceleration')}><Toggle checked={props.hwAccelerationEnabled} label={language === 'tr' ? 'Ekran kartını kullan' : 'Use graphics card'} onToggle={props.onToggleHardwareAcceleration} /></SettingRow>
          </div>
        </details>
      </div>
    </>
  );
}
