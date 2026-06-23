import type { EPGProgram } from '../types';

// Helper to generate elegant gradient background classes dynamically based on a channel name hash
export const getFallbackGradient = (name: string) => {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradients = [
    'from-rose-950 via-neutral-900 to-neutral-950',
    'from-neutral-900 via-neutral-900 to-violet-950',
    'from-neutral-900 via-neutral-900 to-emerald-950',
    'from-teal-950 via-neutral-900 to-neutral-900',
    'from-amber-950 via-neutral-900 to-rose-950',
    'from-fuchsia-950 via-neutral-900 to-neutral-950',
    'from-violet-950 via-neutral-900 to-stone-900',
    'from-emerald-950 via-neutral-900 to-neutral-950'
  ];
  return gradients[hash % gradients.length];
};

// Mock TMDB Data generator (Fallback when no TMDB key is present)
export const getMockDetails = (title: string, group: string) => {
  const seed = (title + group).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const match = (seed % 8) + 92;
  const ratingDecimal = ((seed * 7 + 13) % 18) / 10;
  const rating = (7.8 + ratingDecimal).toFixed(1);
  return {
    match: `%${match} Eşleşme`,
    rating: `★ ${rating}`,
    year: '2026',
    desc: `"${title}" yayını yüksek çözünürlüklü akış, 4K Ultra HD video kalitesi ve kristal netliğinde Dolby Atmos 5.1 çevreleyen ses kodlamasıyla evinizde sinema kalitesinde bir deneyim sunmaktadır. Bu yayın, ${group} kategorisindeki en prestijli içerikler arasından özenle seçilmiştir.`
  };
};

// Auto-generating realistic live EPG programs based on time
export const getLiveEPG = (channelId: string, name: string): EPGProgram => {
  const hash = name.length + channelId.charCodeAt(0) || 0;
  const minute = new Date().getMinutes();
  const currentProgress = (minute + (hash % 15)) % 100;

  const currentPrograms = [
    "Haber Bülteni - Canlı", "Spor Dünyası", "Sabah Kahvesi", "Sinema Gecesi",
    "Belgesel Saati", "Dünya Turu", "Ekonomi Gündemi", "Çizgi Film Şöleni",
    "Müzik Rüzgarı", "Teknoloji Rehberi", "Siyaset Meydanı", "Yemek Tarifleri"
  ];
  const nextPrograms = [
    "Hava Durumu & Analiz", "Canlı Maç Yayını", "Gündem Özel", "Kısa Film Kuşağı",
    "Vahşi Yaşam Belgeseli", "Gezi Rehberi", "Finans Analizi", "Çocuk Kulübü",
    "Hit Müzik Listesi", "Geleceğin Teknolojileri", "Tartışma Programı", "Gurme Keşifler"
  ];

  const programIndex = hash % currentPrograms.length;
  const nextIndex = (hash + 1) % nextPrograms.length;

  return {
    title: currentPrograms[programIndex],
    nextTitle: nextPrograms[nextIndex],
    progress: currentProgress
  };
};

export const hexToRgbStr = (hex: string) => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 113, 227';
};

export const getAccentStylesHelper = (
  activeAccent: string,
  glassIntensity: string,
  neonGlowEnabled: boolean
) => {
  const rgb = hexToRgbStr(activeAccent);
  return {
    '--accent-color': activeAccent,
    '--accent-hover': activeAccent,
    '--accent-glow': `rgba(${rgb}, 0.45)`,
    '--border-active': activeAccent,
    '--blur-level': glassIntensity === 'high' ? '28px' : glassIntensity === 'medium' ? '14px' : '0px',
    '--glass-opacity': glassIntensity === 'high' ? '0.35' : glassIntensity === 'medium' ? '0.55' : '0.96',
    '--card-glow-shadow': neonGlowEnabled ? `0 8px 30px rgba(${rgb}, 0.25)` : '0 4px 20px rgba(0, 0, 0, 0.3)',
    '--accent-glow-border': neonGlowEnabled ? `rgba(${rgb}, 0.35)` : 'rgba(255, 255, 255, 0.1)',
    '--accent-glow-solid': `rgba(${rgb}, 0.15)`
  } as React.CSSProperties;
};
