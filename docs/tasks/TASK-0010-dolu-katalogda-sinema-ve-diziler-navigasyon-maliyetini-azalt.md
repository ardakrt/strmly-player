# TASK-0010: Dolu katalogda Sinema ve Diziler navigasyon maliyetini azalt

## Amac

Dolu ve offline production Electron benchmark'ında Sinema ve Diziler sayfalarının tekrar navigasyon maliyetini, kart sayısını veya görünen içeriği azaltmadan düşürmek.

## Kapsam

- TASK-0009 ile doğrulanan dolu-profil benchmark'ını değişiklik öncesi ve sonrası çalıştırmak.
- Ağır katalog DOM ağacının sayfa girişinde transform/compositor maliyetini incelemek.
- Mevcut 380 ms giriş süresini koruyup geçişi opacity-only yapmak; tüm kart içeriğini aynı tutmak.
- Focused lint/typecheck/regresyon/security ve tam repository kapılarını çalıştırmak.

## Kapsam disi

- Kart/rail içeriğini azaltmak, katalog içeriğini erişilemez yapmak veya benchmark eşiklerini gevşetmek.
- Görsel tasarım, profil/IPTV verisi, TMDB sonuç politikası, bağımlılık veya release akışını değiştirmek.
- Büyük view-router refaktörü ya da sayfaları kalıcı olarak bellekte tutarak benchmark'ı yapay biçimde hızlandırmak.
- Önceden mevcut Spotlight/ACKit borçlarını bu task'a katmak.

## Etkilenen dosyalar

- `src/index.css`
- Gerekirse `scripts/test-regressions.js`
- `docs/tasks/TASK-0010-...md`
- `docs/HANDOFF.md`

## Veri tabani etkisi

Yok. Cache yalnız renderer belleğinde, oturum süresince tutulacak; IndexedDB veya profil şeması değişmeyecek.

## Guvenlik etkisi

Yeni ağ/IPC/dosya sistemi erişimi yok. Benchmark mevcut offline snapshot sınırını koruyacak; poster URL veya IPTV kimlik bilgisi loglanmayacak.

## Yetki/auth etkisi

Yok; profil ve kullanıcı yetkileri değişmeyecek.

## Lokalizasyon etkisi

Yok; kullanıcı metni değişmeyecek.

## UX etkisi

Kart görünümü, sayısı ve rail içeriği aynı kalacak. Sayfa 4 px dikey kayma yerine yalnız opacity ile girecek.

## Log/audit etkisi

Kalıcı log değişikliği yok. Yalnız toplu benchmark metrikleri task kanıtına yazılacak.

## Kabul kriterleri

- Değişiklik öncesi dolu, offline, 30 örnekli `STRMLY_PERF_RESULT` kaydedilir.
- Benchmark Canlı TV/Sinema/Dizilerde en az 1000 px scroll ve en az 20 render edilmiş kart şartını korur.
- Sinema ve/veya Diziler navigation p95 değeri baseline'a göre anlamlı biçimde düşer; scroll eşiklerinde regresyon olmaz.
- Dolu benchmark Sinema/Dizilerde 30 render edilmiş kartı korur.
- `.page-transition-enter` kalıcı transform layer istemez ve keyframe yalnız opacity değiştirir.
- Hedefli kontroller geçer; tam `npm run verify` sonucu önceden mevcut engellerden ayrılır.

## Test adimlari

1. `npm run test:performance` (dolu/offline baseline, 30 örnek)
2. Hedefli ESLint ve `npm run typecheck`
3. `npm run test:regressions` ve `npm run test:security`
4. `npm run test:performance` (dolu/offline sonuç, 30 örnek)
5. `npm run verify`
6. `ackit doctor`
7. `ackit scan --ci`
8. Task kapsamındaki `git diff --check`

## Riskler

- Çalışma ağacı yoğun biçimde kirli; `ImageWithFallback.tsx` önceden geniş kullanıcı değişiklikleri içeriyor. Yalnız dar cache hunk'ları değiştirilecek.
- Opacity-only geçiş görsel hareketi azaltır; süre/easing korunarak tasarım dili muhafaza edilecek.
- Navigasyon p95 iyileşmezse değişiklik geri alınacak.

## Geri alma plani

`pageEnter` içindeki iki transform satırı ve `will-change` değeri geri eklenebilir. Veri migrasyonu olmadığı için kalıcı veri geri alma gerekmiyor.

## Tamamlama notlari

Devam ediyor.

- Güncel baseline: Sinema navigation p95 47.4 ms, Diziler 60.1 ms; Diziler 60 ms eşiğini geçti. Scroll p95 7.7/8.2 ms ve missed-frame %0.
- Deneme 1 (geri alındı): URL bazlı letterbox canvas cache'i ilk turda iyileşme gösterdi ancak tekrar turunda Sinema 50.5 ms, Diziler 59.5 ms oldu; etkisi gürültüden ayrışmadı.
- Deneme 2 (geri alındı): sync TMDB sonucu varken async fast-path effect'ini atlamak Sinema 54.8 ms, Diziler 57.4 ms üretti; anlamlı ve tutarlı kabul edilmedi.
- Deneme 3 (geri alındı): rail başına ilk mount'u 10 kartla sınırlamak medianları düşürse de Sinema p95 51.0 ms, Diziler 55.6 ms oldu ve ölçülen kart sayısı 30'dan 20'ye düştü; dolu-yük karşılaştırmasını korumadığı için reddedildi.
- Deneme 4 (geri alındı): WeakMap grup indeksi turunda tüm sayfalar sekiz ardışık pass boyunca ~2002 ms timer sapmasına girdi; sonuç geçersizdi. Sapma dışı medianlar da baseline'dan anlamlı ayrışmadığı için cache tutulmadı.
- Deneme 5 (değerlendirme bekliyor): opacity-only geçiş ilk turda Sinema/Diziler medianını 34.3/39.7 ms'ye indirdi ancak Sinema p95 67 ms oldu. İkinci turda Ayarlar scroll frame'leri 1001 ms'ye sabitlenerek occlusion/timer throttle sapmasını doğruladı. CSS değişikliği geri alındı; karşılaştırma öncesi benchmark penceresi yalnız perf modunda always-on-top yapıldı.
- Always-on-top baseline üç dakikayı aşarak yine throttle'a girdi; pencere seçeneği geri alındı. Benchmark artık paint/scroll rAF beklemesi 250 ms'yi aşarsa açık `Frame timer throttled` hatasıyla erken duruyor; sahte 1-2 saniyelik frame örnekleri sonuç setine giremiyor.
- Son doğrulama: `npm run test:regressions` ve production build geçti; benchmark 26.6 saniyede `STRMLY_PERF_ERROR=Error: Frame timer throttled while waiting for paint (319.0ms)` ile güvenli biçimde durdu ve `STRMLY_PERF_RESULT` üretmedi. Bu nedenle uygulama optimizasyonu tamamlanmış sayılmıyor.
- Mevcut durum: Denenen letterbox cache, TMDB effect fast-path, rail mount penceresi, WeakMap grup indeksi, opacity-only geçiş ve always-on-top seçenekleri ya ölçümle doğrulanmadı ya da dolu-yük karşılaştırmasını değiştirdi; tamamı geri alındı. Üretim davranışında TASK-0010 kaynaklı değişiklik bırakılmadı.
- Kalan tek kod değişikliği benchmark timer-throttle guard'ıdır. Devam için Windows oturumu açık, ekran uyanık ve benchmark penceresi görünürken dolu/offline baseline yeniden alınmalıdır.
