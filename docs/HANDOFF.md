# Handoff

## 2026-08-12 - TASK-0014 ACKit proje entegrasyonu kaldırıldı

Projeye ait `.ackit` yapılandırması, `ackit-first-development` becerisi ve ACKit tarafından üretilmiş Codex/Claude/Anthropic/Copilot/Cursor/Continue bağlam-yönerge dosyaları kaldırıldı. Üretilmiş AI workflow, geliştirme standardı ve eski proje haritası da kaldırıldı. Paket manifestinde ACKit bağımlılığı veya scripti yok. Bilgisayarda kurulu global .NET aracı proje kapsamı dışında bırakıldı; tarihsel görev/handoff kanıtları korundu.

PASS: aktif proje yüzeylerinde ACKit referansı yok; `npm run verify` lint, unused typecheck, migration/security/catalog/regresyon testleri, a11y ve 1873 modüllü production build ile geçti. Kullanıcı verisi ve uygulama kaynak kodu değiştirilmedi. Commit/push/release yapılmadı.

## Önceki handofflar

## 2026-08-12 - TASK-0013 Spotlight kart klavye erişimi tamamlandı

Spotlight arama sonuç kartları yerel düğmelere dönüştürüldü. Arama geçmişindeki seçme/kaldırma ve son açılan medya kartlarındaki açma/kaldırma eylemleri iç içe etkileşimli öğe oluşturmadan ayrı düğmelere bölündü. Kartlar artık Tab ile odaklanıyor, Enter/Space ile çalışıyor ve dinamik erişilebilir adlarını görünür içerikten alıyor. Görsel düzen, arama/veri akışı ve fare davranışı korunuyor.

PASS: hedefli ESLint, `typecheck:unused`, `check:a11y` (Spotlight 11 düğme/0 adsız), regresyonlar ve tam `npm run verify` (1873 modül production build). Commit/push/release yapılmadı; repository genelindeki önceden var olan kirli çalışma ağacı korundu.

## Önceki handofflar

## 2026-08-12 - TASK-0012 Spotlight ölü kod/a11y temizliği tamamlandı

`MainViewRouter` kullanılmayan Spotlight import'u; Spotlight içindeki değeri okunmayan iki state, iki reset effect'i ve kullanılmayan `displayList` memo kaldırıldı. Üç dinamik/ikon-only düğme açıklayıcı TR/EN accessible name aldı. Görsel tasarım, worker araması, Esc/Enter, geçmiş ve sonuç açma davranışı korunuyor.

PASS: hedefli ESLint, `typecheck:unused`, `check:a11y` (Spotlight 8 düğme/0 adsız), regresyonlar ve tam `npm run verify`. Commit/push/release yapılmadı. Sonraki güvenli inceltme adayı: Spotlight sonuç/geçmiş kartlarındaki tıklanabilir `div` yüzeylerini klavye ile çalışır hale getirmek.

## Önceki handofflar

## 2026-08-12 - TASK-0010 navigasyon optimizasyonu devam ediyor

Dolu/offline baseline Sinema navigation p95 47.4 ms, Diziler 60.1 ms olarak alındı; Diziler 60 ms eşiğini geçti. Letterbox cache, TMDB effect fast-path, rail mount penceresi, WeakMap grup indeksi ve opacity-only geçiş denendi; doğrulanmayan veya dolu-yük karşılaştırmasını değiştiren uygulama değişikliklerinin tamamı geri alındı.

Windows/Electron rAF zamanlayıcısı sonraki turlarda 1001-2002 ms'ye throttle oldu. `electron/performance-benchmark.js` artık paint/scroll frame beklemesi 250 ms'yi aşınca açık hata vererek sahte sonucu engelliyor. Son tur `Frame timer throttled while waiting for paint (319.0ms)` ile durdu; `STRMLY_PERF_RESULT` yok, dolayısıyla task tamamlanmadı. `npm run test:regressions`, JS syntax ve production build geçti. Devam için ekran açık/uyanık ve benchmark penceresi görünür durumda yeniden baseline alınmalı.

## Önceki handofflar

## 2026-08-10 - TASK-0009 kaydırma ve geçiş akıcılığı

`TASK-0009` tamamlandı. Boş temp profil ile üretilen ilk performans sonuçları geçersiz sayıldı. Benchmark artık ignored yerel `profiles` klasöründen benzersiz, silinen temp snapshot alıyor; dolu katalog için en az 1000 px scroll ve en az 20 render edilmiş kart şartı uyguluyor; TMDB ağı test modunda tamamen kapalı.

