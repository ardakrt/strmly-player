export type Language = 'tr' | 'en';

export const translations = {
  tr: {
    common: {
      back: "Geri",
      cancel: "İptal",
      save: "Kaydet",
      delete: "Sil",
      edit: "Düzenle",
      add: "Ekle",
      loading: "Yükleniyor...",
      error: "Hata",
      success: "Başarılı",
      confirm: "Onayla",
      warning: "Uyarı",
      none: "Yok",
      yes: "Evet",
      no: "Hayır",
      close: "Kapat",
      matchScore: "%{{score}} Eşleşme"
    },
    splash: {
      loadingSettings: "Kullanıcı ayarları yükleniyor...",
      loadingProfiles: "Profiller yükleniyor...",
      checkingUpdates: "Güncelleştirmeler denetleniyor...",
      updateDownloaded: "Güncelleme indirildi, kuruluyor...",
      loadingContents: "İçerikler Yükleniyor..."
    },
    navbar: {
      home: "Ana Sayfa",
      liveTv: "Canlı TV",
      movies: "Filmler",
      series: "Diziler",
      favorites: "Favoriler",
      searchPlaceholder: "Dizi, film veya kanal ara...",
      searchTitle: "Arama (Ctrl+K)",
      otherProfiles: "Diğer Profiller",
      updateAvailable: "Güncelleme Mevcut!",
      changeProfile: "Profili Değiştir",
      advancedSettings: "Gelişmiş Ayarlar",
      installedChannels: "Yüklü Kanallar:",
      savedPlaylists: "Kayıtlı Listeler:",
      activePlaylist: "Aktif Liste:",
      itemsCount: "{{count}} Öğe",
      playlistsCount: "{{count}} Liste",
      user: "Kullanıcı"
    },
    profiles: {
      title: "Kim İzliyor?",
      subtitle: "Kişiselleştirilmiş bir deneyim için izleme alanını seçin.",
      editProfiles: "Profilleri Yönet",
      finish: "Tamam",
      newProfile: "Yeni İzleme Alanı",
      profileSettings: "Profil Ayarları",
      profileName: "Profil Adı",
      profileNamePlaceholder: "Örn. Salon, Arda...",
      selectAvatar: "Avatar Seçin",
      avatarSearchPlaceholder: "Görsel ara veya URL yapıştır...",
      deleteProfileTitle: "Profili Sil",
      deleteProfileConfirm: "Bu profili silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve profilin tüm geçmiş/favori verileri silinecektir.",
      deleteConfirmBtn: "Profili Sil",
      contentPrefsTitle: "İçerik Tercihleri",
      contentPrefsDesc: "Profilinizde görünmesini istediğiniz içerik türlerini seçin.",
      autoUpdateInterval: "Otomatik Güncelleme Sıklığı",
      autoUpdateDesc: "Oynatma listesinin ne sıklıkla otomatik olarak yenileneceğini belirleyin.",
      hours: "{{hours}} Saat",
      playlistSetup: "Playlist Kurulumu",
      playlistSetupDesc: "Profilinize bağlamak istediğiniz IPTV listesini seçin.",
      playlistType: "Playlist Tipi",
      m3uUrl: "M3U Linki",
      m3uUrlPlaceholder: "http://example.com/playlist.m3u",
      xtreamUrl: "Xtream API Adresi",
      xtreamUrlPlaceholder: "http://example.com:8080",
      xtreamUser: "Kullanıcı Adı",
      xtreamPass: "Şifre",
      importLocalFile: "Yerel M3U Dosyası Yükle",
      creatingProfile: "Profil oluşturuluyor...",
      updatingProfile: "Profil güncelleniyor...",
      loadingProfilesError: "Profil verileri yüklenirken bir hata oluştu.",
      setupWizard: {
        step1Title: "Profil Bilgileri",
        step1Desc: "Profil adı ve avatarınızı belirleyin.",
        step2Title: "Playlist Tipi",
        step2Desc: "Hangi IPTV biçimini kullanmak istediğinizi seçin.",
        step3Title: "Bağlantı Detayları",
        step3Desc: "IPTV servis bilgilerini girin.",
        step4Title: "Kişiselleştirme",
        step4Desc: "İçerik türleri ve güncelleme sıklığını ayarlayın.",
        nextStep: "Sonraki Adım",
        prevStep: "Önceki Adım",
        createProfile: "Profil Oluştur",
        saveChanges: "Değişiklikleri Kaydet",
        playlistRequired: "Lütfen geçerli bir IPTV listesi girin veya 'Daha Sonra Kur' seçeneğini kullanın.",
        setupLater: "Daha Sonra Kur (Boş Profil)",
        m3uFileSelected: "Dosya Seçildi: {{name}}"
      }
    },
    home: {
      noPlaylistsTitle: "İzlemeye Hazır mısın?",
      noPlaylistsDesc: "IPTV dünyasını keşfetmek ve kanalları görüntülemek için Ayarlar sekmesinden bir M3U çalma listesi yükleyin.",
      goToSettings: "Ayarlara Git",
      welcomeBack: "Tekrar Hoş Geldin!",
      recentlyWatched: "Son İzlenenler",
      myFavorites: "Favorilerim",
      clearHistory: "Geçmişi Temizle",
      clearFavorites: "Favorileri Temizle",
      stats: {
        total: "Toplam Öğe",
        live: "Canlı TV",
        movies: "Sinema (VOD)",
        series: "Dizi (VOD)"
      },
      emptyState: {
        recentlyWatched: "Henüz hiçbir şey izlemediniz. Kanalları veya filmleri oynattıkça burada görünecektir.",
        favorites: "Favori listeniz henüz boş. Beğendiğiniz içerikleri yıldızlayarak buraya ekleyebilirsiniz."
      }
    },
    settings: {
      title: "Ayarlar",
      tabs: {
        players: "Genel",
        playlists: "Çalma Listeleri",
        categories: "Gizli Kategoriler",
        appearance: "Arayüz ve Görünüm",
        playback: "Oynatma Seçenekleri",
        network: "Ağ ve Bağlantı",
        data: "Veri Yönetimi",
        about: "Hakkında"
      },
      players: {
        title: "Varsayılan Oynatıcı",
        desc: "Medya akışları için kullanılacak video oynatma motorunu belirleyin.",
        selectLabel: "Oynatıcı Tipi",
        internal: "Dahili Oynatıcı (HLS.js / HTML5 - Önerilen)",
        external: "Harici Oynatıcı (Sistem MPV/VLC entegrasyonu)",
        ffplay: "FFplay (Hafif ve Hızlı)",
        saveSuccess: "Varsayılan oynatıcı güncellendi.",
        transcodeMode: "Transcode Modu",
        transcodeModeDesc: "Ses formatı uyumsuzluğunda FFmpeg kodlama davranışını belirler.",
        transcodeAuto: "Otomatik (H.264 ise Hızlı Kopyala - Önerilen)",
        transcodeCopy: "Sadece Ses (Kopyalama - Düşük CPU)",
        transcodeFull: "Tam Transcode (Yüksek CPU, Maksimum Uyumluluk)",
        transcodeSaveSuccess: "Transcode modu güncellendi."
      },
      playlists: {
        title: "Çalma Listesi Yönetimi",
        desc: "Mevcut M3U ve Xtream çalma listelerinizi ekleyin, düzenleyin veya yenileyin.",
        addPlaylist: "Yeni Playlist Ekle",
        playlistName: "Çalma Listesi Adı",
        playlistNamePlaceholder: "Örn. IPTV Listem, Ücretsiz Liste...",
        urlOrPath: "M3U Bağlantısı veya Dosya Yolu",
        updateInterval: "Otomatik Güncelleme",
        lastUpdated: "Son Güncelleme: {{time}}",
        refreshBtn: "Yenile",
        refreshing: "Yenileniyor...",
        deleteConfirm: "Bu çalma listesini silmek istediğinizden emin misiniz? Playlist içindeki tüm kategoriler kaldırılacaktır.",
        noPlaylists: "Henüz kayıtlı bir çalma listesi bulunmuyor.",
        loadSuccess: "Playlist başarıyla yüklendi.",
        deleteSuccess: "Playlist silindi."
      },
      appearance: {
        title: "Görünüm ve Arayüz",
        desc: "Uygulama temasını, renk paletini ve görsel efektleri özelleştirin.",
        language: "Uygulama Dili / Language",
        languageDesc: "Arayüzün gösterileceği dili seçin.",
        theme: "Tema Stili",
        themeDesc: "Karanlık ve fütüristik tema seçeneklerinden birini belirleyin.",
        accentColor: "Vurgu Rengi",
        accentDesc: "Butonlar ve aktif elemanlar için kullanılacak neon renk tonu.",
        glass: "Buzlu Cam (Glassmorphism)",
        glassDesc: "Arayüz panellerindeki cam bulanıklığı yoğunluğu.",
        neon: "Neon Işıma Efektleri",
        neonDesc: "Vurgulu elemanların etrafındaki ışıma efektini açıp kapatın.",
        cardSize: "Kart Boyutu",
        cardSizeDesc: "Kanal, film ve dizi listelerindeki öğelerin görüntülenme büyüklüğü.",
        themes: {
          spaceBlack: "Space Black (Derin Uzay)",
          deepSpace: "Deep Space (Uzay Mavisi)",
          cyberpunk: "Cyberpunk Neon (Sarı/Mor)",
          midnight: "Midnight Obsidian (Koyu Obsidyen)"
        },
        glassLevels: {
          none: "Kapat (Düz Arka Plan)",
          low: "Hafif",
          medium: "Orta",
          high: "Yoğun (Ultra)"
        },
        cardSizes: {
          small: "Küçük",
          medium: "Orta (Standart)",
          large: "Büyük"
        },
        enabled: "Açık",
        disabled: "Kapalı"
      },
      hidden: {
        title: "Gizlenen Kategoriler",
        desc: "Arayüzde gösterilmesini istemediğiniz kategorileri buradan yönetin ve geri yükleyin.",
        live: "Canlı TV Kategorileri",
        movies: "Sinema Kategorileri",
        series: "Dizi Kategorileri",
        restore: "Geri Yükle",
        resetAll: "Tümünü Geri Yükle",
        noHidden: "Gizlenmiş kategori bulunmuyor.",
        resetSuccess: "Tüm kategoriler görünür yapıldı."
      },
      backup: {
        title: "Yedekleme ve İçe Aktarma",
        desc: "Strmly ayarlarını ve profillerini JSON dosyası olarak dışarı aktarın veya geri yükleyin.",
        export: "Ayarları Dışa Aktar",
        exportDesc: "Profil bilgileri, playlist bağlantıları ve arayüz tercihlerinizi tek bir JSON dosyası olarak yedekleyin.",
        import: "Yedeği Geri Yükle",
        importDesc: "Daha önce aldığınız bir JSON yedek dosyasını seçerek uygulamayı eski durumuna getirin.",
        exportSuccess: "Ayarlar başarıyla dışa aktarıldı.",
        importSuccess: "Ayarlar başarıyla içe aktarıldı. Uygulamayı yeniden başlatın.",
        importError: "Yedek dosyası yüklenirken bir hata oluştu."
      },
      about: {
        title: "Hakkında",
        desc: "Strmly sürüm bilgileri ve güncellemeler.",
        version: "Sürüm: {{version}}",
        author: "Geliştirici: {{author}}",
        license: "Lisans: MIT",
        checkUpdates: "Güncellemeleri Denetle",
        upToDate: "Uygulama güncel.",
        updateFound: "Yeni güncelleme mevcut (v{{version}}). İndiriliyor..."
      }
    },
    player: {
      settings: "Oynatıcı Ayarları",
      audio: "Ses Kanalı",
      subtitles: "Altyazı",
      quality: "Kalite / Çözünürlük",
      auto: "Otomatik",
      live: "CANLI",
      playbackError: "Akış yüklenemedi. Bağlantı adresi geçersiz olabilir veya sunucu yanıt vermiyor.",
      loadingStream: "Yayın Yükleniyor...",
      info: {
        title: "Oynatıcı Bilgileri",
        source: "Kaynak URL:",
        type: "Akış Türü:",
        engine: "Oynatıcı Motoru:"
      },
      shortcuts: {
        title: "Klavye Kısayolları",
        playPause: "Oynat / Duraklat",
        mute: "Sesi Kapat / Aç",
        volume: "Ses Seviyesi",
        fullscreen: "Tam Ekran",
        back: "Oynatıcıdan Çık"
      }
    },
    downloads: {
      title: "Kaydedilenler",
      empty: "Henüz kaydedilen yok",
      emptyDesc: "Film veya dizi kaydetmek için içerik kartındaki Kaydet seçeneğini kullanın.",
      downloading: "Kaydediliyor",
      completed: "Kaydedildi",
      failed: "Kaydetme Başarısız",
      paused: "Duraklatıldı",
      pending: "Bekliyor",
      cancel: "Kaydetmeyi İptal Et",
      retry: "Tekrar Dene",
      delete: "Sil",
      play: "Oynat",
      pause: "Duraklat",
      resume: "Devam Et",
      size: "Boyut",
      progress: "İlerleme",
      speed: "Hız",
      timeLeft: "Kalan Süre",
      startDownload: "Kaydetmeyi Başlat",
      downloadStarted: "Kaydetme başladı",
      downloadCompleted: "Kaydetme tamamlandı",
      downloadFailed: "Kaydetme başarısız oldu",
      downloadCancelled: "Kaydetme iptal edildi",
      deleteConfirm: "Bu dosyayı silmek istediğinizden emin misiniz?",
      storageUsed: "Kullanılan Alan",
      clearAll: "Tümünü Temizle"
    }
  },
  en: {
    common: {
      back: "Back",
      cancel: "Cancel",
      save: "Save",
      delete: "Delete",
      edit: "Edit",
      add: "Add",
      loading: "Loading...",
      error: "Error",
      success: "Success",
      confirm: "Confirm",
      warning: "Warning",
      none: "None",
      yes: "Yes",
      no: "No",
      close: "Close",
      matchScore: "{{score}}% Match"
    },
    splash: {
      loadingSettings: "Loading user settings...",
      loadingProfiles: "Loading profiles...",
      checkingUpdates: "Checking for updates...",
      updateDownloaded: "Update downloaded, installing...",
      loadingContents: "Loading Contents..."
    },
    navbar: {
      home: "Home",
      liveTv: "Live TV",
      movies: "Movies",
      series: "Series",
      favorites: "Favorites",
      searchPlaceholder: "Search series, movie or channel...",
      searchTitle: "Search (Ctrl+K)",
      otherProfiles: "Other Profiles",
      updateAvailable: "Update Available!",
      changeProfile: "Change Profile",
      advancedSettings: "Advanced Settings",
      installedChannels: "Installed Channels:",
      savedPlaylists: "Saved Playlists:",
      activePlaylist: "Active Playlist:",
      itemsCount: "{{count}} Items",
      playlistsCount: "{{count}} Playlists",
      user: "User"
    },
    profiles: {
      title: "Who's Watching?",
      subtitle: "Choose a viewing space for a personalized experience.",
      editProfiles: "Manage Profiles",
      finish: "Done",
      newProfile: "New Profile",
      profileSettings: "Profile Settings",
      profileName: "Profile Name",
      profileNamePlaceholder: "e.g., Living Room, Arda...",
      selectAvatar: "Select Avatar",
      avatarSearchPlaceholder: "Search image or paste URL...",
      deleteProfileTitle: "Delete Profile",
      deleteProfileConfirm: "Are you sure you want to delete this profile? This action cannot be undone and all history/favorites for this profile will be permanently deleted.",
      deleteConfirmBtn: "Delete Profile",
      contentPrefsTitle: "Content Preferences",
      contentPrefsDesc: "Select the content types you want to display on this profile.",
      autoUpdateInterval: "Auto Update Interval",
      autoUpdateDesc: "Determine how often the playlist should automatically refresh.",
      hours: "{{hours}} Hours",
      playlistSetup: "Playlist Setup",
      playlistSetupDesc: "Select the IPTV playlist you want to link to your profile.",
      playlistType: "Playlist Type",
      m3uUrl: "M3U Link",
      m3uUrlPlaceholder: "http://example.com/playlist.m3u",
      xtreamUrl: "Xtream API Address",
      xtreamUrlPlaceholder: "http://example.com:8080",
      xtreamUser: "Username",
      xtreamPass: "Password",
      importLocalFile: "Upload Local M3U File",
      creatingProfile: "Creating profile...",
      updatingProfile: "Updating profile...",
      loadingProfilesError: "An error occurred while loading profile data.",
      setupWizard: {
        step1Title: "Profile Info",
        step1Desc: "Set your profile name and avatar.",
        step2Title: "Playlist Type",
        step2Desc: "Choose which IPTV format you want to use.",
        step3Title: "Connection Details",
        step3Desc: "Enter your IPTV service credentials.",
        step4Title: "Personalization",
        step4Desc: "Configure content categories and update intervals.",
        nextStep: "Next Step",
        prevStep: "Previous Step",
        createProfile: "Create Profile",
        saveChanges: "Save Changes",
        playlistRequired: "Please enter a valid IPTV list or choose 'Setup Later'.",
        setupLater: "Setup Later (Empty Profile)",
        m3uFileSelected: "File Selected: {{name}}"
      }
    },
    home: {
      noPlaylistsTitle: "Ready to Watch?",
      noPlaylistsDesc: "Upload an M3U playlist from the Settings tab to explore the IPTV world and view channels.",
      goToSettings: "Go to Settings",
      welcomeBack: "Welcome Back!",
      recentlyWatched: "Recently Watched",
      myFavorites: "My Favorites",
      clearHistory: "Clear History",
      clearFavorites: "Clear Favorites",
      stats: {
        total: "Total Items",
        live: "Live TV",
        movies: "Movies (VOD)",
        series: "Series (VOD)"
      },
      emptyState: {
        recentlyWatched: "You haven't watched anything yet. Played channels or movies will appear here.",
        favorites: "Your favorites list is empty. You can add content here by starring them."
      }
    },
    settings: {
      title: "Settings",
      tabs: {
        players: "General",
        playlists: "Playlists",
        categories: "Hidden Categories",
        appearance: "Appearance & Interface",
        playback: "Playback Options",
        network: "Network & Connection",
        data: "Data Management",
        about: "About"
      },
      players: {
        title: "Default Player",
        desc: "Determine the video playback engine to be used for media streams.",
        selectLabel: "Player Type",
        internal: "Internal Player (HLS.js / HTML5 - Recommended)",
        external: "External Player (System MPV/VLC Integration)",
        ffplay: "FFplay (Lightweight & Fast)",
        saveSuccess: "Default player updated.",
        transcodeMode: "Transcode Mode",
        transcodeModeDesc: "Determines FFmpeg encoding behavior when the audio format is incompatible.",
        transcodeAuto: "Auto (Copy Fast if H.264 - Recommended)",
        transcodeCopy: "Audio Only (Copy Video - Low CPU)",
        transcodeFull: "Full Transcode (High CPU, Max Compatibility)",
        transcodeSaveSuccess: "Transcode mode updated."
      },
      playlists: {
        title: "Playlist Management",
        desc: "Add, edit, or refresh your current M3U and Xtream playlists.",
        addPlaylist: "Add New Playlist",
        playlistName: "Playlist Name",
        playlistNamePlaceholder: "e.g., My IPTV, Free List...",
        urlOrPath: "M3U Link or File Path",
        updateInterval: "Auto Update",
        lastUpdated: "Last Updated: {{time}}",
        refreshBtn: "Refresh",
        refreshing: "Refreshing...",
        deleteConfirm: "Are you sure you want to delete this playlist? All categories inside this playlist will be removed.",
        noPlaylists: "No saved playlists found.",
        loadSuccess: "Playlist loaded successfully.",
        deleteSuccess: "Playlist deleted."
      },
      appearance: {
        title: "Appearance & Interface",
        desc: "Customize the application theme, color palette, and visual effects.",
        language: "App Language / Uygulama Dili",
        languageDesc: "Select the display language for the interface.",
        theme: "Theme Style",
        themeDesc: "Choose one of the dark and futuristic theme options.",
        accentColor: "Accent Color",
        accentDesc: "Neon color accent for buttons and active elements.",
        glass: "Glassmorphism Intensity",
        glassDesc: "The blur intensity of interface panels.",
        neon: "Neon Glow Effects",
        neonDesc: "Turn on/off the glow effect around highlighted elements.",
        cardSize: "Card Size",
        cardSizeDesc: "The display size of items in channel, movie, and series lists.",
        themes: {
          spaceBlack: "Space Black (Deep Space)",
          deepSpace: "Deep Space (Space Blue)",
          cyberpunk: "Cyberpunk Neon (Yellow/Purple)",
          midnight: "Midnight Obsidian (Dark Obsidian)"
        },
        glassLevels: {
          none: "Off (Solid Background)",
          low: "Low",
          medium: "Medium",
          high: "High (Ultra)"
        },
        cardSizes: {
          small: "Small",
          medium: "Medium (Standard)",
          large: "Large"
        },
        enabled: "Enabled",
        disabled: "Disabled"
      },
      hidden: {
        title: "Hidden Categories",
        desc: "Manage and restore categories that you chose to hide from the interface.",
        live: "Live TV Categories",
        movies: "Movie Categories",
        series: "Series Categories",
        restore: "Restore",
        resetAll: "Restore All",
        noHidden: "No hidden categories.",
        resetSuccess: "All categories restored to visible."
      },
      backup: {
        title: "Backup & Import",
        desc: "Export Strmly settings and profiles as a JSON file, or restore them.",
        export: "Export Settings",
        exportDesc: "Backup profile details, playlist links, and interface preferences as a single JSON file.",
        import: "Restore Backup",
        importDesc: "Upload a previously exported JSON backup file to restore the application state.",
        exportSuccess: "Settings exported successfully.",
        importSuccess: "Settings imported successfully. Restart application.",
        importError: "An error occurred while loading the backup file."
      },
      about: {
        title: "About",
        desc: "Strmly version information and updates.",
        version: "Version: {{version}}",
        author: "Developer: {{author}}",
        license: "License: MIT",
        checkUpdates: "Check for Updates",
        upToDate: "Application is up to date.",
        updateFound: "New update available (v{{version}}). Downloading..."
      }
    },
    player: {
      settings: "Player Settings",
      audio: "Audio Track",
      subtitles: "Subtitles",
      quality: "Quality / Resolution",
      auto: "Auto",
      live: "LIVE",
      playbackError: "Stream could not be loaded. The link might be invalid or the server is not responding.",
      loadingStream: "Loading stream...",
      info: {
        title: "Player Info",
        source: "Source URL:",
        type: "Stream Type:",
        engine: "Player Engine:"
      },
      shortcuts: {
        title: "Keyboard Shortcuts",
        playPause: "Play / Pause",
        mute: "Mute / Unmute",
        volume: "Volume Level",
        fullscreen: "Fullscreen",
        back: "Exit Player"
      }
    },
    downloads: {
      title: "Saved",
      empty: "Nothing saved yet",
      emptyDesc: "Use the Save option on a movie or series card to keep it in the app library.",
      downloading: "Saving",
      completed: "Saved",
      failed: "Save Failed",
      paused: "Paused",
      pending: "Pending",
      cancel: "Cancel Save",
      retry: "Retry",
      delete: "Delete",
      play: "Play",
      pause: "Pause",
      resume: "Resume",
      size: "Size",
      progress: "Progress",
      speed: "Speed",
      timeLeft: "Time Left",
      startDownload: "Start Saving",
      downloadStarted: "Save started",
      downloadCompleted: "Save completed",
      downloadFailed: "Save failed",
      downloadCancelled: "Save cancelled",
      deleteConfirm: "Are you sure you want to delete this file?",
      storageUsed: "Storage Used",
      clearAll: "Clear All"
    }
  }
} as const;

export function getTranslation(key: string, lang: Language = 'tr'): string {
  const keys = key.split('.');
  let current: any = translations[lang];

  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      // Fallback to Turkish
      let fallback: any = translations['tr'];
      for (const fk of keys) {
        if (fallback && typeof fallback === 'object' && fk in fallback) {
          fallback = fallback[fk];
        } else {
          return key;
        }
      }
      return typeof fallback === 'string' ? fallback : key;
    }
  }

  return typeof current === 'string' ? current : key;
}
