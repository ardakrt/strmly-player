/**
 * Structural accessibility scan for high-risk interactive controls.
 * Asserts shipped JSX <button> elements expose an accessible name via
 * aria-label / aria-labelledby or non-empty textual content inside the button.
 *
 * Run: node scripts/check-a11y-controls.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const HIGH_RISK_FILES = [
  'src/components/CinematicPlayer.tsx',
  'src/components/DownloadsView.tsx',
  'src/components/SeriesModal.tsx',
  'src/components/ChannelModal.tsx',
  'src/components/SpotlightSearch.tsx',
  'src/components/FavoritesEmptyState.tsx',
  'src/components/CreateProfileWizard.tsx',
  'src/components/Navbar.tsx',
  'src/components/HomeHoverPreview.tsx',
];

const REQUIRED_PATTERNS = [
  {
    id: 'player-mute',
    re: /aria-label=\{[^}]*(Mute|Sessiz)/i,
    files: ['src/components/CinematicPlayer.tsx'],
  },
  {
    id: 'player-fullscreen',
    re: /aria-label=\{[^}]*(Fullscreen|Tam Ekran)/i,
    files: ['src/components/CinematicPlayer.tsx'],
  },
  {
    id: 'modal-close',
    re: /aria-label=\{[^}]*(Close|Kapat)|aria-label="(Close|Kapat)"/i,
    files: ['src/components/SeriesModal.tsx', 'src/components/ChannelModal.tsx'],
  },
  {
    id: 'voice-search',
    re: /aria-label=\{[^}]*(Voice|Sesle)/i,
    files: ['src/components/SpotlightSearch.tsx'],
  },
  {
    id: 'download-pause-or-cancel',
    re: /aria-label=\{[^}]*(Pause|Duraklat|Cancel|İptal|Iptal)/i,
    files: ['src/components/DownloadsView.tsx'],
  },
];

function extractButtons(source) {
  const buttons = [];
  const re = /<button\b/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const start = m.index;
    let i = start + 7;
    let depth = 0;
    let inStr = null;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (inStr) {
        if (ch === inStr && source[i - 1] !== '\\') inStr = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inStr = ch;
        continue;
      }
      if (ch === '{') depth++;
      if (ch === '}') depth = Math.max(0, depth - 1);
      if (ch === '>' && depth === 0) {
        i++;
        break;
      }
    }
    const openTag = source.slice(start, i);
    // Capture body until matching </button> (depth of nested buttons ignored for simplicity)
    const closeIdx = source.indexOf('</button>', i);
    const body = closeIdx === -1 ? '' : source.slice(i, closeIdx);
    buttons.push({ openTag, body, index: start });
  }
  return buttons;
}

function bodyHasTextName(body) {
  if (!body) return false;
  // Strip JSX tags and expressions that are only components/icons
  let stripped = body
    .replace(/\{[^}]*\}/g, (expr) => {
      // Keep string-literal expressions and simple label fields
      if (/['"`][^'"`]+['"`]/.test(expr)) return ' TEXT ';
      if (/\.\s*label\b|t\(|language\s*===|getTranslation|option\.|\.name\b|\.title\b/.test(expr)) {
        return ' TEXT ';
      }
      return ' ';
    })
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length >= 1 && /[A-Za-zÀ-ÿ0-9]/.test(stripped)) return true;
  // Template-like speed labels "1.5x" etc. after strip may remain
  if (/\d/.test(stripped)) return true;
  return false;
}

function hasAccessibleName(openTag, body) {
  if (/aria-label\s*=/.test(openTag)) return true;
  if (/aria-labelledby\s*=/.test(openTag)) return true;
  if (bodyHasTextName(body)) return true;
  return false;
}

function lineOf(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

const failures = [];
const summary = [];

for (const rel of HIGH_RISK_FILES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    failures.push(`MISSING_FILE ${rel}`);
    continue;
  }
  const source = fs.readFileSync(abs, 'utf8');
  const buttons = extractButtons(source);
  let unlabeled = 0;
  for (const b of buttons) {
    if (!hasAccessibleName(b.openTag, b.body)) {
      unlabeled++;
      failures.push(
        `${rel}:${lineOf(source, b.index)} button missing accessible name (aria-label/labelledby/text)`,
      );
    }
  }
  const ariaCount = (source.match(/aria-label\s*=/g) || []).length;
  summary.push({ file: rel, buttons: buttons.length, ariaLabels: ariaCount, unlabeled });
}

for (const req of REQUIRED_PATTERNS) {
  let found = false;
  for (const rel of req.files) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const source = fs.readFileSync(abs, 'utf8');
    if (req.re.test(source)) {
      found = true;
      break;
    }
  }
  if (!found) {
    failures.push(`REQUIRED_PATTERN_MISSING ${req.id} (expected in ${req.files.join(', ')})`);
  }
}

console.log('a11y-controls scan summary:');
for (const row of summary) {
  console.log(
    `  ${row.file}: buttons=${row.buttons} aria-label_attrs=${row.ariaLabels} unlabeled=${row.unlabeled}`,
  );
}

if (failures.length) {
  console.error('a11y-controls FAIL:');
  for (const f of failures) console.error('  -', f);
  process.exit(1);
}

console.log('a11y-controls: PASS');
process.exit(0);
