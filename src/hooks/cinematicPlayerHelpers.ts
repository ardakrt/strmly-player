import type { PlaylistItem } from '../utils/m3uParser';

export const PLAYER_VOLUME_KEY = 'cinema_player_volume';
export const PLAYER_MUTED_KEY = 'cinema_player_muted';
export const PLAYER_SPEED_KEY = 'cinema_player_speed';
export const PLAYER_QUALITY_KEY = 'cinema_player_quality';
export const PLAYER_AUDIO_PREF_KEY = 'cinema_player_audio_pref';
export type PlaybackStatus = 'loading' | 'playing' | 'recovering' | 'transcoding' | 'seeking' | 'error';
export type PlayerQualityLevel = { id: number; label: string; height?: number; bitrate?: number };

export function translateReason(reason: string, language: 'tr' | 'en'): string {
  const dictionary: Record<string, { tr: string; en: string }> = {
    'Yerel oynatma basarisiz oldu': {
      tr: 'Yerel oynatma başarısız oldu',
      en: 'Native playback failed'
    },
    'HLS medya kurtarma basarisiz': {
      tr: 'HLS medya kurtarma başarısız',
      en: 'HLS media recovery failed'
    },
    'Ilk oynatma basarisiz oldu': {
      tr: 'İlk oynatma başarısız oldu',
      en: 'First playback failed'
    },
    'HLS yerel oynatma baslamadi': {
      tr: 'HLS yerel oynatma başlamadı',
      en: 'HLS native playback did not start'
    },
    'Yerel oynatma baslamadi': {
      tr: 'Yerel oynatma başlamadı',
      en: 'Native playback did not start'
    },
    'Uyumluluk modu baslamadi': {
      tr: 'Uyumluluk modu başlamadı',
      en: 'Compatibility mode did not start'
    },
    'Akis kurtarilamadi': {
      tr: 'Akış kurtarılamadı',
      en: 'Stream could not be recovered'
    },
    'Akis takildi': {
      tr: 'Akış takıldı',
      en: 'Stream stalled'
    },
    'Seek sonrasi akis takildi': {
      tr: 'Seek sonrası akış takıldı',
      en: 'Stream stalled after seek'
    },
    'Uyumluluk modu baslatilamadi': {
      tr: 'Uyumluluk modu başlatılamadı',
      en: 'Compatibility mode could not be started'
    },
    'Ses codec uyumluluk modu baslatilamadi': {
      tr: 'Ses codec uyumluluk modu başlatılamadı',
      en: 'Audio codec compatibility mode could not be started'
    },
    'Oynatici baslatilamadi': {
      tr: 'Oynatıcı başlatılamadı',
      en: 'Player could not be started'
    },
    'Ilk kare gecikti': {
      tr: 'İlk kare gecikti',
      en: 'First frame delayed'
    },
    'Sunucu zamaninda yanit vermedi': {
      tr: 'Sunucu zamanında yanıt vermedi',
      en: 'Server did not respond in time'
    },
    'FFmpeg uyumluluk modu kullanilamiyor': {
      tr: 'FFmpeg uyumluluk modu kullanılamıyor',
      en: 'FFmpeg compatibility mode unavailable'
    },
    'Uyumluluk modu hata verdi': {
      tr: 'Uyumluluk modu hata verdi',
      en: 'Compatibility mode failed'
    },
    'Video cozulurken hata olustu': {
      tr: 'Video çözülürken hata oluştu',
      en: 'Error decoding video'
    },
    'Oynatma hatasi': {
      tr: 'Oynatma hatası',
      en: 'Playback error'
    },
    'Video bu noktadan devam edemedi': {
      tr: 'Video bu noktadan devam edemedi',
      en: 'Video could not continue from this point'
    },
    'HLS ag hatasi': {
      tr: 'HLS ağ hatası',
      en: 'HLS network error'
    },
    'HLS medya hatasi': {
      tr: 'HLS medya hatası',
      en: 'HLS media error'
    },
    'HLS oynatma hatasi': {
      tr: 'HLS oynatma hatası',
      en: 'HLS playback error'
    },
    'Video ileri sariliyor...': {
      tr: 'Video ileri sarılıyor...',
      en: 'Seeking video forward...'
    },
    'Video ileri sarilamadi. Kaynak bu noktadan devam etmeyi desteklemiyor olabilir.': {
      tr: 'Video ileri sarılamadı. Kaynak bu noktadan devam etmeyi desteklemiyor olabilir.',
      en: 'Could not seek forward. The source might not support seeking from this point.'
    },
    'Video ileri sarilirken hata olustu.': {
      tr: 'Video ileri sarılırken hata oluştu.',
      en: 'An error occurred while seeking forward.'
    },
    'Yayin akisi kurtariliyor...': {
      tr: 'Yayın akışı kurtarılıyor...',
      en: 'Recovering stream...'
    },
    'Ses dili değiştiriliyor (Transcode)...': {
      tr: 'Ses dili değiştiriliyor (Transcode)...',
      en: 'Changing audio language (Transcode)...'
    },
    'Altyazı yüklendi.': {
      tr: 'Altyazı yüklendi.',
      en: 'Subtitle loaded.'
    },
    'Resim içinde resim bu cihazda desteklenmiyor olabilir.': {
      tr: 'Resim içinde resim bu cihazda desteklenmiyor olabilir.',
      en: 'Picture-in-picture might not be supported on this device.'
    }
  };

  return dictionary[reason]?.[language] || dictionary[reason]?.tr || reason;
}

