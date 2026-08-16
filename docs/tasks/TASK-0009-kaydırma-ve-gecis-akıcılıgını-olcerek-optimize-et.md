# TASK-0009: Kaydırma ve geçiş akıcılığını ölçerek optimize et

## Amac

Strmly'nin üretim Electron ortamında kaydırma ve sayfa geçişi akıcılığını güncel benchmark ile ölçmek; doğrulanmış darboğazlara en küçük, davranış koruyan düzeltmeleri uygulamak.

## Kapsam

- `npm run test:performance` ile değişiklik öncesi ve sonrası navigation/scroll ölçümü.
- Scroll handler, görünürlük gözlemcileri, kart render maliyeti ve sürekli compositor katmanı oluşturan CSS ipuçlarının incelenmesi.
- Yalnız ölçüm veya açık kod kanıtıyla desteklenen küçük performans düzeltmeleri.
- İlgili regresyon, typecheck/build ve repository doğrulama kapıları.

## Kapsam disi

- Görsel tasarımı veya kullanıcı akışlarını yeniden tasarlamak.
- Veri yükleme, IPTV kimlik bilgileri, profil verileri ya da TMDB sonuç politikasını değiştirmek.
- Geniş bileşen refaktörü, bağımlılık güncellemesi, release/tag/push/commit.
- Mevcut unrelated lint, erişilebilirlik veya ACKit repository-health borçlarını bu task içinde topluca düzeltmek.

## Etkilenen dosyalar

- `scripts/test-performance.ps1` ve `electron/performance-benchmark.js` (ölçüm; gerekmedikçe değiştirilmeyecek)
- `src/hooks/useAppProvider.ts` (yalnız güncel handler kanıtı gerektirirse)
- `src/components/ImageWithFallback.tsx` ve katalog rail/card bileşenleri (yalnız ölçüm doğrularsa)
- `src/index.css` (compositor/geçiş maliyeti doğrulanırsa)
- `docs/HANDOFF.md`

## Veri tabani etkisi

Yok; kalıcı veri şeması ve profil/IPTV verileri değişmeyecek.

## Guvenlik etkisi

Yeni ağ, dosya sistemi veya IPC yetkisi yok. Mevcut `.env`/ACKit bulguları task öncesi durum olarak korunacak ve release-blocking sayılmaya devam edecek.

## Yetki/auth etkisi

Yok; kullanıcı yetkileri ve oturum davranışı değişmeyecek.

## Lokalizasyon etkisi

Yok; yeni kullanıcı metni planlanmıyor.

## UX etkisi

Hedef, mevcut görünümü ve etkileşimleri koruyarak kaydırma/geçiş takılmalarını azaltmak. Animasyon kaldırılması gerekirse yalnız benchmark regresyonu ve görsel davranış kontrolüyle sınırlandırılacak.

## Log/audit etkisi

Kalıcı log sözleşmesi değişmeyecek. Benchmark çıktısındaki `STRMLY_PERF_RESULT` task kanıtına özet olarak kaydedilecek; kullanıcı verisi kaydedilmeyecek.

## Kabul kriterleri

- Değişiklik öncesi production Electron benchmark sonucu veya sonuç üretilememesinin kesin nedeni kaydedilir.
- Değişiklik, doğrulanmış bir render/scroll maliyetini hedefler ve mevcut işlevi korur.
- Son benchmark geçerli `STRMLY_PERF_RESULT` üretir; ölçülen sayfalarda eşik regresyonu oluşmaz ve hedef metrik baseline'a göre iyileşir ya da gereksiz sürekli compositor yükü somut olarak azaltılır.
- İlgili focused kontroller ile `npm run verify` çalıştırılır; önceden mevcut engeller yeni regresyonlardan ayrılır.
- Git diff yalnız task kapsamındaki yeni satırlarda kontrol edilir; mevcut kullanıcı değişiklikleri korunur.

## Test adimlari

1. `npm run test:performance` (baseline)
2. Hedefli ESLint/typecheck veya ilgili focused scriptler
3. `npm run test:regressions`
4. `npm run build`
5. `npm run test:performance` (sonuç)
6. `npm run verify`
7. `ackit doctor`
8. `ackit scan --ci`
9. Task kapsamındaki `git diff --check`

## Riskler

