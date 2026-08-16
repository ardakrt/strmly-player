export type Language = 'tr' | 'en';

const translations = {
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
    },
    feedback: {
      genericError: "İşlem tamamlanamadı. Tekrar deneyin.",
      playlist: {
        loaded: "{{count}} kanal yüklendi.",
        xtreamConnected: "Xtream bağlantısı kuruldu. {{count}} içerik yüklendi.",
        loadFailed: "Liste yüklenemedi. Bağlantıyı kontrol edip tekrar deneyin.",
        xtreamFailed: "Xtream bağlantısı kurulamadı. Sunucu adresini ve giriş bilgilerini kontrol edin.",
        localFileFailed: "M3U dosyası açılamadı. Dosyanın geçerli ve dolu olduğunu kontrol edin.",
        refreshFailed: "Liste yenilenemedi. Bağlantıyı kontrol edip tekrar deneyin.",
        credentialsMissing: "Kayıtlı Xtream bilgileri eksik. Listeyi düzenleyip bilgileri yeniden girin.",
        seriesLoadFailed: "Dizi bölümleri yüklenemedi. Listeyi yenileyip tekrar deneyin.",
        noPlayableContent: "Oynatılabilir kanal veya VOD bulunamadı. Liste bilgilerini kontrol edin."
      },
      profile: {
        castLoadFailed: "Oyuncu bilgileri yüklenemedi. Tekrar deneyin.",
        loadFailed: "Profil açılamadı. Tekrar deneyin.",
        imageSearchFailed: "TMDB görselleri bulunamadı. Aramayı değiştirip tekrar deneyin.",
        saveFailed: "Profil kaydedilemedi. Bilgileri kontrol edip tekrar deneyin.",
        deleteReadFailed: "Profil verileri okunamadığı için profil silinmedi. Strmly'yi yeniden başlatıp tekrar deneyin.",
        deleteDiskFailed: "Profil uygulamadan kaldırıldı ancak bazı dosyaları silinemedi. Strmly'yi yeniden başlatıp tekrar deneyin.",
        m3uSkipped: "M3U listesi yüklenemedi. Profil liste olmadan oluşturuldu; profili düzenleyip listeyi tekrar ekleyebilirsiniz.",
        xtreamSkipped: "Xtream bağlantısı kurulamadı. Profil liste olmadan oluşturuldu; profili düzenleyip bilgileri tekrar girebilirsiniz."
      },
      downloads: {
        moveFailed: "İndirme konumu değiştirilemedi. Klasör erişimini kontrol edip tekrar deneyin."
      },
      player: {
        externalFailed: "Harici oynatıcı başlatılamadı. Oynatıcının kurulu olduğunu kontrol edip tekrar deneyin.",
        introPointSaved: "{{title}} için giriş atlama noktası kaydedildi ({{start}} - {{end}})."
      }
    },
    splash: {
      loadingSettings: "Kullanıcı ayarları yükleniyor…",
      loadingProfiles: "Profiller yükleniyor…",
      checkingUpdates: "Güncelleştirmeler denetleniyor…",
      updateDownloaded: "Güncelleme indirildi, kuruluyor…",
      loadingContents: "İçerikler yükleniyor…",
      preparingExperience: "Ana sayfan hazırlanıyor…",
      openingApp: "Her şey hazır, açılıyor…"
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
    updateToast: {
      title: "Yeni Güncelleme Bulundu",
      subtitle: "Yeni sürüm indirilmeye hazır.",
      updateBtn: "Güncelle",
      downloading: "İndiriliyor... %{{percent}}",
      readyToInstall: "Yüklemeye Hazır",
      installing: "Yükleniyor ve Yeniden Başlatılıyor...",
      installingShort: "Kuruluyor",
      later: "Daha Sonra",
      error: "Güncelleme Hatası",
      errorDescription: "Güncelleme tamamlanamadı. Bağlantınızı kontrol edip yeniden deneyin."
    },
    profiles: {
      title: "Kim İzliyor?",
      subtitle: "İzleme geçmişine ve favorilerine ulaşmak için bir profil seç.",
      editProfiles: "Profilleri Düzenle",
      finish: "Bitti",
      newProfile: "Profil Ekle",
      profileSettings: "Profil Ayarları",
      profileName: "Profil Adı",
      profileNamePlaceholder: "Profil Adı...",
      selectAvatar: "Avatar Seçin",
      avatarSearchPlaceholder: "Görsel ara veya URL yapıştır...",
      deleteProfileTitle: "Profili Sil",
      deleteProfileConfirm: "Bu profili silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve profilin tüm geçmiş/favori verileri silinecektir.",
      deleteConfirmBtn: "Profili Sil",
      contentPrefsTitle: "İçerik Tercihleri",
      contentPrefsDesc: "Profilinizde görünmesini istediğiniz içerik türlerini seçin.",
      autoUpdateInterval: "Otomatik Güncelleme Sıklığı",
      autoUpdateDesc: "Listenin ne sıklıkla yenileneceğini seçin.",
      hours: "{{hours}} Saat",
      playlistSetup: "Çalma Listesi Kurulumu",
      playlistSetupDesc: "Profilinize bağlamak istediğiniz IPTV listesini seçin.",
      playlistType: "Çalma Listesi Türü",
      m3uUrl: "M3U Linki",
      m3uUrlPlaceholder: "http://example.com/playlist.m3u",
      xtreamUrl: "Xtream API Adresi",
      xtreamUrlPlaceholder: "http://example.com:8080",
      xtreamUser: "Kullanıcı Adı",
      xtreamPass: "Şifre",
      importLocalFile: "Yerel M3U Dosyası Yükle",
      creatingProfile: "Profil oluşturuluyor...",
      updatingProfile: "Profil güncelleniyor...",
      loadingProfilesError: "Profiller yüklenemedi. Tekrar deneyin.",
      entry: {
        welcome: "Hoş geldin",
        fallbackName: "Profilin",
        preparingProfile: "Profil açılıyor",
        loadingLibrary: "Kütüphane yükleniyor",
        preparingHome: "Ana sayfa hazırlanıyor",
        ready: "Hazır"
      },
      contentTypes: {
        series: "Dizi",
        movies: "Film",
        sports: "Spor",
        live: "Canlı TV",
        kids: "Çocuk"
      },
      messages: {
        localSeriesLoadFailed: "Yerli dizi listesi yüklenemedi. TMDB bağlantısını kontrol edin.",
        setupMayTakeTime: "Liste boyutuna göre bu işlem biraz sürebilir.",
        playlistRefreshInBackground: "Süre dolduğunda liste arka planda yenilenir.",
        noProfilesToEditDescription: "Henüz oluşturulmuş bir profiliniz yok. Ayarlarını düzenleyebileceğiniz bir profil eklemek için aşağıdaki butonu kullanabilirsiniz."
      },
      setupWizard: {
        step1Title: "Profil Bilgileri",
        step1Desc: "Profil adı ve avatarınızı belirleyin.",
        step2Title: "Çalma Listesi Türü",
        step2Desc: "Hangi IPTV biçimini kullanmak istediğinizi seçin.",
        step3Title: "Bağlantı Detayları",
        step3Desc: "IPTV servis bilgilerini girin.",
        step4Title: "Kişiselleştirme",
        step4Desc: "Gösterilecek içerikleri ve liste yenileme sıklığını seçin.",
        nextStep: "Sonraki Adım",
        prevStep: "Önceki Adım",
        createProfile: "Profil Oluştur",
        saveChanges: "Değişiklikleri Kaydet",
        playlistRequired: "Lütfen geçerli bir IPTV listesi girin veya 'Daha Sonra Kur' seçeneğini kullanın.",
        setupLater: "Daha Sonra Kur (Boş Profil)",
        m3uFileSelected: "Dosya Seçildi: {{name}}",
        connectionIntro: "Yayınları izlemek için IPTV bilgilerinizi girin veya daha sonra ekleyin.",
        addLaterDescription: "Profili şimdi oluşturabilir, yayın bilgilerini daha sonra Ayarlar bölümünden ekleyebilirsiniz.",
        profileDataDescription: "Favorileriniz ve izleme geçmişiniz bu profile kaydedilir."
      }
    },
    home: {
      noPlaylistsTitle: "İzlemeye başlamak için bir liste ekle",
      noPlaylistsDesc: "Ayarlar > Çalma Listeleri bölümünden M3U veya Xtream listenizi ekleyin.",
      goToSettings: "Ayarlara Git",
      welcomeBack: "Tekrar Hoş Geldin!",
      recentlyWatched: "Son İzlenenler",
      myFavorites: "Favorilerim",
      clearHistory: "Geçmişi Temizle",
      clearFavorites: "Favorileri Temizle",
      setup: {
        title: "İzlemeye başlamak için listenizi ekleyin",
        description: "Xtream Codes hesabınızı, M3U bağlantınızı veya bilgisayarınızdaki M3U dosyasını bağlayın.",
        addPlaylist: "IPTV Listesi Ekle",
        requiredDetails: "Gerekli bilgileri göster",
        guideTitle: "Listenizi bağlayın",
        guideDescription: "Strmly kendi yayınlarınızı oynatır. Aşağıdaki üç bağlantı yönteminden birini kullanın.",
        xtreamTitle: "Xtream Codes Hesabı",
        xtreamDescription: "Sağlayıcınızın verdiği sunucu adresi, kullanıcı adı ve şifreyle bağlanın.",
        m3uUrlTitle: "M3U Bağlantısı",
        m3uUrlDescription: "Sağlayıcınızın verdiği http:// veya https:// ile başlayan adresi yapıştırın.",
        localFileTitle: "Yerel M3U Dosyası",
        localFileDescription: "Bilgisayarınızdaki .m3u veya .m3u8 dosyasını seçin.",
        privacy: "Hesap ve liste bilgileriniz yalnızca cihazınızda saklanır.",
        addYourPlaylist: "Listenizi Ekleyin"
      },
      discovery: {
        title: "Sana Özel",
        personalized: "İzlediklerinize ve favorilerinize göre seçildi",
        preferences: "İçerik tercihlerinize göre seçildi",
        highlights: "Bugünün öne çıkanları"
      },
      playlistRequiredDescription: "Canlı TV, dizi ve filmleri izlemek için bir M3U veya Xtream listesi ekleyin.",
      ownPlaylistDetails: "İçerik ayrıntılarını görmek için kendi çalma listenizi ekleyin.",
      stats: {
        total: "Toplam Öğe",
        live: "Canlı TV",
        movies: "Sinema (VOD)",
        series: "Dizi (VOD)"
      },
      emptyState: {
        recentlyWatched: "İzlediğiniz kanallar, filmler ve diziler burada görünür.",
        favorites: "Bir içeriği favorilere eklediğinizde burada görünür."
      }
    },
    favorites: {
      emptyDescription: "Kanal, film veya dizi kartındaki kalp simgesine basarak favori listenizi oluşturun.",
      liveHint: "Kanal kartındaki kalp simgesine basarak favori kanallarınızı buraya ekleyin.",
      movieHint: "Film kartındaki kalp simgesine basarak filmi favorilerinize ekleyin.",
      seriesHint: "Dizi kartındaki kalp simgesine basarak diziyi favorilerinize ekleyin."
    },
    search: {
      emptyPrompt: "Aramak için dizi, film veya canlı kanal adı yazın."
    },
    settings: {
      title: "Ayarlar",
      sections: {
        interfaceTitle: "Arayüz",
        interfaceDescription: "Dil, kart boyutu ve arayüz ölçeğini ayarlayın.",
        uiScaleTitle: "Arayüz Ölçeği",
        uiScaleDescription: "Yazıların ve arayüz elemanlarının boyutunu seçin.",
        playbackTitle: "Oynatma ve Bağlantı",
        playbackDescription: "Oynatıcıyı, ön yüklemeyi ve liste güncellemelerini ayarlayın."
      },
      updates: {
        checking: "Güncellemeler denetleniyor...",
        checkFailed: "Güncellemeler denetlenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.",
        apiUnavailable: "Güncelleme denetimi bu oturumda kullanılamıyor.",
        available: "Strmly v{{version}} indirilmeye hazır.",
        downloading: "Güncelleme indiriliyor...",
        installFailed: "Güncelleme kurulamadı. Lütfen yeniden deneyin."
      },
      details: {
        localFilesUpdate: "Yerel dosyaları güncellemek için yeniden içe aktarın.",
        downloadsPage: "İndirdiğiniz ve kaydettiğiniz içerikleri tam ekran yöneticide düzenleyin.",
        downloadManager: "İndirme hızını, disk alanını ve tüm indirmeleri tam ekran yöneticide takip edin.",
        downloadFolder: "Dizi ve filmlerin kaydedileceği klasörü seçin.",
        downloadPerformance: "HLS segment sayısını ve en yüksek indirme kalitesini seçin. IPTV hesabını korumak için aynı anda tek indirme çalışır.",
        playlistsPage: "M3U ve Xtream kaynaklarını ekleyin, etkin listeyi seçin ve yenileme sıklığını ayarlayın.",
        playlistsEmpty: "M3U veya Xtream listenizi eklediğinizde kanallar ve kataloglar burada görünür.",
        hiddenCategories: "Ana ekranda veya listelerde gizlediğiniz kategorileri geri getirin.",
        autoplay: "Bir bölüm bitince sıradaki bölümü otomatik başlatır.",
        smootherPlayback: "Yavaş bağlantılarda kesintiyi azaltmak için videoyu önceden yükler.",
        updateMode: "Yenilenen IPTV listesinin etkin kataloğa ne zaman uygulanacağını seçin.",
        advancedPlayback: "Bu seçenekleri yalnızca bağlantı veya görüntü sorunu yaşarsanız değiştirin.",
        preload: "Kesintisiz oynatma için önceden hazırlanacak video süresi.",
        connectionTimeout: "Bir yayın açılırken bağlantının en fazla ne kadar bekleneceği.",
        retryCount: "Bağlantı kesilirse kaç kez yeniden deneneceği.",
        hardwareAcceleration: "Görüntüyü ekran kartıyla işler. Donma veya siyah ekran olursa kapatmayı deneyin.",
        restartPrompt: "Bu değişiklik için Strmly yeniden başlatılmalı. Şimdi yeniden başlatılsın mı?",
        dataPage: "İzleme geçmişini, favorileri ve yerel ayar yedeklerini yönetin.",
        history: "İzleme geçmişini ve kayıtlı ilerleme bilgilerini siler.",
        favorites: "Favorilere eklenen tüm kanal, dizi ve film kayıtlarını siler.",
        backup: "Strmly ayarlarını JSON dosyası olarak dışa aktarın veya bir yedekten geri yükleyin.",
        about: "Canlı yayınlarınızı, dizilerinizi ve filmlerinizi Strmly'de düzenleyip izleyin.",
        moveExisting: "Eski klasördeki indirmeleri yeni konuma taşır.",
        transferWarning: "Aktarım tamamlanana kadar Strmly'yi kapatmayın."
      },
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
        desc: "Yayınları hangi oynatıcının açacağını seçin.",
        selectLabel: "Oynatıcı Tipi",
        internal: "Dahili Oynatıcı (HLS.js / HTML5 - Önerilen)",
        external: "Harici Oynatıcı (Sistem MPV/VLC entegrasyonu)",
        ffplay: "FFplay (Hafif ve Hızlı)",
        saveSuccess: "Varsayılan oynatıcı güncellendi.",
        transcodeMode: "Transcode Modu",
        transcodeModeDesc: "Ses formatı uyumsuzsa FFmpeg'in videoyu nasıl işleyeceğini seçin.",
        transcodeAuto: "Otomatik (H.264 ise Hızlı Kopyala - Önerilen)",
        transcodeCopy: "Sadece Ses (Kopyalama - Düşük CPU)",
        transcodeFull: "Tam Transcode (Yüksek CPU, Maksimum Uyumluluk)",
        transcodeSaveSuccess: "Transcode modu güncellendi."
      },
      playlists: {
        title: "Çalma Listesi Yönetimi",
        desc: "Mevcut M3U ve Xtream çalma listelerinizi ekleyin, düzenleyin veya yenileyin.",
        addPlaylist: "Yeni Çalma Listesi Ekle",
        playlistName: "Çalma Listesi Adı",
        playlistNamePlaceholder: "Çalma Listesi Adı...",
        urlOrPath: "M3U Bağlantısı veya Dosya Yolu",
        updateInterval: "Otomatik Güncelleme",
        lastUpdated: "Son Güncelleme: {{time}}",
        refreshBtn: "Yenile",
        refreshing: "Yenileniyor...",
        deleteConfirm: "Bu çalma listesini silmek istediğinizden emin misiniz? Listedeki tüm kategoriler kaldırılacaktır.",
        noPlaylists: "Henüz kayıtlı bir çalma listesi bulunmuyor.",
        loadSuccess: "Çalma listesi yüklendi.",
        deleteSuccess: "Çalma listesi silindi."
      },
      appearance: {
        title: "Görünüm ve Arayüz",
        desc: "Tema, renk ve görsel efektleri ayarlayın.",
        language: "Uygulama Dili / Language",
        languageDesc: "Menü ve mesajların dilini seçin.",
        theme: "Tema Stili",
        themeDesc: "Uygulamanın renk düzenini seçin.",
        accentColor: "Vurgu Rengi",
        accentDesc: "Butonlar ve aktif elemanlar için kullanılacak neon renk tonu.",
        glass: "Buzlu Cam (Glassmorphism)",
        glassDesc: "Arayüz panellerindeki cam bulanıklığı yoğunluğu.",
        neon: "Neon Işıma Efektleri",
        neonDesc: "Vurgulu elemanların etrafındaki ışıma efektini açıp kapatın.",
        cardSize: "Kart Boyutu",
        cardSizeDesc: "Kanal, film ve dizi kartlarının boyutunu seçin.",
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
        exportDesc: "Profil bilgilerini, çalma listesi bağlantılarını ve arayüz tercihlerini tek bir JSON dosyasında yedekleyin.",
        import: "Yedeği Geri Yükle",
        importDesc: "Daha önce aldığınız bir JSON yedek dosyasını seçerek uygulamayı eski durumuna getirin.",
        exportSuccess: "Ayarlar dışa aktarıldı.",
        exportError: "Yedek oluşturulamadı. Dosya erişimini kontrol edip tekrar deneyin.",
        importSuccess: "Ayarlar içe aktarıldı. Değişiklikleri uygulamak için Strmly'yi yeniden başlatın.",
        importError: "Yedek açılamadı. Geçerli bir Strmly yedek dosyası seçip tekrar deneyin."
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
      playbackError: "Yayın açılamadı. Liste bağlantısını kontrol edip tekrar deneyin.",
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
    },
    feedback: {
      genericError: "The action couldn't be completed. Try again.",
      playlist: {
        loaded: "{{count}} channels loaded.",
        xtreamConnected: "Xtream connected. {{count}} items loaded.",
        loadFailed: "The playlist couldn't load. Check the connection and try again.",
        xtreamFailed: "Xtream couldn't connect. Check the server address and sign-in details.",
        localFileFailed: "The M3U file couldn't be opened. Check that the file is valid and not empty.",
        refreshFailed: "The playlist couldn't refresh. Check the connection and try again.",
        credentialsMissing: "The saved Xtream details are incomplete. Edit the playlist and enter them again.",
        seriesLoadFailed: "Series episodes couldn't load. Refresh the playlist and try again.",
        noPlayableContent: "No playable channels or VOD were found. Check the playlist details."
      },
      profile: {
        castLoadFailed: "Cast details couldn't load. Try again.",
        loadFailed: "The profile couldn't open. Try again.",
        imageSearchFailed: "No TMDB images were found. Change the search and try again.",
        saveFailed: "The profile couldn't be saved. Check the details and try again.",
        deleteReadFailed: "The profile was not deleted because its data couldn't be read. Restart Strmly and try again.",
        deleteDiskFailed: "The profile was removed from the app, but some files could not be deleted. Restart Strmly and try again.",
        m3uSkipped: "The M3U playlist couldn't load. The profile was created without it; edit the profile to add the playlist again.",
        xtreamSkipped: "Xtream couldn't connect. The profile was created without a playlist; edit the profile to enter the details again."
      },
      downloads: {
        moveFailed: "The download location couldn't be changed. Check folder access and try again."
      },
      player: {
        externalFailed: "The external player couldn't start. Check that it is installed and try again.",
        introPointSaved: "Saved the intro skip point for {{title}} ({{start}} - {{end}})."
      }
    },
    splash: {
      loadingSettings: "Loading user settings…",
      loadingProfiles: "Loading profiles…",
      checkingUpdates: "Checking for updates…",
      updateDownloaded: "Update downloaded, installing…",
      loadingContents: "Loading contents…",
      preparingExperience: "Preparing your home screen…",
      openingApp: "Everything is ready, opening…"
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
    updateToast: {
      title: "New Update Available",
      subtitle: "A new version is ready to download.",
      updateBtn: "Update Now",
      downloading: "Downloading... {{percent}}%",
      readyToInstall: "Ready to Install",
      installing: "Installing and Restarting...",
      installingShort: "Installing",
      later: "Later",
      error: "Update Error",
      errorDescription: "The update could not be completed. Check your connection and try again."
    },
    profiles: {
      title: "Who's Watching?",
      subtitle: "Choose a profile to open its watch history and favorites.",
      editProfiles: "Edit Profiles",
      finish: "Done",
      newProfile: "New Profile",
      profileSettings: "Profile Settings",
      profileName: "Profile Name",
      profileNamePlaceholder: "Profile Name...",
      selectAvatar: "Select Avatar",
      avatarSearchPlaceholder: "Search image or paste URL...",
      deleteProfileTitle: "Delete Profile",
      deleteProfileConfirm: "Are you sure you want to delete this profile? This action cannot be undone and all history/favorites for this profile will be permanently deleted.",
      deleteConfirmBtn: "Delete Profile",
      contentPrefsTitle: "Content Preferences",
      contentPrefsDesc: "Select the content types you want to display on this profile.",
      autoUpdateInterval: "Auto Update Interval",
      autoUpdateDesc: "Choose how often the playlist refreshes.",
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
      loadingProfilesError: "Profiles couldn't load. Try again.",
      entry: {
        welcome: "Welcome",
        fallbackName: "Your profile",
        preparingProfile: "Opening your profile",
        loadingLibrary: "Loading your library",
        preparingHome: "Preparing your home screen",
        ready: "Ready"
      },
      contentTypes: {
        series: "Series",
        movies: "Movies",
        sports: "Sports",
        live: "Live TV",
        kids: "Kids"
      },
      messages: {
        localSeriesLoadFailed: "The local series list couldn't load. Check the TMDB connection.",
        setupMayTakeTime: "This may take a while for larger playlists.",
        playlistRefreshInBackground: "The playlist refreshes in the background when the interval ends.",
        noProfilesToEditDescription: "You do not have any created profiles yet. You can create a profile using the button below."
      },
      setupWizard: {
        step1Title: "Profile Info",
        step1Desc: "Set your profile name and avatar.",
        step2Title: "Playlist Type",
        step2Desc: "Choose which IPTV format you want to use.",
        step3Title: "Connection Details",
        step3Desc: "Enter your IPTV service credentials.",
        step4Title: "Personalization",
        step4Desc: "Choose which content to show and how often the playlist refreshes.",
        nextStep: "Next Step",
        prevStep: "Previous Step",
        createProfile: "Create Profile",
        saveChanges: "Save Changes",
        playlistRequired: "Please enter a valid IPTV list or choose 'Setup Later'.",
        setupLater: "Setup Later (Empty Profile)",
        m3uFileSelected: "File Selected: {{name}}",
        connectionIntro: "Enter your IPTV details to start watching, or add them later.",
        addLaterDescription: "Create the profile now and add your streaming details later under Settings.",
        profileDataDescription: "Favorites and watch history are saved to this profile."
      }
    },
    home: {
      noPlaylistsTitle: "Add a playlist to start watching",
      noPlaylistsDesc: "Add your M3U or Xtream playlist under Settings > Playlists.",
      goToSettings: "Go to Settings",
      welcomeBack: "Welcome Back!",
      recentlyWatched: "Recently Watched",
      myFavorites: "My Favorites",
      clearHistory: "Clear History",
      clearFavorites: "Clear Favorites",
      setup: {
        title: "Add your playlist to start watching",
        description: "Connect your Xtream Codes account, M3U URL, or an M3U file from your computer.",
        addPlaylist: "Add IPTV Playlist",
        requiredDetails: "Show required details",
        guideTitle: "Connect your playlist",
        guideDescription: "Strmly plays your own streams. Use one of the three connection methods below.",
        xtreamTitle: "Xtream Codes Account",
        xtreamDescription: "Connect with the server address, username, and password from your provider.",
        m3uUrlTitle: "M3U URL",
        m3uUrlDescription: "Paste the address from your provider that starts with http:// or https://.",
        localFileTitle: "Local M3U File",
        localFileDescription: "Choose an .m3u or .m3u8 file from your computer.",
        privacy: "Your account and playlist details stay on this device.",
        addYourPlaylist: "Add Your Playlist"
      },
      discovery: {
        title: "For You",
        personalized: "Picked from your watch history and favorites",
        preferences: "Picked from your content preferences",
        highlights: "Today's highlights"
      },
      playlistRequiredDescription: "Add an M3U or Xtream playlist to watch live TV, series, and movies.",
      ownPlaylistDetails: "Add your own playlist to see content details.",
      stats: {
        total: "Total Items",
        live: "Live TV",
        movies: "Movies (VOD)",
        series: "Series (VOD)"
      },
      emptyState: {
        recentlyWatched: "Channels, movies, and series you watch appear here.",
        favorites: "Content you add to favorites appears here."
      }
    },
    favorites: {
      emptyDescription: "Use the heart on a channel, movie, or series card to build your favorites list.",
      liveHint: "Use the heart on a channel card to add it here.",
      movieHint: "Use the heart on a movie card to add it to favorites.",
      seriesHint: "Use the heart on a series card to add it to favorites."
    },
    search: {
      emptyPrompt: "Type a series, movie, or live channel name to search."
    },
    settings: {
      title: "Settings",
      sections: {
        interfaceTitle: "Interface",
        interfaceDescription: "Set the language, card size, and interface scale.",
        uiScaleTitle: "UI Scale",
        uiScaleDescription: "Choose the size of text and interface controls.",
        playbackTitle: "Playback & Connection",
        playbackDescription: "Set the player, preloading, and playlist update behavior."
      },
      updates: {
        checking: "Checking for updates...",
        checkFailed: "Updates couldn't be checked. Check your internet connection and try again.",
        apiUnavailable: "Update checks aren't available in this session.",
        available: "Strmly v{{version}} is ready to download.",
        downloading: "Downloading the update...",
        installFailed: "The update couldn't be installed. Please try again."
      },
      details: {
        localFilesUpdate: "Import local files again to update them.",
        downloadsPage: "Organize downloaded and saved content in the full-screen manager.",
        downloadManager: "Track download speed, disk space, and every download in the full-screen manager.",
        downloadFolder: "Choose where movies and series are saved.",
        downloadPerformance: "Choose the HLS segment count and highest download quality. One download runs at a time to protect your IPTV account.",
        playlistsPage: "Add M3U and Xtream sources, choose the active playlist, and set how often it refreshes.",
        playlistsEmpty: "Channels and catalogs appear here after you add an M3U or Xtream playlist.",
        hiddenCategories: "Restore categories hidden from the home screen or lists.",
        autoplay: "Starts the next episode when the current one ends.",
        smootherPlayback: "Preloads video to reduce interruptions on slower connections.",
        updateMode: "Choose when a refreshed IPTV playlist replaces the active catalog.",
        advancedPlayback: "Change these options only when troubleshooting connection or display problems.",
        preload: "The amount of video prepared for smoother playback.",
        connectionTimeout: "How long Strmly waits for a stream to connect.",
        retryCount: "How many times Strmly retries after the connection drops.",
        hardwareAcceleration: "Processes video with the graphics card. Turn it off if playback freezes or shows a black screen.",
        restartPrompt: "Strmly must restart to apply this change. Restart now?",
        dataPage: "Manage watch history, favorites, and local settings backups.",
        history: "Deletes watch history and saved progress.",
        favorites: "Deletes every channel, series, and movie saved to favorites.",
        backup: "Export Strmly settings as JSON or restore them from a backup.",
        about: "Organize and watch live channels, series, and movies in Strmly.",
        moveExisting: "Moves downloads from the old folder to the new location.",
        transferWarning: "Keep Strmly open until the transfer finishes."
      },
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
        desc: "Choose which player opens your streams.",
        selectLabel: "Player Type",
        internal: "Internal Player (HLS.js / HTML5 - Recommended)",
        external: "External Player (System MPV/VLC Integration)",
        ffplay: "FFplay (Lightweight & Fast)",
        saveSuccess: "Default player updated.",
        transcodeMode: "Transcode Mode",
        transcodeModeDesc: "Choose how FFmpeg handles video when the audio format is incompatible.",
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
        playlistNamePlaceholder: "Playlist Name...",
        urlOrPath: "M3U Link or File Path",
        updateInterval: "Auto Update",
        lastUpdated: "Last Updated: {{time}}",
        refreshBtn: "Refresh",
        refreshing: "Refreshing...",
        deleteConfirm: "Are you sure you want to delete this playlist? All categories inside this playlist will be removed.",
        noPlaylists: "No saved playlists found.",
        loadSuccess: "Playlist loaded.",
        deleteSuccess: "Playlist deleted."
      },
      appearance: {
        title: "Appearance & Interface",
        desc: "Set the theme, colors, and visual effects.",
        language: "App Language / Uygulama Dili",
        languageDesc: "Choose the language for menus and messages.",
        theme: "Theme Style",
        themeDesc: "Choose the app's color scheme.",
        accentColor: "Accent Color",
        accentDesc: "Neon color accent for buttons and active elements.",
        glass: "Glassmorphism Intensity",
        glassDesc: "The blur intensity of interface panels.",
        neon: "Neon Glow Effects",
        neonDesc: "Turn on/off the glow effect around highlighted elements.",
        cardSize: "Card Size",
        cardSizeDesc: "Choose the size of channel, movie, and series cards.",
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
        exportSuccess: "Settings exported.",
        exportError: "The backup couldn't be created. Check file access and try again.",
        importSuccess: "Settings imported. Restart Strmly to apply them.",
        importError: "The backup couldn't be opened. Choose a valid Strmly backup and try again."
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
      playbackError: "The stream couldn't open. Check the playlist connection and try again.",
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

export function getTranslation(
  key: string,
  lang: Language = 'tr',
  params: Record<string, string | number> = {},
): string {
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
      if (typeof fallback !== 'string') return key;
      return fallback.replace(/\{\{(\w+)\}\}/g, (match, name) => (
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
      ));
    }
  }

  if (typeof current !== 'string') return key;
  return current.replace(/\{\{(\w+)\}\}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  ));
}
