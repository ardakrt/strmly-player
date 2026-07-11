self.onmessage = (e: MessageEvent<any>) => {
  const { type, payload } = e.data;

  if (type === 'export') {
    try {
      const json = JSON.stringify(payload, null, 2);
      self.postMessage({ success: true, type: 'export', result: json });
    } catch (err: any) {
      self.postMessage({ success: false, type: 'export', error: err.message || String(err) });
    }
  } else if (type === 'import') {
    try {
      const settings = JSON.parse(payload);
      if (settings && typeof settings === 'object') {
        self.postMessage({ success: true, type: 'import', result: settings });
      } else {
        throw new Error('Geçersiz ayar dosyası yapısı.');
      }
    } catch (err: any) {
      self.postMessage({ success: false, type: 'import', error: err.message || String(err) });
    }
  }
};
