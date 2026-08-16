# TASK-0012: Spotlight ölü kodunu temizle ve doğrulama kapısını aç

## Amac

Spotlight arama yüzeyindeki kullanımı kanıtlanmamış state/hesaplamaları kaldırmak, gereksiz render tetiklerini azaltmak ve doğrulama zincirini bloklayan erişilebilir-ad eksiklerini düzeltmek.

## Kapsam

- `MainViewRouter.tsx` içindeki kullanılmayan `SpotlightSearch` import'unu kaldırmak.
- Değeri okunmayan `focusedResultIndex` ve `keyboardNav` state'lerini ve yalnız onları sıfırlayan effect'leri kaldırmak.
- Kullanılmayan `displayList` memo hesabını kaldırmak.
- Dinamik öneri, geçmişten kaldırma ve son açılanlardan kaldırma düğmelerine TR/EN erişilebilir ad eklemek.
- Spotlight worker araması, Esc kapatma, geçmiş kaydı, filtre scope'ları ve sonuç açma davranışını korumak.

## Kapsam disi

- Spotlight tasarımını veya arama algoritmasını yeniden yazmak.
- Klavye gezinme sözleşmesine yeni özellik eklemek.
- Performans benchmark TASK-0010'u bu task içinde tamamlamak.
- Repo genelindeki ACKit/security bulgularını topluca düzeltmek.

## Etkilenen dosyalar

- `src/components/MainViewRouter.tsx`
- `src/components/SpotlightSearch.tsx`
- Gerekirse `scripts/test-regressions.js`
- `docs/HANDOFF.md`

## Veri tabani etkisi

Yok; localStorage arama/geçmiş anahtarları ve formatı korunuyor.

## Guvenlik etkisi

Yok; ağ, IPC, dosya sistemi veya credential yüzeyi değişmiyor.

## Yetki/auth etkisi

Yok.

## Lokalizasyon etkisi

İkon-only kaldırma düğmelerine Türkçe/İngilizce dinamik `aria-label` eklenecek; görünür metin değişmeyecek.

## UX etkisi

Görsel değişiklik yok. Ekran okuyucu kullanıcıları öneri ve kaldırma eylemlerinin adını duyacak; gereksiz query/scope state reset render'ları kalkacak.

## Log/audit etkisi

Yok.

## Kabul kriterleri

- `typecheck:unused` Spotlight/MainViewRouter için hata üretmez.
- `check:a11y` üç Spotlight düğmesini adsız raporlamaz.
- Görünür öneri metni accessible name içinde aynen korunur.
- İkon-only düğmeler bağlamdaki terim/başlıkla açıklayıcı ad taşır; dekoratif ikonlar `aria-hidden` olur.
- `npm run verify` Spotlight kaynaklı blocker olmadan tamamlanır veya yalnız task öncesi unrelated blocker'lar raporlanır.
- Spotlight arama, Esc ve geçmiş regresyon kontrolleri geçer.

## Test adimlari

1. Hedefli ESLint (`MainViewRouter.tsx`, `SpotlightSearch.tsx`)
2. `npm run typecheck:unused`
3. `npm run check:a11y`
4. `npm run test:regressions`
5. `npm run verify`
6. `ackit doctor`
7. `ackit scan --ci`
8. Task kapsamındaki `git diff --check`

## Riskler

- `SpotlightSearch.tsx` yoğun kullanıcı değişiklikleri içeriyor; yalnız doğrulanmış unused satırlar ve üç düğme attribute'u değiştirilecek.
- Eski state adları gelecekte yarım kalmış klavye gezinme taslağı olabilir; güncel dosyada hiçbir değer okunmadığı ve keyboard effect yalnız Esc/Enter kullandığı doğrulandı.
- Dinamik aria-label metni görünür öneri adını değiştirmemeli; öneri düğmesinde label doğrudan `suggestion` olacak.

## Geri alma plani

Import/state/memo satırları ve üç aria attribute'u ayrı küçük hunks olarak geri eklenebilir. Veri migrasyonu yoktur.

## Tamamlama notlari

Tamamlandı.

- Kök neden: `focusedResultIndex` ve `keyboardNav` değerleri hiç okunmuyor, fakat Spotlight kapanışında ve her query/scope değişiminde setter'ları çağrılarak boş React state güncellemeleri oluşturuyordu. `displayList` memo sonucu da hiçbir render yolunda tüketilmiyordu. `MainViewRouter` içindeki `SpotlightSearch` import'u kullanılmıyordu; gerçek mount `AppOverlays` tarafından yapılıyor.
- İki state, iki reset effect'i, kullanılmayan memo ve import kaldırıldı. Worker araması, Esc/Enter handler'ı, geçmiş storage anahtarları ve sonuç seçim sözleşmesi korunuyor.
- Autocomplete önerisi kendi görünür metniyle accessible name aldı. Arama geçmişinden ve son açılanlardan kaldırma düğmeleri bağlamdaki terim/başlığı içeren TR/EN `aria-label` aldı; X/Trash/Search ikonları dekoratif işaretlendi.
- PASS: hedefli ESLint.
- PASS: `npm run typecheck:unused`.
- PASS: `npm run check:a11y`; `SpotlightSearch.tsx: buttons=8 aria-label_attrs=4 unlabeled=0`.
- PASS: `npm run test:regressions`.
- PASS: tam `npm run verify`; lint, unused typecheck, migration, security, catalog, regression, a11y ve production build zincirinin tamamı geçti.
- Veri, migration, auth, IPC, ağ ve deployment etkisi yok. Commit/push/release yapılmadı.
