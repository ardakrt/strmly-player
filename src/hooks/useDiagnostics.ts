import { useState, useCallback } from 'react';
import type { PlaylistItem } from '../types';
import type { Language } from '../utils/translations';

interface UseDiagnosticsProps {
  items: PlaylistItem[];
  language: Language;
  showToast: (message: string) => void;
}

export function useDiagnostics({
  items,
  language,
  showToast
}: UseDiagnosticsProps) {
  const [checkerLog, setCheckerLog] = useState<string[]>([]);
  const [checkedStatusMap, setCheckedStatusMap] = useState<Record<string, 'online' | 'offline'>>({});
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const runPlaylistDiagnostics = useCallback(async () => {
    if (items.length === 0) {
      showToast(language === 'tr' ? "Kontrol edilecek kanal bulunamadı!" : "No channels found to check!");
      return;
    }
    setIsCheckingHealth(true);
    setCheckerLog([
      language === 'tr' ? "Test başlatılıyor..." : "Starting diagnostics...",
      language === 'tr' ? `Toplam kanal sayısı: ${items.length}` : `Total channel count: ${items.length}`,
      language === 'tr' ? "HEAD istekleri gönderiliyor..." : "Sending HEAD requests..."
    ]);

    const limit = 20; // Check up to 20 channels to save performance
    const toCheck = items.slice(0, limit);
    const statusResults: Record<string, 'online' | 'offline'> = {};

    for (let i = 0; i < toCheck.length; i++) {
      const ch = toCheck[i];
      setCheckerLog(prev => [...prev, language === 'tr' ? `[Sorgu ${i + 1}/${limit}] ${ch.name} test ediliyor...` : `[Query ${i + 1}/${limit}] Checking ${ch.name}...`]);
      try {
        const res = await fetch(ch.url, { method: 'HEAD', mode: 'cors', headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' } }).catch(() => null);
        if (res && res.status >= 200 && res.status < 400) {
          statusResults[ch.id] = 'online';
          setCheckerLog(prev => [...prev, language === 'tr' ? `ÇEVRİMİÇİ | Kod: ${res.status}` : `ONLINE | Status: ${res.status}`]);
        } else {
          statusResults[ch.id] = 'offline';
          setCheckerLog(prev => [...prev, language === 'tr' ? `ÇEVRİMDIŞI veya CORS Engeli` : `OFFLINE or CORS blocked`]);
        }
      } catch {
        statusResults[ch.id] = 'offline';
        setCheckerLog(prev => [...prev, language === 'tr' ? `HATA | Ulaşılamadı` : `ERROR | Unreachable`]);
      }
      // Brief pause
      await new Promise(r => setTimeout(r, 100));
    }

    setCheckedStatusMap(previousMap => ({ ...previousMap, ...statusResults }));
    setIsCheckingHealth(false);
    setCheckerLog(prev => [...prev, language === 'tr' ? "✓ Test tamamlandı. Sonuçlar listelere yansıtıldı!" : "✓ Diagnostics complete. Results updated in lists!"]);
    showToast(language === 'tr' ? "Sağlık kontrolü tamamlandı!" : "Health check complete!");
  }, [items, showToast, language]);

  return {
    checkerLog,
    checkedStatusMap,
    isCheckingHealth,
    runPlaylistDiagnostics
  };
}
