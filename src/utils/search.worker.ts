import type { PlaylistItem } from './m3uParser';
import type { GroupedSeries } from './seriesGroupers';
import {
  getItemCleanNameLower,
  getItemGroupLower,
  getItemNameLower,
  getItemSearchScore,
  getQualityRank,
  isHdChannel
} from './searchHelpers';

// Local storage in worker memory
let itemBuckets: { live: PlaylistItem[]; movie: PlaylistItem[]; series: PlaylistItem[] } = { live: [], movie: [], series: [] };
let allGroupedSeries: GroupedSeries[] = [];
let hiddenCategories: string[] = [];
let hiddenMovieCategories: string[] = [];
let hiddenSeriesCategories: string[] = [];

self.onmessage = (e: MessageEvent) => {
  const data = e.data;
  if (!data) return;

  if (data.action === 'set_data') {
    itemBuckets = data.itemBuckets || { live: [], movie: [], series: [] };
    allGroupedSeries = data.allGroupedSeries || [];
    hiddenCategories = data.hiddenCategories || [];
    hiddenMovieCategories = data.hiddenMovieCategories || [];
    hiddenSeriesCategories = data.hiddenSeriesCategories || [];
  } else if (data.action === 'search') {
    const query = data.query || '';
    const scope = data.scope || 'all';
    const searchId = data.searchId;

    if (!query.trim()) {
      self.postMessage({ action: 'search_results', results: [], searchId });
      return;
    }

    const q = query.trim().toLocaleLowerCase('tr-TR');
    const hiddenLiveSet = new Set(hiddenCategories);
    const hiddenMovieSet = new Set(hiddenMovieCategories);
    const hiddenSeriesSet = new Set(hiddenSeriesCategories);

    const matches: Array<{
      type: 'live' | 'movie' | 'series';
      item: PlaylistItem | GroupedSeries;
      score: number;
    }> = [];

    // Live TV Search
    if (scope === 'all' || scope === 'live') {
      const liveItems = itemBuckets.live;
      for (let i = 0; i < liveItems.length; i++) {
        const ch = liveItems[i];
        if (hiddenLiveSet.has(ch.group || 'Genel')) continue;
        const groupLower = getItemGroupLower(ch);
        if (groupLower.includes('ulusal') && !isHdChannel(ch.name)) continue;
        const score = getItemSearchScore(ch, query);
        if (score > 0) {
          matches.push({ type: 'live', item: ch, score });
        }
      }
    }

    // Movies Search
    if (scope === 'all' || scope === 'movie') {
      const movieItems = itemBuckets.movie;
      const dedupedMovies: Record<string, { item: PlaylistItem; score: number; qualityRank: number }> = {};
      for (let i = 0; i < movieItems.length; i++) {
        const ch = movieItems[i];
        if (hiddenMovieSet.has(ch.group || 'Genel')) continue;
        const clNameLower = getItemCleanNameLower(ch);
        const nameLower = getItemNameLower(ch);
        const score = getItemSearchScore(ch, query);
        if (score > 0) {
          const qRank = getQualityRank(ch.name, nameLower);
          const existing = dedupedMovies[clNameLower];
          if (!existing || score > existing.score || (score === existing.score && qRank > existing.qualityRank)) {
            dedupedMovies[clNameLower] = { item: ch, score, qualityRank: qRank };
          }
        }
      }
      Object.values(dedupedMovies).forEach(m => {
        matches.push({ type: 'movie', item: m.item, score: m.score });
      });
    }

    // Series Search
    if (scope === 'all' || scope === 'series') {
      const dedupedSeries: Record<string, { item: GroupedSeries; score: number }> = {};
      for (let i = 0; i < allGroupedSeries.length; i++) {
        const series = allGroupedSeries[i];
        if (hiddenSeriesSet.has(series.group || 'Genel')) continue;
        const sNameLower = getItemNameLower(series);
        const score = getItemSearchScore(series, query);

        let episodeMatch = false;
        const seasons = Object.values(series.seasons);
        for (let s = 0; s < seasons.length; s++) {
          const episodes = seasons[s];
          for (let e = 0; e < episodes.length; e++) {
            const ep = episodes[e];
            const epNameLower = ep.item.nameLower || ep.item.name.toLocaleLowerCase('tr-TR');
            if (epNameLower.includes(q)) {
              episodeMatch = true;
              break;
            }
          }
          if (episodeMatch) break;
        }
        const finalScore = score > 0 ? score : (episodeMatch ? 50 : 0);
        if (finalScore > 0) {
          const existing = dedupedSeries[sNameLower];
          if (!existing || finalScore > existing.score) {
            dedupedSeries[sNameLower] = { item: series, score: finalScore };
          }
        }
      }
      Object.values(dedupedSeries).forEach(s => {
        matches.push({ type: 'series', item: s.item, score: s.score });
      });
    }

    // Sort matches by score descending
    matches.sort((a, b) => b.score - a.score);
    
    self.postMessage({ action: 'search_results', results: matches, searchId });
  } else if (data.action === 'get_home_candidates') {
    const activePrefs = data.activeContentPreferences || [];
    const rawItems = data.items || [];
    const buckets = data.itemBuckets || { live: [], movie: [], series: [] };

    const vodItems = [...buckets.movie, ...buckets.series];
    const candidatesSource = vodItems.length > 0 ? vodItems : rawItems;

    const getCandidateSuitabilityScore = (item: PlaylistItem) => {
      const name = item.name.toLowerCase();
      const group = (item.group || '').toLowerCase();

      // Exclusions (pushed to the very bottom)
      const excludeKeywords = ['7/24', '24/7', 'seç izle', 'sec izle', 'seçizle', 'secizle', 'sinema tv', 'sinematv', 'live', 'raw', 'test', 'promo', 'fragman'];
      if (excludeKeywords.some(kw => name.includes(kw) || group.includes(kw))) {
        return -10000;
      }

      let score = 0;

      // Prioritize curated VOD platforms and high-quality categories.
      const premiumKeywords = [
        'netflix', 'amazon', 'prime', 'disney', 'apple', 'hbo',
        'exxen', 'blu tv', 'blutv', 'uhd', '4k', '1080p',
        'yabancı film', 'yabancı dizi', 'popüler', 'vizyon', 'trend',
        'sine', 'türkçe dublaj', 'türkçe altyazı', 'aksiyon', 'bilim kurgu'
      ];
      for (const kw of premiumKeywords) {
        if (group.includes(kw)) score += 50;
        if (name.includes(kw)) score += 20;
      }

      // Favor VOD types over general type
      if (item.type === 'series') score += 30;
      if (item.type === 'movie') score += 20;

      if (activePrefs.includes('series') && item.type === 'series') score += 180;
      if (activePrefs.includes('movies') && item.type === 'movie') score += 180;
      if (activePrefs.includes('kids')) {
        const kidsKeywords = ['çocuk', 'cocuk', 'kids', 'çizgi', 'cizgi', 'animasyon', 'cartoon', 'disney', 'nickelodeon'];
        if (kidsKeywords.some(keyword => name.includes(keyword) || group.includes(keyword))) score += 240;
      }

      return score;
    };

    const sortedCandidatesSource = [...candidatesSource]
      .map(item => ({ item, score: getCandidateSuitabilityScore(item) }))
      .sort((a, b) => b.score - a.score)
      .map(x => x.item);

    // Return the top 500 sorted candidates
    const topCandidates = sortedCandidatesSource.slice(0, 500);

    self.postMessage({
      action: 'home_candidates_results',
      candidates: topCandidates
    });
  } else if (data.action === 'preload_tmdb_cache') {
    const dbName = 'tmdb_cache_db';
    const storeName = 'tmdb_cache_store';
    
    try {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        try {
          const transaction = db.transaction(storeName, 'readonly');
          const store = transaction.objectStore(storeName);
          const range = IDBKeyRange.bound("resolved-", "resolved-\uffff");
          const keysRequest = store.getAllKeys(range);
          
          keysRequest.onsuccess = () => {
            const keys = keysRequest.result;
            const valuesRequest = store.getAll(range);
            
            valuesRequest.onsuccess = () => {
              const values = valuesRequest.result;
              const cacheData: Record<string, string> = {};
              for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const value = values[i];
                if (value && typeof key === 'string') {
                  cacheData[key] = value;
                }
              }
              self.postMessage({
                action: 'tmdb_preload_results',
                cacheData
              });
              db.close();
            };
            valuesRequest.onerror = () => {
              self.postMessage({ action: 'tmdb_preload_results', cacheData: {} });
              db.close();
            };
          };
          keysRequest.onerror = () => {
            self.postMessage({ action: 'tmdb_preload_results', cacheData: {} });
            db.close();
          };
        } catch {
          self.postMessage({ action: 'tmdb_preload_results', cacheData: {} });
          db.close();
        }
      };
      request.onerror = () => {
        self.postMessage({ action: 'tmdb_preload_results', cacheData: {} });
      };
    } catch {
      self.postMessage({ action: 'tmdb_preload_results', cacheData: {} });
    }
  }
};
