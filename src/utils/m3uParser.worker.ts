import { parseM3U } from './m3uParser';
import { preprocessPlaylistItems } from './searchHelpers';

self.onmessage = (e: MessageEvent<string>) => {
  try {
    const result = parseM3U(e.data);
    result.items = preprocessPlaylistItems(result.items);
    self.postMessage({ success: true, result });
  } catch (err: any) {
    self.postMessage({ success: false, error: err.message || String(err) });
  }
};