export function getPlaybackLabel(item: PlaylistItem | null, language: 'tr' | 'en' = 'tr'): string {
  if (language === 'en') {
    if (item?.type === 'live') return 'Live stream';
    if (item?.type === 'movie') return 'Movie';
    return 'Series episode';
  }
  if (item?.type === 'live') return 'Canlı yayın';
  if (item?.type === 'movie') return 'Film';
  return 'Dizi bölümü';
}

export function getLoadingMessage(item: PlaylistItem | null, language: 'tr' | 'en' = 'tr'): string {
  if (language === 'en') {
    return `Preparing ${getPlaybackLabel(item, language).toLowerCase()}...`;
  }
  return `${getPlaybackLabel(item, language)} hazırlanıyor...`;
}

export function getTranscodingMessage(item: PlaylistItem | null, language: 'tr' | 'en' = 'tr'): string {
  if (language === 'en') {
    return `Trying compatibility mode for ${getPlaybackLabel(item, language).toLowerCase()}...`;
  }
  return `${getPlaybackLabel(item, language)} için uyumluluk modu deneniyor...`;
}

export function getRecoveringMessage(item: PlaylistItem | null, language: 'tr' | 'en' = 'tr'): string {
  if (language === 'en') {
    return `Recovering ${getPlaybackLabel(item, language).toLowerCase()} stream...`;
  }
  return `${getPlaybackLabel(item, language)} akışı kurtarılıyor...`;
}

export function getPlaybackFailureMessage(item: PlaylistItem | null, reason?: string, language: 'tr' | 'en' = 'tr'): string {
  const translatedReason = reason ? translateReason(reason, language) : '';
  const reasonText = translatedReason ? ` (${translatedReason})` : '';
  if (language === 'en') {
    return `${getPlaybackLabel(item, language)} could not be opened${reasonText}. The source might be temporarily offline, codec unsupported, or the server is not responding. Try another source or open with an external player.`;
  }
  return `${getPlaybackLabel(item, language)} açılamadı${reasonText}. Kaynak geçici olarak kapalı, codec desteklenmiyor veya sunucu yanıt vermiyor olabilir. Başka bir kaynak deneyin ya da harici oynatıcı ile açmayı deneyin.`;
}

export function getSavedPlayerVolume(): number {
  const saved = Number(localStorage.getItem(PLAYER_VOLUME_KEY));
  return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 1;
}

export function getSavedPlayerMuted(): boolean {
  return localStorage.getItem(PLAYER_MUTED_KEY) === 'true';
}

export function getSavedPlaybackSpeed(): number {
  const saved = Number(localStorage.getItem(PLAYER_SPEED_KEY));
  return Number.isFinite(saved) && saved >= 0.25 && saved <= 2 ? saved : 1;
}

export function getSavedQualityLevel(): number {
  const saved = Number(localStorage.getItem(PLAYER_QUALITY_KEY));
  return Number.isFinite(saved) ? saved : -1;
}

export function getSavedAudioPreference(): { name?: string; lang?: string } | null {
  try {
    const saved = localStorage.getItem(PLAYER_AUDIO_PREF_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function getPreferredAudioTrackIndex(tracks: { name?: string; lang?: string }[]): number {
  const preferred = getSavedAudioPreference();
  if (preferred) {
    const preferredName = preferred.name?.toLowerCase();
    const preferredLang = preferred.lang?.toLowerCase();
    const exact = tracks.findIndex(track =>
      (preferredLang && track.lang?.toLowerCase() === preferredLang) ||
      (preferredName && track.name?.toLowerCase() === preferredName)
    );
    if (exact >= 0) return exact;
  }

  const turkish = tracks.findIndex(track =>
    track.name?.toLowerCase().includes('türk') ||
    track.name?.toLowerCase().includes('turk') ||
    track.lang?.toLowerCase() === 'tr'
  );
  return turkish >= 0 ? turkish : 0;
}