Dolu-data baseline'da Canlı TV/Sinema/Diziler scroll p95 değerleri 30.5/25.8/34.6 ms, missed-frame oranları %39.17/%10.83/%32.5 idi. Rail giriş animasyonu yalnız ilk iki rail'in ilk sekiz kartıyla sınırlandı; scroll sırasında açılan rail animasyonları ve geniş kalıcı compositor zorlaması kaldırıldı. Nihai 30 örnekli offline production Electron testinde p95 değerleri 8.9/8.3/10.0 ms, missed-frame oranları %0.83/%0/%0 oldu. Her sayfa 2400 px scroll edildi ve dolu kart şartını geçti.

PASS: hedefli ESLint, normal typecheck, security/regresyon testleri, production build ve `npm run test:performance`. BLOCKED (önceden mevcut): `npm run verify`, `MainViewRouter.tsx`/`SpotlightSearch.tsx` dört unused değer; Spotlight üç adsız düğme; ACKit `.env`/repository-health bulguları. Gerçek profil/IPTV verisi değiştirilmedi; temp snapshot temizlendi. Commit/push/release yapılmadı.

## Önceki handoff

## Aktif task

`TASK-0008`: Uygulama güncelleme bildirimini ve kurulum akışını tamamla.

## Durum

Uygulama güncelleme akışı tamamlandı. Paketlenmiş Strmly açılıştan kısa süre sonra GitHub release denetimi yapıyor; yeni sürüm varsa sağ altta navbar ile uyumlu siyah-beyaz cam kart gösteriyor. `Daha Sonra` kartı kapatıyor. `Güncelle` indirme, kurulum ve yeniden açılışı tek ana-süreç akışında yürütüyor.

Ayarlar > Hakkında aynı updater durumunu ana süreçten devralıyor ve denetleme/güncelleme/ilerleme/yeniden başlatma kontrollerini gösteriyor. Sürüm notlarındaki HTML etiketleri güvenli düz metne çevriliyor.

## Değişen yüzeyler

- `electron/main.js`: sessiz açılış kontrolü, kullanıcı-onaylı indirme, SHA doğrulamalı updater durumu ve otomatik kur/yeniden aç.
- `electron/preload.js` ve `src/types/index.ts`: dar updater IPC sözleşmesi.
- `src/hooks/useAppBoot.ts`: global updater durumunun ve sağ alt kartın yaşam döngüsü.
- `src/components/UpdateToast.tsx` ve `src/index.css`: siyah-beyaz cam bildirim kartı.
- `src/components/SettingsPanel.tsx`: Hakkında sayfasında mevcut durum, denetleme ve kurulum kontrolleri.
- `src/utils/translations.ts`: Türkçe/İngilizce güncelleme metinleri.
- `scripts/test-regressions.js`: onay öncesi indirme yasağı, IPC, kurulum ve UI regresyonları.
- `docs/tasks/TASK-0008-uygulama-guncelleme-bildirimini-ve-kurulum-akısını-tamamla.md`: kapsam ve kanıt.

## Korunan kullanıcı çalışması

Repository genelindeki yoğun kirli çalışma ağacı korundu. Mevcut kısmi updater kodu yeniden yazılmadı; hedefli bağlantı ve durum düzeltmeleri yapıldı. Profil/IPTV verileri değiştirilmedi. İzole smoke test ayrı user-data ve paket kopyasıyla çalıştırıldı.

Geçici `.tmp/update-smoke-*` test artifact'lerini temizleme işlemi çalışma ortamı politikası tarafından engellendi; çalışan test süreci yok. `dist-electron` içindeki doğrulama paketi ignored build artifact'i olarak bırakıldı.

## Kanıt

- PASS: `npm run typecheck`
- PASS: `npm run test:regressions`
- PASS: `npm run build`
- PASS: hedefli ESLint ve Node syntax kontrolleri
- PASS: Windows NSIS paket, blockmap, `latest.yml` SHA-512 ve `app-update.yml` üretimi
- PASS: izole paket 1.7.9 → GitHub 1.8.0 update-available smoke testi; cam kart, sürüm, sürüm notları ve eylemler doğrulandı
- PASS: HTML sürüm notlarının düz metne dönüştürülmesi yeniden doğrulandı
- BLOCKED: `npm run verify` (`MainViewRouter.tsx`, `SpotlightSearch.tsx` unused değerleri)
- BLOCKED: `check:a11y` (`SpotlightSearch.tsx` üç adsız düğme)
- BLOCKED: ACKit repository-health/redact bulguları

## Sonraki adım

Gerçek son kullanıcı kurulum zincirinin nihai kanıtı için bir sonraki sürüm yayımlandığında eski imzalı/paketlenmiş sürümden yeni sürüme kontrollü update testi yapılmalı. Ayrı task kapsamında Spotlight Search kullanılmayan değerleri ve üç adsız düğmesi düzeltilerek `npm run verify` yeniden çalıştırılabilir. `.env`, kod imzalama ve ACKit public-release bulguları yayın öncesi maintainer incelemesi gerektirir.
