/**
 * Unit tests for shipped catalog filter helpers.
 * Bundles the real TypeScript module via esbuild (npx), then asserts behavior.
 * Run: node scripts/test-catalog-filters.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const os = require('os');

const root = path.join(__dirname, '..');
const outFile = path.join(os.tmpdir(), `strmly-catalog-filters-${process.pid}.cjs`);

execSync(
  `npx --yes esbuild "${path.join(root, 'src/utils/catalogFilters.ts')}" --bundle --platform=node --format=cjs --outfile="${outFile}"`,
  { cwd: root, stdio: 'pipe' },
);

const {
  matchesQualityFilter,
  applyCatalogPostFilters,
  seriesMatchesQuery,
  sortByNameAzZa,
} = require(outFile);

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

try {
  fs.unlinkSync(outFile);
} catch {
  /* ignore */
}

console.log('catalog-filters tests passed');
process.exit(0);
