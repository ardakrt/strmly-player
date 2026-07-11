function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

export interface AmbientColors {
  color1: string; // primary glow (rgba / hsla)
  color2: string; // secondary glow (rgba / hsla)
  bg: string;     // radial gradient top background
  bgSolid: string;// solid dark background to blend bottom scrim
}

/**
 * Generates highly polished HSL colors deterministically based on the title.
 * Used as a zero-latency fallback and initial color state.
 */
export function getHashColors(title: string): AmbientColors {
  const hash = hashString(title || 'Strmly');
  const hue = Math.abs(hash) % 360;

  // Curate saturation and lightness for a premium dark interface
  const s = 65; // 65% saturation for vibrant glows
  const lGlow = 52; // 52% lightness for glow elements

  return {
    color1: `hsla(${hue}, ${s}%, ${lGlow}%, 0.16)`,
    color2: `hsla(${(hue + 45) % 360}, ${s - 10}%, ${lGlow - 5}%, 0.10)`,
    bg: `hsl(${hue}, 28%, 9%)`,
    bgSolid: `hsl(${hue}, 28%, 6%)`
  };
}

/**
 * Converts standard RGB values to HSL color coordinates.
 */
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Asynchronously loads a backdrop image and extracts its dominant color.
 * Converts to HSL and maps to beautiful glow variables.
 */
export function extractColorsFromImage(imageUrl: string): Promise<AmbientColors | null> {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve(null);
      return;
    }

    const img = new Image();
    // Allow cross-origin images to be read in canvas (TMDB supports CORS)
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 12;
        canvas.height = 12;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, 12, 12);
        const data = ctx.getImageData(0, 0, 12, 12).data;

        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let pixelCount = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 150) continue; // ignore transparent pixels

          // Calculate perceived brightness
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          // Filter out completely black or pure white pixels for richer accents
          if (brightness > 15 && brightness < 240) {
            rSum += r;
            gSum += g;
            bSum += b;
            pixelCount++;
          }
        }

        if (pixelCount === 0) {
          resolve(null);
          return;
        }

        const avgR = Math.round(rSum / pixelCount);
        const avgG = Math.round(gSum / pixelCount);
        const avgB = Math.round(bSum / pixelCount);

        const { h, s, l } = rgbToHsl(avgR, avgG, avgB);

        // Curate values for premium glow looks
        const saturation = Math.max(s, 55); // make sure it's somewhat colorful
        const lightness = Math.max(Math.min(l, 65), 45); // keep it mid-range for glow

        resolve({
          color1: `hsla(${h}, ${saturation}%, ${lightness}%, 0.18)`,
          color2: `hsla(${(h + 40) % 360}, ${Math.max(saturation - 10, 45)}%, ${Math.max(lightness - 5, 42)}%, 0.10)`,
          bg: `hsl(${h}, ${Math.min(saturation, 30)}%, 9%)`,
          bgSolid: `hsl(${h}, ${Math.min(saturation, 30)}%, 6%)`
        });
      } catch (err) {
        console.warn('Canvas color extraction failed:', err);
        resolve(null);
      }
    };

    img.onerror = () => {
      resolve(null);
    };
  });
}
