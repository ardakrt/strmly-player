import { useState } from 'react';
import { Eye, Search, X } from 'lucide-react';
import { PageHeader } from '../SettingsControls';

type CategoryTab = 'all' | 'live' | 'series' | 'movie';

interface SettingsCategoriesTabProps {
  language: 'tr' | 'en';
  t: (key: string) => string;
  hiddenCategories: string[];
  hiddenSeriesCategories: string[];
  hiddenMovieCategories: string[];
  onRestoreCategory: (name: string) => void;
  onRestoreSeriesCategory: (name: string) => void;
  onRestoreMovieCategory: (name: string) => void;
  onResetHiddenCategories: () => void;
  onResetHiddenSeriesCategories: () => void;
  onResetHiddenMovieCategories: () => void;
}

function HiddenCategoryGroup({ language, title, groups, search, onRestore }: { language: 'tr' | 'en'; title: string; groups: string[]; search: string; onRestore: (name: string) => void }) {
  const query = search.trim().toLocaleLowerCase('tr-TR');
  const filtered = query ? groups.filter((group) => group.toLocaleLowerCase('tr-TR').includes(query)) : groups;
  return (
    <section className="border-b border-white/[0.07] last:border-b-0" aria-label={title}>
      <div className="flex items-baseline justify-between gap-4 py-4"><h3 className="text-xs font-semibold text-white">{title}</h3><span className="text-[10px] tabular-nums text-white/45">{query ? `${filtered.length} / ${groups.length}` : groups.length}</span></div>
      {groups.length === 0 ? <div className="py-6 text-sm text-white/45">{language === 'tr' ? 'Bu bölümde gizli kategori yok.' : 'There are no hidden categories in this section.'}</div> : filtered.length === 0 ? <div className="py-6 text-sm text-white/45">{language === 'tr' ? 'Aramanızla eşleşen kategori bulunamadı.' : 'No categories match your search.'}</div> : (
        <div className="divide-y divide-white/[0.055]">{filtered.map((group) => <div key={`${title}-${group}`} className="group flex min-h-14 items-center justify-between gap-4 py-2.5"><span className="min-w-0 truncate text-sm text-white/72 transition-colors group-hover:text-white" title={group}>{group}</span><button type="button" onClick={() => onRestore(group)} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-semibold text-white/60 outline-none transition-colors duration-150 hover:bg-white/[0.05] hover:text-white active:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)]" aria-label={`${group} — ${language === 'tr' ? 'göster' : 'show'}`}><Eye size={13} aria-hidden="true" />{language === 'tr' ? 'Göster' : 'Show'}</button></div>)}</div>
      )}
    </section>
  );
}

export function SettingsCategoriesTab(props: SettingsCategoriesTabProps) {
  const { language, t } = props;
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<CategoryTab>('all');
  const total = props.hiddenCategories.length + props.hiddenSeriesCategories.length + props.hiddenMovieCategories.length;
  const tabs = [
    { id: 'all' as const, label: language === 'tr' ? 'Tümü' : 'All', count: total },
    { id: 'live' as const, label: language === 'tr' ? 'Canlı TV' : 'Live TV', count: props.hiddenCategories.length },
    { id: 'series' as const, label: language === 'tr' ? 'Diziler' : 'Series', count: props.hiddenSeriesCategories.length },
    { id: 'movie' as const, label: language === 'tr' ? 'Filmler' : 'Movies', count: props.hiddenMovieCategories.length },
  ];
  const activeCount = tabs.find((tab) => tab.id === activeTab)?.count ?? 0;
  const resetActive = () => {
    if (activeTab === 'all' || activeTab === 'live') props.onResetHiddenCategories();
    if (activeTab === 'all' || activeTab === 'series') props.onResetHiddenSeriesCategories();
    if (activeTab === 'all' || activeTab === 'movie') props.onResetHiddenMovieCategories();
    setSearch('');
  };
  return (
    <>
      <PageHeader title={language === 'tr' ? 'Gizli Kategoriler' : 'Hidden Categories'} description={t('settings.details.hiddenCategories')} />
      <div className="mb-7 border-b border-white/[0.07]"><div className="flex flex-col gap-4 pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-wrap items-center gap-x-7" role="tablist" aria-label={language === 'tr' ? 'Gizli kategori türleri' : 'Hidden category types'}>{tabs.map((tab) => { const selected = activeTab === tab.id; return <button type="button" role="tab" aria-selected={selected} key={tab.id} onClick={() => setActiveTab(tab.id)} className={`relative flex h-11 shrink-0 items-center gap-2 whitespace-nowrap text-xs font-semibold outline-none transition-colors duration-150 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)] ${selected ? 'text-white' : 'text-white/60 hover:text-white/82'}`}><span>{tab.label}</span><span className={`text-[10px] tabular-nums ${selected ? 'text-white/60' : 'text-white/50'}`}>{tab.count}</span>{selected && <span className="absolute inset-x-0 bottom-[-17px] h-[2px] bg-[var(--accent-color)]" aria-hidden="true" />}</button>; })}</div>
        <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto"><label className="relative block w-full sm:w-64"><span className="sr-only">{language === 'tr' ? 'Gizli kategori ara' : 'Search hidden categories'}</span><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/45" size={14} aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={language === 'tr' ? 'Kategori ara' : 'Search categories'} className="h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.025] pl-9 pr-10 text-sm text-white outline-none transition-colors duration-150 placeholder:text-white/45 hover:bg-white/[0.04] focus-visible:border-white/15" />{search && <button type="button" onClick={() => setSearch('')} className="absolute right-0 top-0 flex h-11 w-10 items-center justify-center rounded-md text-white/50 outline-none hover:text-white" aria-label={language === 'tr' ? 'Aramayı temizle' : 'Clear search'}><X size={14} aria-hidden="true" /></button>}</label><button type="button" onClick={resetActive} disabled={activeCount === 0} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-white/[0.09] px-4 text-xs font-semibold text-white/72 outline-none transition-colors duration-150 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)]"><Eye size={13} aria-hidden="true" />{language === 'tr' ? 'Tümünü göster' : 'Show all'}</button></div>
      </div></div>
      <div>
        {(activeTab === 'all' || activeTab === 'live') && <HiddenCategoryGroup language={language} title={language === 'tr' ? 'Canlı TV' : 'Live TV'} groups={props.hiddenCategories} search={search} onRestore={props.onRestoreCategory} />}
        {(activeTab === 'all' || activeTab === 'series') && <HiddenCategoryGroup language={language} title={language === 'tr' ? 'Diziler' : 'Series'} groups={props.hiddenSeriesCategories} search={search} onRestore={props.onRestoreSeriesCategory} />}
        {(activeTab === 'all' || activeTab === 'movie') && <HiddenCategoryGroup language={language} title={language === 'tr' ? 'Filmler' : 'Movies'} groups={props.hiddenMovieCategories} search={search} onRestore={props.onRestoreMovieCategory} />}
      </div>
    </>
  );
}
