export const AUTOPLAY_NEXT_KEY = 'cinema_player_autoplay_next';
export const BUFFER_ENABLED_KEY = 'strmly_buffer_enabled';
export const BUFFER_SIZE_KEY = 'strmly_buffer_size';
export const CONNECTION_TIMEOUT_KEY = 'strmly_connection_timeout';
export const RETRY_COUNT_KEY = 'strmly_retry_count';

export const DEFAULT_BUFFER_SECONDS = 30;
export const DEFAULT_CONNECTION_TIMEOUT_SECONDS = 22;
export const DEFAULT_RETRY_COUNT = 3;

type StorageReader = Pick<Storage, 'getItem'>;

function readBoolean(storage: StorageReader, key: string, fallback: boolean) {
  const value = storage.getItem(key);
  return value === null ? fallback : value === 'true';
}

function readBoundedNumber(
  storage: StorageReader,
  key: string,
  fallback: number,
  min: number,
  max: number,
) {
  const value = Number(storage.getItem(key));
  return Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback;
}

export function getPlaybackSettings(storage: StorageReader = localStorage) {
  return {
    autoPlayNext: readBoolean(storage, AUTOPLAY_NEXT_KEY, true),
    bufferEnabled: readBoolean(storage, BUFFER_ENABLED_KEY, false),
    bufferSeconds: readBoundedNumber(storage, BUFFER_SIZE_KEY, DEFAULT_BUFFER_SECONDS, 5, 120),
    connectionTimeoutSeconds: readBoundedNumber(
      storage,
      CONNECTION_TIMEOUT_KEY,
      DEFAULT_CONNECTION_TIMEOUT_SECONDS,
      3,
      60,
    ),
    retryCount: readBoundedNumber(storage, RETRY_COUNT_KEY, DEFAULT_RETRY_COUNT, 0, 10),
  };
}
