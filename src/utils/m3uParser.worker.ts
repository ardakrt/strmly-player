import { parseM3U } from './m3uParser';
import { preprocessPlaylistItems } from './searchHelpers';

self.onmessage = (e: MessageEvent<string | ArrayBuffer>) => {
  try {
    let content: string;
    if (e.data instanceof ArrayBuffer) {
      content = new TextDecoder('utf-8').decode(e.data);
    } else {
      content = e.data;
    }
    const result = parseM3U(content);
    result.items = preprocessPlaylistItems(result.items);
    self.postMessage({ success: true, result });
  } catch (err: any) {
    self.postMessage({ success: false, error: err.message || String(err) });
  }
};
