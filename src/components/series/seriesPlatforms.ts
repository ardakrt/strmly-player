import { BRANDFETCH_CLIENT_ID } from '../../constants';
// Locally bundled platform logos (downloaded from Brandfetch library assets) —
// immune to CDN hotlink/referer/cache issues that caused blank or white-box logos.
import todLogo from '../../assets/logos/tod.png';
import exxenLogo from '../../assets/logos/exxen.png';
import tabiiLogo from '../../assets/logos/tabii.webp';

/** Strip bracketed tags / generic words so "NETFLIX [DIZI]" renders as "NETFLIX". */
export const getCategoryPresentation = (name: string) => {
  const label = name
    .replace(/\[[^\]]+\]\s*/g, '')
    .replace(/\b(Diziler|Dizi|Filmler|Film)\b/gi, '')
    .replace(/\(yenileniyor\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return label || name;
};

export interface PlatformConfig {
  name: string;
  dotColor: string;
  domain?: string;
  customLogoUrl?: string;
  assetId?: string;
}

export const getPlatformConfig = (categoryName: string): PlatformConfig | null => {
  const upper = categoryName.toUpperCase();
  if (upper.includes('NETFLIX')) return { name: 'Netflix', dotColor: '#ef4444', customLogoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg' };
  if (upper.includes('DISNEY')) return { name: 'Disney+', dotColor: '#06b6d4', customLogoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg' };
  if (upper.includes('HBO') || upper.includes('MAX')) return { name: 'HBO Max', dotColor: '#a855f7', customLogoUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Max_logo.svg' };
  if (upper.includes('APPLE')) return { name: 'Apple TV+', dotColor: '#e2e8f0', customLogoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg' };
  if (upper.includes('EXXEN')) return { name: 'Exxen', dotColor: '#f59e0b', customLogoUrl: exxenLogo };
  if (upper.includes('GAIN')) return { name: 'Gain', dotColor: '#10b981', domain: 'gain.tv' };
  if (upper.includes('BLUTV') || upper.includes('BLU TV')) return { name: 'BluTV', dotColor: '#0ea5e9', domain: 'blutv.com' };
  if (upper.includes('AMAZON') || upper.includes('PRIME')) return { name: 'Prime Video', dotColor: '#3b82f6', customLogoUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg' };
  if (upper.includes('TOD') || upper.includes('BEIN') || upper.includes('BEINCONNECT')) return { name: 'TOD', dotColor: '#6366f1', customLogoUrl: todLogo };
  if (upper.includes('TABII')) return { name: 'Tabii', dotColor: '#14b8a6', customLogoUrl: tabiiLogo };
  return null;
};

// Official brand logo from Brandfetch CDN.
// Must use the /theme/light/logo variant: the bare /domain/{domain} endpoint returns
// opaque-background squares which the brightness-0+invert white filter turns into solid boxes.
// The &h=true flag busts the CDN/browser cache so stale or failed responses don't stick.
const getBrandLogoUrl = (domain: string) => `https://cdn.brandfetch.io/domain/${domain}/theme/light/logo?c=${BRANDFETCH_CLIENT_ID}&h=true`;

// Specific Brandfetch library asset (hand-picked logo variant), transparent background
const getBrandAssetUrl = (domain: string, assetId: string) => `https://cdn.brandfetch.io/domain/${domain}/asset/${assetId}?c=${BRANDFETCH_CLIENT_ID}&h=true`;

export const resolvePlatformLogoUrl = (platform: PlatformConfig | null): string | undefined => {
  if (!platform) return undefined;
  if (platform.customLogoUrl) return platform.customLogoUrl;
  if (platform.assetId && platform.domain) return getBrandAssetUrl(platform.domain, platform.assetId);
  if (platform.domain) return getBrandLogoUrl(platform.domain);
  return undefined;
};

export interface CategoryGroups {
  platforms: string[];
  genres: string[];
  regions: string[];
  others: string[];
}

const GENRE_KEYWORDS = ['AKSİYON', 'AKSIYON', 'DRAM', 'KOMEDİ', 'KOMEDI', 'SUÇ', 'SUC', 'BİLİM', 'BILIM', 'ANİME', 'ANIME', 'KORKU', 'GERİLİM', 'GERILIM', 'MACERA', 'BELGESEL', 'TARİH', 'TARIH', 'ÇOCUK', 'COCUK', 'AİLE', 'AILE', 'NOSTALJİ', 'NOSTALJI', 'GENÇLİK', 'GENCLIK'];
const REGION_KEYWORDS = ['YERLİ', 'YERLI', 'YABANCI', 'K-DRAMA', 'KORE', 'HİNT', 'HINT', 'İSPANYOL', 'ISPANYOL', 'İNGİLİZ', 'INGILIZ', 'ASYA', 'TURK', 'TÜRK'];

export const classifyCategories = (categories: string[]): CategoryGroups => {
  const platforms: string[] = [];
  const genres: string[] = [];
  const regions: string[] = [];
  const others: string[] = [];

  categories.forEach((cat) => {
    const platform = getPlatformConfig(cat);
    if (platform) { platforms.push(cat); return; }
    const upper = cat.toUpperCase();
    if (REGION_KEYWORDS.some((k) => upper.includes(k))) { regions.push(cat); return; }
    if (GENRE_KEYWORDS.some((k) => upper.includes(k))) { genres.push(cat); return; }
    others.push(cat);
  });

  return { platforms, genres, regions, others };
};

export const getQualityLabel = (name: string): string | null => {
  const lower = name.toLowerCase();
  if (lower.includes('4k') || lower.includes('uhd')) return '4K';
  if (lower.includes('1080p') || lower.includes('fhd') || lower.includes('1080')) return 'FHD';
  if (lower.includes('720p') || lower.includes('hd') || lower.includes('720')) return 'HD';
  return null;
};

// Merge key: variants like "NETFLIX", "NETFLIX 1", "NETFLIX 2" collapse into one row
export const getCategoryMergeKey = (name: string): string => {
  const normalized = getCategoryPresentation(name).toUpperCase().replace(/[\s\d\W_]+$/, '');
  return normalized.replace(/\s{2,}/g, ' ').trim();
};
