import { parseM3U } from './m3uParser';

self.onmessage = (e: MessageEvent<string>) => {
  try {
    const result = parseM3U(e.data);
    self.postMessage({ success: true, result });
  } catch (err: any) {
    self.postMessage({ success: false, error: err.message || String(err) });
  }
};
