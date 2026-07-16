export interface AmbientColors {
  color1: string; // primary glow (rgba / hsla)
  color2: string; // secondary glow (rgba / hsla)
  bg: string;     // radial gradient top background
  bgSolid: string;// solid dark background to blend bottom scrim
}

/** Fixed deep-black chrome — no poster hue bleed into app background. */
const DEEP_BLACK_AMBIENT: AmbientColors = {
  color1: 'rgba(255, 255, 255, 0.022)',
  color2: 'rgba(255, 255, 255, 0.012)',
  bg: '#08080a',
  bgSolid: '#030304',
};

/**
 * App chrome ambient colors. Always monochrome deep black so rails
 * stay cohesive with black glass UI (poster tints are intentionally unused).
 */
export function getHashColors(_title: string): AmbientColors {
  void _title;
  return { ...DEEP_BLACK_AMBIENT };
}

/**
 * Kept for call-site compatibility. Does not sample poster colors —
 * always resolves to deep-black chrome so the shell never shifts hue.
 */
export function extractColorsFromImage(_imageUrl: string): Promise<AmbientColors | null> {
  void _imageUrl;
  return Promise.resolve({ ...DEEP_BLACK_AMBIENT });
}
