/** True for tiny marketing slogans like "You can't unsee it." — not a Max-style synopsis. */
export function isSloganLikeBlurb(text: string): boolean {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return true;
  // Very short punch lines without real plot context
  if (t.length < 48 && !/[.!?]/.test(t)) return true;
  if (t.length < 36) return true;
  // Single short exclamation/slogan sentence
  if (t.length < 55 && /^[^,]{0,54}[.!?]?"?$/.test(t) && (t.match(/\s/g) || []).length < 8) {
    return true;
  }
  return false;
}

/**
 * Max/HBO-style billboard blurb: 1–2 complete sentences, meaningful plot teaser.
 * Avoids mid-sentence "…" cuts when a full sentence fits under maxLen.
 */
function summarizeHeroOverview(text: string, maxLen = 190): string {
  try {
    const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    if (cleaned.length <= maxLen) return cleaned;

    // Split into sentences (keeps trailing punctuation).
    const sentences: string[] = [];
    const re = /[^.!?]+[.!?]+(?:["»”')\]]*)?(?=\s|$)|[^.!?]+$/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(cleaned)) !== null) {
      const s = match[0].trim();
      if (s) sentences.push(s);
    }
    if (sentences.length === 0) {
      const wordEnd = cleaned.lastIndexOf(' ', maxLen);
      const cut = wordEnd >= 50 ? wordEnd : maxLen;
      return `${cleaned.slice(0, cut).trim()}…`;
    }

    const blurb = sentences[0];

    // Long first sentence: cut at a clause boundary when possible (comma), else word.
    if (blurb.length > maxLen) {
      const slice = blurb.slice(0, maxLen);
      const clause = Math.max(
        slice.lastIndexOf(', '),
        slice.lastIndexOf('; '),
        slice.lastIndexOf(' — '),
        slice.lastIndexOf(' – '),
      );
      if (clause >= 70) return `${slice.slice(0, clause).trim()}…`;
      const wordEnd = slice.lastIndexOf(' ');
      const cut = wordEnd >= 50 ? wordEnd : maxLen;
      return `${slice.slice(0, cut).trim()}…`;
    }

    // Max often shows two short sentences when both fit.
    if (sentences[1]) {
      const two = `${blurb} ${sentences[1]}`.trim();
      if (two.length <= maxLen) return two;
    }

    return blurb;
  } catch {
    const fallback = String(text || '').trim();
    return fallback.length > maxLen ? `${fallback.slice(0, maxLen)}…` : fallback;
  }
}

/**
 * Prefer a real overview teaser (like Max/HBO), not a punchy TMDB tagline.
 * tagline is last resort only when overview is missing/unusable.
 */
export function pickHeroSynopsis(options: {
  tagline?: string | null;
  overview?: string | null;
  maxLen?: number;
}): string {
  try {
    const maxLen = options.maxLen ?? 190;
    const overview = String(options.overview || '').replace(/\s+/g, ' ').trim();
    const tag = String(options.tagline || '').replace(/\s+/g, ' ').trim();

    // 1) Plot synopsis first — this is what Max shows under the logo.
    const fromOverview = summarizeHeroOverview(overview, maxLen);
    if (fromOverview && !isSloganLikeBlurb(fromOverview)) return fromOverview;
    if (fromOverview.length >= 48) return fromOverview;

    // 2) Tagline only if it reads like a real line, not a 3-word slogan.
    if (tag && !isSloganLikeBlurb(tag)) {
      return summarizeHeroOverview(tag, maxLen);
    }

    // 3) Anything usable is better than empty.
    return fromOverview || (tag.length >= 20 ? tag : '');
  } catch {
    return '';
  }
}

/**
 * Fix Turkish character encoding issues (Mojibake) caused by double UTF-8 decoding
 * or ISO-8859-9 / Windows-1254 misdecodings (e.g., "SeÃ§izle" -> "Seçizle").
 */
export function fixTurkishEncoding(str: string): string {
  if (!str || typeof str !== 'string') return str || '';

  if (!/[ÃÄÅâ]/.test(str)) return str;

  let s = str;

  s = s
    .replace(/Ã§/g, 'ç')
    .replace(/Ã‡/g, 'Ç')
    .replace(/ÄŸ/g, 'ğ')
    .replace(/ÄĞ/g, 'Ğ')
    .replace(/Ä\u011E/g, 'Ğ')
    .replace(/Ä±/g, 'ı')
    .replace(/Ä°/g, 'İ')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ã–/g, 'Ö')
    .replace(/ÅŸ/g, 'ş')
    .replace(/ÅŞ/g, 'Ş')
    .replace(/Å\u015E/g, 'Ş')
    .replace(/Ã¼/g, 'ü')
    .replace(/ÃÜ/g, 'Ü')
    .replace(/Ã\u00DC/g, 'Ü')
    .replace(/Ã¢/g, 'â')
    .replace(/Ã®/g, 'î')
    .replace(/Ã»/g, 'û')
    .replace(/Ã½/g, 'ı')
    .replace(/Ã°/g, 'ğ')
    .replace(/Ã¾/g, 'ş')
    .replace(/Ã‘/g, 'Ğ')
    .replace(/Ãž/g, 'Ş')
    .replace(/â€™/g, "'")
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€œ/g, '“')
    .replace(/â€ /g, '”')
    .replace(/â€/g, '”');

  return s;
}

/** Strip playlist noise: [TR], quality tags, slash spam → "HBO Max · Paramount+". */
export function cleanPlaylistLabel(group: string, maxLen = 36): string {
  if (!group) return '';
  let s = fixTurkishEncoding(String(group))
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/\b(4k|uhd|fhd|hd|sd|1080p|720p|2160p|hdr|dv|atmos)\b/gi, ' ')
    .replace(/[|/\\]+/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > maxLen) s = `${s.slice(0, maxLen - 1).trim()}…`;
  return s;
}

// Helper to generate elegant gradient background classes dynamically based on a channel name hash
export const getFallbackGradient = (name: string) => {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradients = [
    'from-rose-950 via-neutral-900 to-neutral-950',
    'from-neutral-900 via-neutral-900 to-violet-950',
    'from-neutral-900 via-neutral-900 to-emerald-950',
    'from-teal-950 via-neutral-900 to-neutral-950',
    'from-amber-950 via-neutral-900 to-rose-950',
    'from-fuchsia-950 via-neutral-900 to-neutral-950',
    'from-violet-950 via-neutral-900 to-stone-900',
    'from-emerald-950 via-neutral-900 to-neutral-950'
  ];
  return gradients[hash % gradients.length];
};

const hexToRgbStr = (hex: string) => {
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
