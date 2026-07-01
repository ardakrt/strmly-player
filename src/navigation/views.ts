export const APP_VIEWS = {
  home: 'Ana Sayfa',
  live: 'Canlı TV',
  series: 'Diziler',
  movies: 'Sinema',
  favorites: 'Favorilerim',
  diagnostics: 'İstatistikler',
  settings: 'Ayarlar',
} as const;

export type AppView = typeof APP_VIEWS[keyof typeof APP_VIEWS];

export function isLiveTvView(view: string): boolean {
  return view === APP_VIEWS.live;
}

export function isDiagnosticsView(view: string): boolean {
  return view === APP_VIEWS.diagnostics;
}
