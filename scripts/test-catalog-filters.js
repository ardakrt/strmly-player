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
  sortByNameAzZa,
  takeTopByScore,
  dailyStableScore,
} = require(catalogOut);

const { urlHasVodExtension, preprocessPlaylistItems, getQualityRank } = require(searchOut);
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

// --- url / preprocess ---
assert.strictEqual(urlHasVodExtension('http://x/a/movie.mp4'), true);
assert.strictEqual(urlHasVodExtension('http://x/a/movie.mp4?token=1'), true);
assert.strictEqual(urlHasVodExtension('http://x/live/stream.m3u8'), false);
assert.strictEqual(getQualityRank('Film 1080p', 'film 1080p'), 3);

const raw = [
  { name: 'Live One', group: 'Live', url: 'http://x/live/1.m3u8', type: 'live' },
  { name: 'Show S01E01', group: 'Dizi', url: 'http://x/files/show.mkv', type: 'live' },
  { name: 'Film Name', group: 'Sinema', url: 'http://x/movie/1', type: 'live' },
];
preprocessPlaylistItems(raw);
assert.strictEqual(raw[0].type, 'live');
assert.strictEqual(raw[1].type, 'series', 'vod+episode name → series');
assert.strictEqual(raw[2].type, 'movie', '/movie/ path → movie');
assert.ok(raw[0].nameLower && raw[0].qualityRank);

// --- series grouping dedup ---
const eps = [
  { name: 'Demo S01E01', group: 'Drama', url: 'u1', type: 'series', logo: 'a.png' },
  { name: 'Demo S01E01', group: 'Drama', url: 'u1b', type: 'series', logo: '' }, // dup episode
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