- Çalışma ağacı yoğun biçimde kirli; hedef dosyalar önceden kullanıcı değişiklikleri içeriyor. Yalnız dar hunks değiştirilecek, dosya geneli yeniden biçimlendirilmeyecek.
- Benchmark gerçek katalog hazır olmadan sonuç üretmeyebilir; `STRMLY_PERF_RESULT` yoksa sonuç başarılı sayılmayacak.
- Geniş `will-change`/`translate3d` kullanımı daha fazla compositor katmanı oluşturarak ters etki yapabilir; değişiklik ölçümle geri alınabilir tutulacak.
- Electron runtime sonucu, yalnız build/typecheck sonucundan ayrı değerlendirilecek.

## Geri alma plani

Task kapsamında eklenen her CSS/handler değişikliği ayrı küçük hunk olarak geri alınabilir. Veri migrasyonu ve sözleşme değişikliği olmadığı için ek veri geri alma adımı yoktur.

## Tamamlama notlari

Tamamlandı.

- İlk benchmark denemeleri boş temp profiliyle çalıştı (`0 film`, katalog scroll alanı 152 px). Kullanıcı geri bildirimiyle bu sonuçlar geçersiz sayıldı; başarı kanıtı olarak kullanılmadı.
- Kök neden 1: geliştirme verisi ignored `profiles` klasöründe bulunmasına rağmen performance modu sabit, boş temp `userData` kullanıyordu. Script artık her turda yerel `profiles` verisinden benzersiz temp snapshot alıyor, 1 MB altındaki/eksik playlist ile testi reddediyor, gerçek kaynak veriyi değiştirmiyor ve snapshot'ı `finally` içinde güvenli temp-path kontrolüyle siliyor.
- Kök neden 2: her rail içindeki tüm kartlara aynı anda `series-card-enter` transform/opacity animasyonu uygulanıyordu. Özellikle 45-103 kart render edildiğinde scroll sırasında çok sayıda compositor/animation işi oluşuyordu. Yalnız ilk iki rail'in ilk sekiz kartı giriş animasyonu alıyor; scroll ile sonradan açılan rail'ler animasyonsuz mount oluyor.
- Kök neden 3: `.premium-card`, `.app-wrapper`, liquid-glass satırları ve splash yüzeylerine topluca kalıcı `will-change`, `translate3d`, `perspective` uygulanıyordu. Bu geniş compositor zorlaması kaldırıldı; hedefli animasyon sınıfları korundu.
- Benchmark güncel rail düzeninde hem yatay hem dikey overflow yüzeylerini ölçüyor. Canlı TV/Sinema/Diziler için en az 1000 px scroll ve en az 20 render edilmiş kart zorunlu; boş veri artık testi geçemiyor.
- Benchmark tamamen offline: tek kullanımlık snapshot içindeki TMDB cache kullanılıyor; test modunda TMDB IPC ağ çağrıları ve eksik görsel auto-download kapalı. Normal uygulama davranışı değişmiyor.
- Dolu-data baseline (5 örnek, 1 warmup): Canlı TV scroll p95 30.5 ms / %39.17 missed frame; Sinema 25.8 ms / %10.83; Diziler 34.6 ms / %32.5. Render edilen kartlar sırasıyla 103/45/45, scroll alanı her sayfada 2400 px idi.
- Ara düzeltme yalnız ilk sekiz kartı animate ederek Canlı TV missed-frame oranını %8.33'e, Sinema'yı %5.83'e, Diziler'i %16.67'ye indirdi.
- PASS nihai production Electron benchmark (30 örnek, 2 warmup, dolu snapshot, offline): Canlı TV p95 8.9 ms / %0.83 missed frame; Sinema 8.3 ms / %0; Diziler 10.0 ms / %0. Scroll alanı her sayfada 2400 px; ölçüm sonunda render edilen kartlar 52/30/30. Navigation p95: Ana Sayfa 26.0 ms, Canlı TV 36.3 ms, Sinema 46.4 ms, Diziler 53.9 ms; tüm eşikler geçti.
- PASS: hedefli ESLint; `node --check` (`electron/main.js`, `electron/tmdb-service.js`, `electron/performance-benchmark.js`); `npm run typecheck`; `npm run test:security`; `npm run test:regressions`; production build.
- BLOCKED (önceden mevcut): `npm run verify`, `MainViewRouter.tsx` ve `SpotlightSearch.tsx` içindeki dört unused değer nedeniyle `typecheck:unused` adımında duruyor. Önceki handoff'taki üç adsız Spotlight düğmesi de ayrı a11y borcudur.
- BLOCKED (repository health): ACKit doctor/scan mevcut `.env`, eksik `SECURITY.md`/test yapısı ve public-release bulguları nedeniyle geçmiyor.
- Veri tabanı, profil şeması, auth/permission ve normal uygulama ağı davranışı değişmedi. Commit, push, tag veya release yapılmadı.
