import { TMDB_CACHE_VERSION } from '../constants';
import {
  tmdbCache,
  getResolvedTmdbResult,
  resolveTmdbImageSrc
} from './tmdb';

self.onmessage = async (e: MessageEvent<any>) => {
  const { items, apiKey } = e.data;
  if (!items || !items.length || !apiKey) {
    self.postMessage({ success: true, type: 'completed' });
    return;
  }

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const cacheKeyPortrait = `${TMDB_CACHE_VERSION}-${item.itemType}-${item.cleanTitle}-portrait`;
    const cacheKeyLandscape = `${TMDB_CACHE_VERSION}-${item.itemType}-${item.cleanTitle}-landscape`;

    try {
      // 1. Check IndexedDB first
      const port = await tmdbCache.get(`resolved-poster-${cacheKeyPortrait}`);
      const land = await tmdbCache.get(`resolved-poster-${cacheKeyLandscape}`);
      
      if (port !== null && land !== null) {
        self.postMessage({
          success: true,
          type: 'progress',
          cleanTitle: item.cleanTitle,
          itemType: item.itemType,
          portraitSrc: port,
          landscapeSrc: land
        });
        continue;
      }

      // 2. Fetch from TMDB API
      const result = await getResolvedTmdbResult(item.endpoint, apiKey, item.cleanTitle);
      const portraitSrc = (await resolveTmdbImageSrc(result?.poster_path, 'w500')) || '';
      const landscapeSrc = (await resolveTmdbImageSrc(result?.backdrop_path || result?.poster_path, 'w500')) || '';

      // Save to IndexedDB (only non-app-file URLs)
      if (portraitSrc && !portraitSrc.startsWith('app-file://')) {
        await tmdbCache.set(`resolved-poster-${cacheKeyPortrait}`, portraitSrc);
        await tmdbCache.set(`resolved-poster-${cacheKeyLandscape}`, landscapeSrc);
      }

      self.postMessage({
        success: true,
        type: 'progress',
        cleanTitle: item.cleanTitle,
        itemType: item.itemType,
        portraitSrc,
        landscapeSrc
      });

      // 500ms sleep to prevent TMDB 429 Too Many Requests rate-limiting
      await delay(500);
    } catch (err: any) {
      console.warn(`Worker crawling failed for ${item.cleanTitle}:`, err);
      // Even on failure, wait a bit
      await delay(1000);
    }
  }

  self.postMessage({ success: true, type: 'completed' });
};
