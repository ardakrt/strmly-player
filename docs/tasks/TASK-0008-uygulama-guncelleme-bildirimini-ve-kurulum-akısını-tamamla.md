# TASK-0008: Uygulama güncelleme bildirimini ve kurulum akışını tamamla

## Amac

Strmly açıldığında paketlenmiş uygulamanın yeni GitHub sürümünü otomatik denetlemesi; güncelleme bulunduğunda sağ altta navbar ile aynı siyah-beyaz cam dilini kullanan bir kart göstermesi; kullanıcının `Daha sonra` veya `Güncelle` seçebilmesi; `Güncelle` ile indirme, kurulum ve yeniden açılışın tek akışta tamamlanması. Aynı durum ve eylemler Ayarlar > Hakkında ekranında da bulunacak.

## Kapsam

- Paketlenmiş uygulamada açılıştan kısa süre sonra sessiz güncelleme kontrolü.
- `electron-updater` durumlarının güvenli IPC üzerinden renderer'a iletilmesi.
- Kullanıcı onayı gelmeden indirme başlatmayan, tek tıklamayla indirip kuran ve uygulamayı yeniden açan akış.
- Sağ alt siyah-beyaz cam güncelleme kartı; sürüm, sürüm notu, ilerleme, `Daha sonra` ve `Güncelle` eylemleri.
- Ayarlar > Hakkında ekranında mevcut durumun okunması, elle denetleme, indirme/kurulum ilerlemesi ve yeniden başlatma eylemleri.
- Odaklı regresyon kontrolleri.

## Kapsam disi

- Yeni GitHub sürümü, tag, release veya installer yayımlamak.
- Kod imzalama sertifikası veya GitHub izinlerini değiştirmek.
- IPTV liste otomatik güncelleme davranışını değiştirmek.
- macOS paketleme hedefi eklemek.

## Etkilenen dosyalar

- `electron/main.js`
- `electron/preload.js`
- `src/hooks/useAppBoot.ts`
- `src/components/UpdateToast.tsx`
- `src/components/SettingsPanel.tsx`
- `src/types/index.ts`
- `src/utils/translations.ts`
- `src/index.css`
- `scripts/test-regressions.js`
- `docs/HANDOFF.md`

## Veri tabani etkisi

Yok; uygulama ve profil verileri değişmiyor.

## Guvenlik etkisi

Güncelleme kaynağı, `package.json` içindeki mevcut GitHub provider yapılandırmasıdır. Renderer doğrudan ağ veya dosya sistemi erişimi almaz; yalnızca dar IPC eylemlerini çağırır. Ham updater hata ayrıntıları kullanıcı arayüzüne taşınmayacak. Yayımlanmış installer ve manifest bütünlüğü `electron-updater` tarafından doğrulanır; kod imzalama bu görevin dışındadır ve yayın öncesi ayrıca değerlendirilmelidir.

## Yetki/auth etkisi

Yeni kullanıcı yetkisi yok. GitHub release yayınlama yetkisi kullanılmayacak.

## Lokalizasyon etkisi

Güncelleme kartı ve Ayarlar eylemleri Türkçe/İngilizce çeviri anahtarlarıyla gösterilecek.

## UX etkisi

Kontrol sessizdir; güncel sürümde açılış bildirimi gösterilmez. Yeni sürüm bulunduğunda sağ altta tek kart görünür. `Daha sonra` kartı kapatır ve indirme başlatmaz. `Güncelle` indirme ilerlemesini aynı kartta gösterir; indirme tamamlanınca kurulum başlar ve uygulama güncel sürümle yeniden açılır.

## Log/audit etkisi

Updater ayrıntıları mevcut yerel `app.log` üzerinden ana süreçte tutulur. Kullanıcı arayüzüne yalnızca genel, hassas ayrıntı içermeyen hata metni gönderilir.

## Kabul kriterleri

- Paketlenmiş uygulama açılıştan sonra otomatik olarak güncelleme denetler.
- Güncelleme bulunana kadar sağ alt kart gösterilmez.
- Güncelleme bulunduğunda kart navbar ile uyumlu siyah-beyaz cam yüzeyde sürüm ve eylemleri gösterir.
- `Daha sonra` indirme başlatmadan kartı kapatır.
- `Güncelle` tek tıklamayla indirmeyi başlatır; ilerleme güncellenir; indirme sonrası installer çalışır ve uygulama yeniden açılır.
- Kullanıcı onayından önce `autoDownload` kapalıdır; uygulama normal kapanışta gizlice güncelleme kurmaz.
- Ayarlar > Hakkında açılışta mevcut updater durumunu okur ve aynı denetleme/kurulum eylemlerini sunar.
- Renderer yalnızca preload üzerinden tanımlı IPC API'lerini kullanır.
- Regresyon, typecheck, build ve ilgili lint kontrolleri geçer; repository genelindeki önceden mevcut engeller ayrı raporlanır.

## Test adimlari

