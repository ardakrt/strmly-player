import { CustomSelect, PageHeader, SettingRow } from '../SettingsControls';

interface SettingsAppearanceTabProps {
  language: 'tr' | 'en';
  t: (key: string) => string;
  cardLayoutSize: string;
  uiScale: string;
  onChangeLanguage: (language: 'tr' | 'en') => void;
  onChangeCardLayoutSize: (size: string) => void;
  onChangeUiScale: (scale: 'small' | 'medium' | 'large') => void;
}

const SIZE_OPTIONS = ['small', 'medium', 'large'] as const;

const sizeLabel = (language: 'tr' | 'en', size: typeof SIZE_OPTIONS[number]) => {
  if (language === 'en') return size[0].toUpperCase() + size.slice(1);
  if (size === 'small') return 'Küçük';
  if (size === 'medium') return 'Orta';
  return 'Büyük';
};

function SizeSelector({
  language,
  value,
  onChange,
}: {
  language: 'tr' | 'en';
  value: string;
  onChange: (size: 'small' | 'medium' | 'large') => void;
}) {
  return (
    <div className="inline-flex gap-0.5 rounded-lg border border-white/5 bg-black/30 p-0.5 select-none">
      {SIZE_OPTIONS.map((size) => (
        <button
          type="button"
          key={size}
          onClick={() => onChange(size)}
          className={`h-7 rounded px-3.5 text-[10px] font-bold uppercase tracking-wider transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)] ${
            value === size ? 'bg-white text-black shadow-sm font-black' : 'text-neutral-400 hover:text-white'
          }`}
        >
          {sizeLabel(language, size)}
        </button>
      ))}
    </div>
  );
}

export function SettingsAppearanceTab({
  language,
  t,
  cardLayoutSize,
  uiScale,
  onChangeLanguage,
  onChangeCardLayoutSize,
  onChangeUiScale,
}: SettingsAppearanceTabProps) {
  return (
    <>
      <PageHeader title={t('settings.sections.interfaceTitle')} description={t('settings.sections.interfaceDescription')} />
      <div>
        <SettingRow title={t('settings.appearance.language')} description={t('settings.appearance.languageDesc')}>
          <CustomSelect
            value={language}
            onChange={(value) => onChangeLanguage(value as 'tr' | 'en')}
            options={[{ value: 'tr', label: 'Türkçe' }, { value: 'en', label: 'English' }]}
          />
        </SettingRow>
        <SettingRow title={t('settings.appearance.cardSize')} description={t('settings.appearance.cardSizeDesc')}>
          <SizeSelector language={language} value={cardLayoutSize} onChange={onChangeCardLayoutSize} />
        </SettingRow>
        <SettingRow title={t('settings.sections.uiScaleTitle')} description={t('settings.sections.uiScaleDescription')}>
          <SizeSelector language={language} value={uiScale} onChange={onChangeUiScale} />
        </SettingRow>
      </div>
    </>
  );
}
