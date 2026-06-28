import type { TmdbEndpoint, TmdbSearchResult, TmdbSearchResponse, TmdbTitleOverride } from '../types';
import { cleanMediaTitle } from './seriesGroupers';

// Global cache for TMDB poster lookups
export const globalPosterPromises: Record<string, Promise<string | null> | undefined> = {};
export const globalSyncPosterMap = new Map<string, string>();
const originalSet = globalSyncPosterMap.set.bind(globalSyncPosterMap);
const MAX_POSTER_MAP_SIZE = 10000;
globalSyncPosterMap.set = function(key: string, value: string) {
  if (this.size >= MAX_POSTER_MAP_SIZE && !this.has(key)) {
    const firstKey = this.keys().next().value;
    if (firstKey) this.delete(firstKey);
  }
  return originalSet(key, value);
};

// Simple IndexedDB cache helper
class IndexedDBCache {
  private dbName = 'tmdb_cache_db';
  private storeName = 'tmdb_cache_store';
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
        request.onsuccess = () => {
          this.db = request.result;
          resolve();
        };
        request.onerror = () => {
          console.error("IndexedDB open error:", request.error);
          resolve();
        };
      } catch (e) {
        console.error("IndexedDB is not supported or accessible", e);
        resolve();
      }
    });
    return this.initPromise;
  }

  async get(key: string): Promise<any> {
    await this.init();
    if (!this.db) return null;
    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      } catch (e) {
        console.error("IndexedDB get error:", e);
        resolve(null);
      }
    });
  }

  async set(key: string, value: any): Promise<void> {
    if (typeof key === 'string' && (key.startsWith('resolved-poster-') || key.startsWith('img-') || key.startsWith('resolved-still-'))) {
      globalSyncPosterMap.set(key, value);
    }
    await this.init();
    if (!this.db) return;
    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        store.put(value, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      } catch (e) {
        console.error("IndexedDB set error:", e);
        resolve();
      }
    });
  }

  async loadAllToMemory(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const worker = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (e) => {
          if (e.data.action === 'tmdb_preload_results') {
            const cacheData = e.data.cacheData || {};
            for (const key in cacheData) {
              globalSyncPosterMap.set(key, cacheData[key]);
            }
            worker.terminate();
            resolve();
          }
        };
        worker.onerror = () => {
          worker.terminate();
          resolve();
        };
        worker.postMessage({ action: 'preload_tmdb_cache' });
      } catch (err) {
        console.error("Failed to preload TMDB cache using worker:", err);
        resolve();
      }
    });
  }
}

export const tmdbCache = new IndexedDBCache();

const API_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CONCURRENT_TMDB_REQUESTS = 6;
const tmdbRequestsInFlight = new Map<string, Promise<unknown>>();
const tmdbRequestQueue: Array<() => void> = [];
let activeTmdbRequests = 0;

const runWithTmdbConcurrencyLimit = <T>(task: () => Promise<T>): Promise<T> => new Promise((resolve, reject) => {
  const run = () => {
    activeTmdbRequests += 1;
    task().then(resolve, reject).finally(() => {
      activeTmdbRequests -= 1;
      tmdbRequestQueue.shift()?.();
    });
  };

  if (activeTmdbRequests < MAX_CONCURRENT_TMDB_REQUESTS) run();
  else tmdbRequestQueue.push(run);
});

const waitForRequest = <T>(request: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) return request;
  if (signal.aborted) return Promise.reject(new DOMException('The user aborted a request.', 'AbortError'));

  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('The user aborted a request.', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    request.then(
      value => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      error => {
        signal.removeEventListener('abort', abort);
        reject(error);
      }
    );
  });
};

export function cleanMovieName(title: string): string {
  return cleanMediaTitle(title);
}

const isValidTmdbKey = (key: string) => /^[a-f0-9]{32}$/i.test(key);

export const getTmdbApiKey = () => {
  const bundledKey = import.meta.env.VITE_TMDB_API_KEY?.trim() || '';
  const storedKey = (typeof localStorage !== 'undefined'
    ? localStorage.getItem('cinema_tmdb_key')?.trim()
    : '') || '';
  
  if (isValidTmdbKey(bundledKey)) return bundledKey;
  if (isValidTmdbKey(storedKey)) return storedKey;
  
  return 'c7e12a2b1d8e1851399f4b92dc124332';
};

export const getTmdbLanguage = () => {
  try {
    const lang = localStorage.getItem('cinema_language');
    return lang === 'en' ? 'en-US' : 'tr-TR';
  } catch {
    return 'tr-TR';
  }
};

