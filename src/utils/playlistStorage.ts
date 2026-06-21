import type { PlaylistItem } from './m3uParser';

const DB_NAME = 'strmly-playlists';
const STORE_NAME = 'playlists';
const DB_VERSION = 1;

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return databasePromise;
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function savePlaylistToBrowserStorage(id: string, items: PlaylistItem[]): Promise<void> {
  await runTransaction('readwrite', store => store.put(items, id));
}

export async function loadPlaylistFromBrowserStorage(id: string): Promise<PlaylistItem[]> {
  const stored = await runTransaction<PlaylistItem[] | undefined>('readonly', store => store.get(id));
  if (stored) return stored;

  // One-time migration for playlists saved by older web builds.
  const legacyKey = `cinema_playlist_items_${id}`;
  const legacyValue = localStorage.getItem(legacyKey);
  if (!legacyValue) return [];

  const items = JSON.parse(legacyValue) as PlaylistItem[];
  await savePlaylistToBrowserStorage(id, items);
  localStorage.removeItem(legacyKey);
  return items;
}

export async function deletePlaylistFromBrowserStorage(id: string): Promise<void> {
  await runTransaction('readwrite', store => store.delete(id));
  localStorage.removeItem(`cinema_playlist_items_${id}`);
}
