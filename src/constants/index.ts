// Neutral background option for Carousel Fallback
export const HERO_BACKDROPS = [
  {
    title: "Strmly Player",
    category: "Medya Oynatıcı",
    desc: "Favori canlı TV kanallarınızı, dizilerinizi ve filmlerinizi izlemek için bir M3U veya Xtream oynatma listesi ekleyin.",
    img: ""
  }
];

export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export const GLOBAL_KEYS = ['cinema_profiles', 'cinema_active_profile_id', 'cinema_tmdb_key', 'cinema_default_player', 'cinema_theme', 'cinema_accent', 'cinema_glass_intensity', 'cinema_neon_glow', 'cinema_card_layout_size', 'cinema_language', 'cinema_transcode_mode', 'cinema_iptv_update_mode', 'cinema_download_segment_concurrency', 'cinema_download_max_height', 'cinema_download_segment_delay_ms'];

export const DEFAULT_AVATARS = [
  'linear-gradient(to right, #ff7e5f, #feb47b)', // Sunset Glow
  'linear-gradient(to right, #4facfe, #00f2fe)', // Sea Breeze
  'linear-gradient(to right, #43e97b, #38f9d7)', // Mint Wave
  'linear-gradient(to right, #fa709a, #fee140)', // Sweet Candy
  'linear-gradient(to right, #30cfd0, #330867)', // Deep Space
  'linear-gradient(to right, #a18cd1, #fbc2eb)'  // Plum Velvet
];

export const TMDB_CACHE_VERSION = 'tmdb-v6';

// Brandfetch CDN client ID — official platform/brand logos (https://cdn.brandfetch.io/{domain}?c={id})
export const BRANDFETCH_CLIENT_ID: string = import.meta.env.VITE_BRANDFETCH_CLIENT_ID || '1idhGGeVKD7aryQ4vFo';

export const DEFAULT_AUTO_UPDATE_INTERVAL_HOURS = 24;