1. `npm run test:regressions`
2. `npm run typecheck`
3. Hedefli ESLint: updater ile değişen JS/TS/TSX dosyaları.
4. `npm run build`
5. `npm run verify`
6. Development Electron'da kart/Ayarlar görsel kontrolü; gerçek update ağı yalnız paketlenmiş eski sürüm + daha yeni yayımlanmış release ile doğrulanabilir.
7. `ackit doctor`
8. `ackit scan --ci`
9. Görev kapsamındaki `git diff --check`.

## Riskler

- Çalışma ağacı yoğun biçimde kirli ve hedef dosyalar önceden kullanıcı değişiklikleri içeriyor; yalnız hedefli satırlar değiştirilecek.
- Gerçek kurulum testi, mevcut sürümden daha yeni yayımlanmış uygun platform artifact'i ve `latest.yml`/`latest-linux.yml` gerektirir; bu görev release yayımlamaz.
- Windows kurulum davranışı installer kapsamına ve kod imzasına bağlıdır. Mevcut NSIS hedefi korunur.
- Aynı anda açılış ve manuel denetleme çağrıları yarışabilir; updater'ın tek durum kaynağı ana süreçte tutulacak.

## Geri alma plani

Updater'ın `autoDownload`/IPC değişiklikleri, `UpdateToast` ve Hakkında güncelleme bölümü ayrı ayrı önceki sürümlerine döndürülebilir. Veri migrasyonu olmadığı için kalıcı veri geri alımı gerekmez.

## Tamamlama notlari

Tamamlandı.

- Kök neden/gap: updater altyapısı çalışma ağacında kısmen vardı; `autoDownload=true` kullanıcı kararından önce indirme başlatıyordu, `Güncelle` eylemi indirilmemiş sürümde `downloadUpdate()` çağırmıyordu ve preload `download-update` IPC'sini renderer'a açmıyordu.
- Ana süreç `autoDownload=false`, `autoInstallOnAppQuit=false`, `autoRunAppAfterInstall=true` ve `disableWebInstaller=true` kullanıyor. Paketlenmiş uygulama açılıştan 3 saniye sonra sessiz denetliyor.
- `Güncelle`, tek ana-süreç akışında indirmeyi başlatıyor; ilerleme renderer'a iletiliyor; `update-downloaded` sonrasında `quitAndInstall(true, true)` kurulum ve yeniden açılışı tetikliyor.
- Tekrarlanan indirme çağrıları ortak promise ile birleştiriliyor. Ham updater hata ayrıntıları yalnız yerel logda kalıyor; arayüz genel ve çevrilmiş mesaj gösteriyor.
- Sağ alt `UpdateToast`, navbar'ın siyah-beyaz cam diliyle uyumlu koyu blur yüzey, sürüm rozeti, düz metne çevrilmiş sürüm notları, ilerleme, `Daha Sonra` ve `Güncelle` eylemleriyle tamamlandı. Reduced-motion desteği eklendi.
- Ayarlar > Hakkında, `getUpdateState()` ile mevcut ana-süreç durumunu devralıyor; elle denetleme, güncelleme, ilerleme ve kur/yeniden başlat eylemlerini gösteriyor.
- PASS: `node --check electron/main.js` ve `electron/preload.js`.
- PASS: hedefli ESLint (`electron/main.js`, `electron/preload.js`, `useAppBoot.ts`, `UpdateToast.tsx`, `SettingsPanel.tsx`, `test-regressions.js`).
- PASS: `npm run typecheck`.
- PASS: `npm run test:regressions`.
- PASS: `npm run build`.
- PASS: Windows x64 NSIS paket üretimi; `Strmly Setup 1.8.0.exe`, blockmap, `latest.yml` SHA-512 ve paket içi `app-update.yml` üretildi.
- PASS: izole paket smoke testi; test sürümü 1.7.9 olarak açıldı, GitHub v1.8.0 bulundu, sağ alt kart ve iki eylem erişilebilirlik ağacında doğrulandı. HTML sürüm notları ilk kontrolde görüldü; normalizasyon eklendikten sonra etiketlerin kaldırıldığı yeniden doğrulandı.
- Kısmi davranış kanıtı: masaüstü otomasyonu alt eylem çerçevesini yanlış eşleyerek indirme yolunu tetikledi; updater SHA-512/differential fallback kontrolünü çalıştırdı. Kurulumun tamamlandığı iddia edilmiyor. Testin indirdiği installer, gerçek updater cache'inden çalışma alanındaki `.tmp/update-smoke-cache-quarantine` klasörüne taşındı; çalışan test süreci kalmadı.
- Geçici `.tmp/update-smoke-*` test artifact'lerini silme girişimi çalışma ortamı politikası tarafından engellendi; artifact'ler untracked ve çalışma alanı dışına etki etmiyor. `dist-electron` doğrulama paketi de ignored build artifact'i olarak bırakıldı.
- BLOCKED: `npm run verify`; görev öncesi `MainViewRouter.tsx` ve `SpotlightSearch.tsx` dört unused değer. `check:a11y` aynı `SpotlightSearch.tsx` içindeki üç adsız düğmede başarısız.
- BLOCKED (repository health): `ackit doctor` ve `ackit scan --ci`, önceden mevcut SECURITY/test/redact bulguları nedeniyle geçmiyor.
- Veri tabanı, profil verisi, auth ve permission etkisi yok. Release/tag/push/commit yapılmadı.
