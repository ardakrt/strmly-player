/**
 * Unit tests for shipped catalog / preprocess / series-group helpers.
 * Bundles real TypeScript modules via esbuild, then asserts behavior.
 * Run: node scripts/test-catalog-filters.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const os = require('os');

const root = path.join(__dirname, '..');
const tmp = os.tmpdir();
const catalogOut = path.join(tmp, `strmly-catalog-filters-${process.pid}.cjs`);
const searchOut = path.join(tmp, `strmly-search-helpers-${process.pid}.cjs`);
const seriesOut = path.join(tmp, `strmly-series-groupers-${process.pid}.cjs`);

function bundle(entry, outfile) {
  execSync(
    `npx --yes esbuild "${entry}" --bundle --platform=node --format=cjs --outfile="${outfile}"`,
    { cwd: root, stdio: 'pipe' },
  );
}

bundle(path.join(root, 'src/utils/catalogFilters.ts'), catalogOut);
bundle(path.join(root, 'src/utils/searchHelpers.ts'), searchOut);
bundle(path.join(root, 'src/utils/seriesGroupers.ts'), seriesOut);

const {
  matchesQualityFilter,
  applyCatalogPostFilters,
  seriesMatchesQuery,
  seriesMatchesQuality,
  sortByNameAzZa,
  takeTopByScore,
  dailyStableScore,
} = require(catalogOut);

const {
  urlHasVodExtension,
  preprocessPlaylistItems,
  getQualityRank,
  isHdChannel,
} = require(searchOut);
const { groupPlaylistItemsToSeries } = require(seriesOut);

// --- quality / catalog filters ---
assert.strictEqual(matchesQualityFilter(4, '4k'), true);
assert.strictEqual(matchesQualityFilter(3, '4k'), false);
assert.strictEqual(matchesQualityFilter(2, 'hd'), true);
assert.strictEqual(matchesQualityFilter(1, 'all'), true);

const items = [
  { id: '1', name: 'TRT 1 HD', group: 'Ulusal', type: 'live', url: 'u1', nameLower: 'trt 1 hd', groupLower: 'ulusal' },
  { id: '2', name: 'TRT 1', group: 'Ulusal', type: 'live', url: 'u2', nameLower: 'trt 1', groupLower: 'ulusal' },
  { id: '3', name: 'Movie 4K', group: 'Sinema', type: 'movie', url: 'u3', nameLower: 'movie 4k', groupLower: 'sinema' },
  { id: '4', name: 'Other SD', group: 'Genel', type: 'live', url: 'u4', nameLower: 'other sd', groupLower: 'genel' },
];

const ulusalOnly = applyCatalogPostFilters(items, '', 'all');
assert.ok(ulusalOnly.some((i) => i.id === '1'), 'HD ulusal kept');
assert.ok(!ulusalOnly.some((i) => i.id === '2'), 'SD ulusal dropped');
assert.ok(ulusalOnly.some((i) => i.id === '3'), 'non-ulusal kept');

const q4k = applyCatalogPostFilters(items, 'movie', '4k');
assert.strictEqual(q4k.length, 1);
assert.strictEqual(q4k[0].id, '3');

const sorted = sortByNameAzZa([{ name: 'b' }, { name: 'a' }, { name: 'c' }], 'az');
assert.deepStrictEqual(
  sorted.map((x) => x.name),
  ['a', 'b', 'c'],
);

const series = {
  id: 's1',
  name: 'Demo Series',
  group: 'Drama',
  nameLower: 'demo series',
  groupLower: 'drama',
  seasons: {
    1: [{ item: { name: 'Demo Series S01E01', nameLower: 'demo series s01e01' } }],
  },
};
assert.strictEqual(seriesMatchesQuery(series, 's01e01'), true);
assert.strictEqual(seriesMatchesQuery(series, 'nomatch'), false);

// --- isHdChannel: historic Ulusal predicate (NOT getQualityRank) ---
assert.strictEqual(isHdChannel('TRT 1 HD'), true);
assert.strictEqual(isHdChannel('Show FHD'), true);
assert.strictEqual(isHdChannel('Film 4K'), true);
assert.strictEqual(isHdChannel('Kanal 1080'), true);
assert.strictEqual(isHdChannel('Kanal 720'), false, '720 alone is not HD under historic rule');
assert.strictEqual(isHdChannel('Show 720p'), false, '720p alone is not HD under historic Ulusal rule');
assert.strictEqual(isHdChannel('Film 2160p'), false, '2160p alone is not HD under historic Ulusal rule');
assert.strictEqual(isHdChannel('TRT 1'), false);
// getQualityRank still ranks 720 as 2 / 2160 as 4 — must not drive isHdChannel
assert.strictEqual(getQualityRank('Kanal 720', 'kanal 720'), 2);
assert.strictEqual(isHdChannel('Kanal 720'), false);

// --- seriesMatchesQuality: historic exclusive-ish buckets ---
function sq(name, filter) {
  return seriesMatchesQuality(
    { name, nameLower: name.toLocaleLowerCase('tr-TR'), group: 'G', seasons: {} },
    filter,
  );
}
assert.strictEqual(sq('drama 720', 'sd'), true, '720 alone → SD bucket');
assert.strictEqual(sq('drama 720', 'hd'), false, '720 alone → not HD bucket');
assert.strictEqual(sq('drama 720p', 'hd'), true, '720p → HD');
assert.strictEqual(sq('drama 720i', 'hd'), true, '720i → HD');
assert.strictEqual(sq('drama 2160', 'sd'), true, '2160 alone → SD (not 2160p)');
assert.strictEqual(sq('drama 2160', '4k'), false);
assert.strictEqual(sq('drama 2160p', '4k'), true);
assert.strictEqual(sq('drama 1080i', 'fhd'), true);
assert.strictEqual(sq('drama fhd', 'fhd'), true);
assert.strictEqual(sq('drama hd only', 'hd'), true);
assert.strictEqual(sq('drama fhd', 'hd'), false, 'fhd excluded from hd bucket');

// --- takeTopByScore equivalence vs full sort ---
const pool = [];
for (let i = 0; i < 200; i++) {
  pool.push({ id: i, name: `Item ${i}` });
}
const scoreOf = (x) => dailyStableScore(`seed-${x.name}`);
const topK = takeTopByScore(pool, scoreOf, 80);
const fullSortTop = pool
  .map((item, index) => ({ item, score: scoreOf(item), index }))
  .sort((a, b) => b.score - a.score || a.index - b.index)
  .slice(0, 80)
  .map((e) => e.item);
assert.strictEqual(topK.length, 80);
assert.deepStrictEqual(
  topK.map((x) => x.id),
  fullSortTop.map((x) => x.id),
  'takeTopByScore matches full sort top-80',
);

// --- urlHasVodExtension: parity with historic vodExtensions.some() ---
const vodExts = ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.mpeg', '.mpg', '.m4v', '.webm', '.wmv'];
function historicVod(urlLower) {
  return vodExts.some(
    (ext) =>
      urlLower.endsWith(ext) ||
      urlLower.includes(ext + '?') ||
      urlLower.includes(ext + '&') ||
      urlLower.includes('#' + ext) ||
      urlLower.includes('/' + ext),
  );
}
const vodUrls = [
  'http://x/a/movie.mp4',
  'http://x/a/movie.mp4?token=1',
  'http://x/a/file.mp4&sid=2',
  'http://x/vod/.mp4/stream',
  'http://x/a#.mp4',
  'http://cdn/x/movie.mkv',
  'http://cdn/x/.mkv/playlist',
  'http://x/live/stream.m3u8',
  'http://x/play/channel',
  'http://x/a/movie.mp4',
];
// force lowercase inputs as preprocess does
for (const u of vodUrls) {
  const lower = u.toLowerCase();
  assert.strictEqual(
    urlHasVodExtension(lower),
    historicVod(lower),
    `urlHasVodExtension parity for ${lower}`,
  );
}
assert.strictEqual(urlHasVodExtension('http://x/a/file.mp4&x=1'), true, '.mp4& without ?');
assert.strictEqual(urlHasVodExtension('http://x/vod/.mp4/chunk'), true, '/.mp4/ path segment');
assert.strictEqual(urlHasVodExtension('http://x/live/stream.m3u8'), false);

// preprocess must classify regression URLs as movie (VOD), not live
const raw = [
  { name: 'Live One', group: 'Live', url: 'http://x/live/1.m3u8', type: 'live' },
  { name: 'Show S01E01', group: 'Dizi', url: 'http://x/files/show.mkv', type: 'live' },
  { name: 'Film Name', group: 'Sinema', url: 'http://x/movie/1', type: 'live' },
  { name: 'Odd Path Film', group: 'Genel', url: 'http://cdn/vod/.mp4/part1', type: 'live' },
  { name: 'Amp Film', group: 'Genel', url: 'http://cdn/f.mp4&auth=1', type: 'live' },
];
preprocessPlaylistItems(raw);
assert.strictEqual(raw[0].type, 'live');
assert.strictEqual(raw[1].type, 'series', 'vod+episode name → series');
assert.strictEqual(raw[2].type, 'movie', '/movie/ path → movie');
assert.strictEqual(raw[3].type, 'movie', '/.mp4/ path → VOD movie (not live)');
assert.strictEqual(raw[4].type, 'movie', '.mp4& → VOD movie (not live)');
assert.ok(raw[0].nameLower && raw[0].qualityRank);

// --- series grouping dedup ---
const eps = [
  { name: 'Demo S01E01', group: 'Drama', url: 'u1', type: 'series', logo: 'a.png' },
  { name: 'Demo S01E01', group: 'Drama', url: 'u1b', type: 'series', logo: '' },
  { name: 'Demo S01E02', group: 'Drama', url: 'u2', type: 'series', logo: '' },
];
const grouped = groupPlaylistItemsToSeries(eps);
assert.strictEqual(grouped.length, 1);
assert.strictEqual(grouped[0].episodesCount, 2, 'duplicate episode not double-counted');
assert.strictEqual(grouped[0].seasons[1].length, 2);
assert.strictEqual(grouped[0].seasons[1][0].episodeNumber, 1);
assert.strictEqual(grouped[0].seasons[1][1].episodeNumber, 2);

for (const f of [catalogOut, searchOut, seriesOut]) {
  try {
    fs.unlinkSync(f);
  } catch {
    /* ignore */
  }
}

console.log('catalog-filters tests passed');
process.exit(0);
