import {
  tmdbCache,
  getResolvedTmdbResult,
  getTmdbPosterCacheKey,
  resolveTmdbImageSrc,
  TMDB_NO_MATCH
} from './tmdb';

self.onmessage = async (e: MessageEvent<any>) => {
  const { items, apiKey } = e.data;
  if (!items || !items.length || !apiKey) {
    self.postMessage({ success: true, type: 'completed' });
    return;
  }

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const crawlItem = async (item: any) => {
    const cacheKeyPortrait = getTmdbPosterCacheKey(item.itemType, item.cleanTitle, 'portrait');
    const cacheKeyLandscape = getTmdbPosterCacheKey(item.itemType, item.cleanTitle, 'landscape');

    try {
      // 1. Check IndexedDB first
      const port = await tmdbCache.get(`resolved-poster-${cacheKeyPortrait}`);
      const land = await tmdbCache.get(`resolved-poster-${cacheKeyLandscape}`);
      
      // Known no-match titles: nothing to crawl, ever.
      if (port === TMDB_NO_MATCH && land === TMDB_NO_MATCH) {
        return;
      }

      if (typeof port === 'string' && port.trim() && typeof land === 'string' && land.trim()) {
        self.postMessage({
          success: true,
          type: 'progress',
          cleanTitle: item.cleanTitle,
          itemType: item.itemType,
          portraitSrc: port,
          landscapeSrc: land
        });
        return;
      }

      // 2. Fetch from TMDB API
      const result = await getResolvedTmdbResult(item.endpoint, apiKey, item.cleanTitle);

      if (!result) {
        // Definitive no-match — persist the marker so this title is never
        // re-crawled on future sessions.
        await tmdbCache.set(`resolved-poster-${cacheKeyPortrait}`, TMDB_NO_MATCH);
        await tmdbCache.set(`resolved-poster-${cacheKeyLandscape}`, TMDB_NO_MATCH);
        return;
      }

      const portraitSrc = (await resolveTmdbImageSrc(result?.poster_path, 'w500')) || '';
      const landscapeSrc = (await resolveTmdbImageSrc(result?.backdrop_path || result?.poster_path, 'w500')) || '';

      // Save to IndexedDB (app-file:// URLs included — the protocol handler
      // keeps them valid across restarts).
      if (portraitSrc) {
        await tmdbCache.set(`resolved-poster-${cacheKeyPortrait}`, portraitSrc);
      }
      if (landscapeSrc) {
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

    } catch (err: any) {
      console.warn(`Worker crawling failed for ${item.cleanTitle}:`, err);
    }
  };

  // Resolve a small batch in parallel. This makes the next viewport ready in
  // seconds instead of imposing a fixed 500ms delay on every single title,
  // while the shared TMDB/image queues still cap actual network concurrency.
  const BATCH_SIZE = 3;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    await Promise.all(items.slice(i, i + BATCH_SIZE).map(crawlItem));
    if (i + BATCH_SIZE < items.length) await delay(200);
  }

  self.postMessage({ success: true, type: 'completed' });
};
