# TASK-0007: Ayarlar geçişindeki navbar flicker ve logo görünürlüğünü düzelt

## Amac

Ayarlar ekranına girerken navbar'ın yaklaşık bir saniye kaybolup yeniden görünmesini önlemek ve şeffaf Strmly logosunu Ayarlar > Hakkında ekranında doğru kontrastla göstermek.

## Kapsam

- Navbar görünürlüğünü geçici katalog hazırlık durumundan ayırmak.
- Ayarlar ekranındaki logo kabının şeffaf/beyaz logo ile kontrastını düzeltmek.
- Logo paketinin mevcut uygulama asset'leriyle aynı olduğunu doğrulamak.
- İki hata için odaklı regresyon kontrolleri eklemek.

## Kapsam disi

- Navbar tasarımını veya navigasyon davranışını yeniden tasarlamak.
- Logo dosyasını yeniden üretmek ya da görsel içeriğini değiştirmek.
- Paketleme, sürüm, commit, push veya release işlemleri.

## Etkilenen dosyalar

- `src/components/AppShell.tsx`
- `src/components/SettingsPanel.tsx`
- `scripts/test-regressions.js`
- `docs/HANDOFF.md`

## Veri tabani etkisi

Yok; veri modeli veya kalıcı kullanıcı verisi değişmiyor.

## Guvenlik etkisi

Yok; kimlik bilgileri, IPC veya dış kaynak erişimi değişmiyor.

## Yetki/auth etkisi

Yok.

## Lokalizasyon etkisi

Yok; mevcut Türkçe/İngilizce metinler korunuyor.

## UX etkisi

Navbar uygulama kabuğu açık kaldığı sürece görünür kalacak. Şeffaf logo koyu bir yüzey üzerinde okunabilir olacak.

## Log/audit etkisi

Yok; yeni log veya telemetri eklenmiyor.

## Kabul kriterleri

- Ayarlar'a geçişte navbar geçici katalog hazırlığı sırasında unmount olmaz.
- Navbar'ın ilk açılış kapısı davranışı korunur.
- Ayarlar > Hakkında logosu koyu kontrast kabı üzerinde açıkça görünür.
- `public/icon.png` ve `build/icon.png` verilen logo paketindeki karşılıklarıyla SHA-256 olarak eşleşir.
- TypeScript, regresyon ve production build kontrolleri geçer; repository genelindeki önceden mevcut engeller ayrı raporlanır.

## Test adimlari

1. Logo SHA-256 karşılaştırması.
2. `npm run typecheck`
3. `npm run test:regressions`
4. `npm run build`
5. Mümkünse gerçek Electron'da Ayarlar geçişi ve logo görsel kontrolü.
6. `npm run verify`
7. `ackit doctor`
8. `ackit scan --ci`
9. Task kapsamındaki `git diff --check`

## Riskler

- Çalışma ağacı yoğun biçimde kirli ve hedef dosyalar kullanıcı değişiklikleri içeriyor. Yalnız doğrulanmış satırlar düzenlenecek.
- Navbar görünürlüğü yanlış sinyale bağlanırsa ilk açılışta erken görünebilir. AppGate'in kalıcı boot kapısı ve performans benchmark istisnası korunacak.
- Şeffaf logo açık zeminde kaybolur; logo kabı koyu ve sabit kontrastlı tutulacak.

## Geri alma plani

`AppShell.tsx` içindeki navbar `loaded` sinyali ve `SettingsPanel.tsx` logo kabı sınıfları önceki değerlerine döndürülebilir. Asset dosyaları değiştirilmediği için ikili dosya geri alımı gerekmez.

## Tamamlama notlari

Tamamlandı.

### 2026-08-10 devam isteği

- Kullanıcı, Hakkında ekranındaki logo kabının arkasında görünen beyaz ışığın kaldırılmasını istedi.
- Kök neden, `settings-brand-logo-shell` üzerindeki `shadow-[0_0_50px_rgba(255,255,255,0.08)]` sınıfıdır.
- Kapsam yalnızca bu parlama gölgesini kaldırmak ve koyu kontrast yüzeyini korumaktır.
- Kabul: logo kabının sınıfında beyaz parlama gölgesi bulunmaz; odaklı regresyon testi ve build geçer.
- Tamamlandı: beyaz parlama gölgesi kaldırıldı; koyu yüzey ve logo kontrastı korundu. Regresyon, typecheck ve build geçti.

- Kök neden: `AppGate` uygulama kabuğunu kalıcı `boot.hasInitialBooted` sinyaliyle açık tutarken `Navbar`, katalog hazırlığı sırasında tekrar `false` olabilen `boot.isAppReady` sinyalini kullanıyordu. Navbar görünürlüğü aynı kalıcı boot sinyaline geçirildi; performans benchmark istisnası korundu.
- Logo asset'i değiştirilmedi. `build/icon.png` ve `electron/icon.png`, paketteki 512 px logo ile; `public/icon.png`, 256 px logo ile SHA-256 olarak birebir eşleşiyor.
- Ayarlar > Hakkında logo kabı beyaz zeminden `bg-neutral-950` koyu kontrast yüzeyine geçirildi; logo 56 px yerine 64 px gösteriliyor.
- `scripts/test-regressions.js`, navbar'ın `boot.hasInitialBooted` kullanmasını, `boot.isAppReady` kullanmamasını ve şeffaf logonun koyu yüzeyde olmasını doğruluyor.
- PASS: `npm run typecheck`
- PASS: `npm run test:regressions`
- PASS: `npm run build`
- PASS: canlı Electron/HMR testi: profil menüsünden Ayarlar'a tıklandığı anda Settings chunk henüz yüklenmemişken bile `Ana navigasyon` ağacında navbar görünür kaldı; içerik yüklendikten sonra da kaldı.
- PASS: canlı Electron/HMR testi: Hakkında ekranında şeffaf logo koyu kutu üzerinde görsel olarak net ve doğru kontrastta.
- BLOCKED: `npm run verify`; görev öncesi `MainViewRouter.tsx` ve `SpotlightSearch.tsx` dört unused değer.
- Veri tabanı, auth, izin, deployment ve release etkisi yok. Commit/push yapılmadı.