const normalizeTmdbText = (value: string) => value
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/ı/g, 'i')
  .replace(/ı/g, 'i')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const TMDB_TITLE_OVERRIDES: Record<string, TmdbTitleOverride> = {
  konusanlar: {
    endpoint: 'tv',
    id: 115641,
    fallback: {
      id: 115641,
      name: 'Konuşanlar',
      original_name: 'Konuşanlar',
      original_language: 'tr',
      poster_path: '/gTJZ9d49dLI2m1vv1Ufi3Cx7rMt.jpg',
      backdrop_path: '/yRfroDcvczmBqyoM0VpTggBG7kO.jpg',
      overview: 'Senarist komedyen Hasan Can Kaya\'nın hazırlayıp sunduğu, odağına mizahı alan talk show formatı.',
      vote_average: 6.2,
      vote_count: 20,
      first_air_date: '2020-05-12',
      popularity: 20
    }
  }
};

export const getTmdbNames = (result: TmdbSearchResult) => [
  result.name,
  result.title,
  result.original_name,
  result.original_title
].filter((value): value is string => Boolean(value));

export const scoreTmdbResult = (result: TmdbSearchResult, cleanTitle: string) => {
  const query = normalizeTmdbText(cleanTitle);
  const names = getTmdbNames(result).map(normalizeTmdbText);
  let score = 0;

  for (const name of names) {
    if (name === query) score = Math.max(score, 120);
    else if (name.startsWith(query)) score = Math.max(score, 92);
    else if (query.startsWith(name)) score = Math.max(score, 82);
    else if (name.includes(query)) score = Math.max(score, 70);
    else {
      const queryWords = query.split(' ').filter(Boolean);
      const matchedWords = queryWords.filter(word => name.includes(word)).length;
      if (queryWords.length > 0) {
        score = Math.max(score, Math.round((matchedWords / queryWords.length) * 55));
      }
    }
  }

  if (result.poster_path) score += 16;
  if (result.backdrop_path) score += 4;
  if (result.original_language === 'tr') score += 14;
  if (result.vote_count) score += Math.min(result.vote_count, 100) / 20;
  if (result.popularity) score += Math.min(result.popularity, 50) / 10;

  return score;
};

export const selectBestTmdbResult = (results: TmdbSearchResult[] | undefined, cleanTitle: string) => {
  if (!results?.length) return null;
  const bestResult = [...results]
    .filter(result => getTmdbNames(result).length > 0)
    .sort((a, b) => scoreTmdbResult(b, cleanTitle) - scoreTmdbResult(a, cleanTitle))[0] || null;
  if (!bestResult) return null;
  return scoreTmdbResult(bestResult, cleanTitle) >= 68 ? bestResult : null;
};

export const buildTmdbSearchPath = (endpoint: TmdbEndpoint, apiKey: string, cleanTitle: string) => {
  const params = new URLSearchParams({
    api_key: apiKey,
    query: cleanTitle,
    language: getTmdbLanguage(),
    include_adult: 'false'
  });
  return `/3/search/${endpoint}?${params.toString()}`;
};

export const buildTmdbDetailsPath = (endpoint: TmdbEndpoint, apiKey: string, id: number) => {
  const params = new URLSearchParams({
    api_key: apiKey,
    language: getTmdbLanguage()
  });
  return `/3/${endpoint}/${id}?${params.toString()}`;
};

export const fetchTmdbPath = async <T extends { error?: string }>(path: string, signal?: AbortSignal): Promise<T> => {
  if (signal?.aborted) {
    throw new DOMException('The user aborted a request.', 'AbortError');
  }
  const cleanCachePath = path.replace(/[?&]api_key=[^&]+/, '');
  const cacheKey = `api-${cleanCachePath}`;
  let sharedRequest = tmdbRequestsInFlight.get(cacheKey) as Promise<T> | undefined;
  if (!sharedRequest) {
    sharedRequest = (async () => {
      try {
        const cached = await tmdbCache.get(cacheKey);
        if (cached?.cachedAt && Date.now() - cached.cachedAt < API_CACHE_TTL_MS) {
          return cached.value as T;
        }
        if (cached && !cached.cachedAt) {
          void tmdbCache.set(cacheKey, { value: cached, cachedAt: Date.now() });
          return cached as T;
        }
      } catch (e) {
        console.error("Cache read error:", e);
      }

      const responseData = await runWithTmdbConcurrencyLimit(async () => {
        if (window.electronAPI?.fetchTmdb) {
          return await window.electronAPI.fetchTmdb(path) as T;
        }
        const response = await fetch(`https://api.themoviedb.org${path}`);
        return await response.json() as T;
      });

      if (responseData && !responseData.error) {
        try {
          await tmdbCache.set(cacheKey, { value: responseData, cachedAt: Date.now() });
        } catch (e) {
          console.error("Cache write error:", e);
        }
      }
      return responseData;
    })().finally(() => tmdbRequestsInFlight.delete(cacheKey));
    tmdbRequestsInFlight.set(cacheKey, sharedRequest);
  }

  const responseData = await waitForRequest(sharedRequest, signal);
  if (signal?.aborted) {
    throw new DOMException('The user aborted a request.', 'AbortError');
  }

  return responseData;
};

export const fetchTmdbSearch = async (endpoint: TmdbEndpoint, apiKey: string, cleanTitle: string, signal?: AbortSignal): Promise<TmdbSearchResponse> => {
  return fetchTmdbPath<TmdbSearchResponse>(buildTmdbSearchPath(endpoint, apiKey, cleanTitle), signal);
};

export const fetchTmdbDetails = async (endpoint: TmdbEndpoint, apiKey: string, id: number, signal?: AbortSignal): Promise<TmdbSearchResult & { error?: string }> => {
  return fetchTmdbPath<TmdbSearchResult & { error?: string }>(buildTmdbDetailsPath(endpoint, apiKey, id), signal);
};

export const getTmdbOverride = (endpoint: TmdbEndpoint, cleanTitle: string) => {
  const override = TMDB_TITLE_OVERRIDES[normalizeTmdbText(cleanTitle)];
  return override?.endpoint === endpoint ? override : undefined;
};

export const getResolvedTmdbResult = async (endpoint: TmdbEndpoint, apiKey: string, cleanTitle: string, signal?: AbortSignal) => {
  const override = getTmdbOverride(endpoint, cleanTitle);
  if (override) {
    try {
      const details = await fetchTmdbDetails(endpoint, apiKey, override.id, signal);
      if (!details.error && getTmdbNames(details).length > 0) {
        return details;
      }
    } catch {
      // Use pinned metadata when TMDB is temporarily unreachable.
    }
    return override.fallback;
  }

  const data = await fetchTmdbSearch(endpoint, apiKey, cleanTitle, signal);
  if (data.error) throw new Error(data.error);
  return selectBestTmdbResult(data.results, cleanTitle);
};

export const getTmdbImageUrl = (path?: string | null, size = 'w500') => (
  path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined
);

export const resolveTmdbImageSrc = async (path?: string | null, size = 'w500', signal?: AbortSignal) => {
  if (!path) return undefined;

  const cacheKey = `img-${size}-${path}`;
  const syncCached = globalSyncPosterMap.get(cacheKey);
  if (syncCached) {
    return syncCached;
  }

  try {
    const cached = await tmdbCache.get(cacheKey);
    if (cached && !String(cached).startsWith('app-file://')) {
      // Cache in memory for subsequent synchronous renders of this image
      globalSyncPosterMap.set(cacheKey, cached);
      return cached;
    }
  } catch (e) {
    console.error("Cache read error:", e);
  }

  if (signal?.aborted) {
    throw new DOMException('The user aborted a request.', 'AbortError');
  }

  const remoteUrl = getTmdbImageUrl(path, size);

  // Download to local disk (await it so we return local path directly)
  if (window.electronAPI?.fetchTmdbImage) {
    try {
      const image = await window.electronAPI.fetchTmdbImage(path, size);
      const resultUrl = image.localUrl || image.dataUrl;
      if (resultUrl) {
        // Only cache in session memory — app-file:// paths are install-specific
        // and become stale when the app is reinstalled or cache is cleared.
        // The IPC handler has its own disk-level cache (fs.existsSync) so this is fast.
        globalSyncPosterMap.set(cacheKey, resultUrl);
        return resultUrl;
      }
    } catch (err) {
      console.warn("Electron image download failed:", err);
    }
  }

  if (remoteUrl) {
    globalSyncPosterMap.set(cacheKey, remoteUrl);
    
    // Browser fallback: fetch blob in background and cache as base64
    fetch(remoteUrl)
      .then((response) => {
        if (response.ok) return response.blob();
        throw new Error("Fetch failed");
      })
      .then((blob) => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      })
      .then((base64) => {
        tmdbCache.set(cacheKey, base64).catch((err) => {
          console.error("Cache write error in background browser fetch:", err);
        });
      })
      .catch((err) => {
        console.warn("Background browser image download failed:", err);
      });
  }

  return remoteUrl;
};

export const getCachedTmdbResult = async (endpoint: 'tv' | 'movie', title: string): Promise<any> => {
  if (!title) return null;
  const cleanTitle = cleanMovieName(title);
  const cacheKey = `api-/3/search/${endpoint}?query=${encodeURIComponent(cleanTitle)}&include_adult=false&page=1`;
  try {
    const cached = await tmdbCache.get(cacheKey);
    if (cached?.value?.results?.[0]) {
      return cached.value.results[0];
    }
    if (cached?.results?.[0]) {
      return cached.results[0];
    }
  } catch {
    return null;
  }
  return null;
};
