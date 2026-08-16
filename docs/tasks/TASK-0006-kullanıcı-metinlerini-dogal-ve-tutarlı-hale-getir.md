# TASK-0006: Kullanıcı metinlerini doğal ve tutarlı hale getir

## Amac

Strmly'nin Türkçe ve İngilizce kullanıcı metinlerindeki soyut, robotik ve eylemsiz dili kaldırmak; hata mesajlarını kullanıcıya ne olduğunu ve ne yapabileceğini söyleyen ortak bir katmandan geçirmek; dağınık metin sahipliğini azaltmak ve doğrulanmış çeviri hatalarını düzeltmek.

## Kapsam

- Profil, açılış, boş durum, öneri, ayar ve README metinlerini somutlaştırmak.
- Playlist, profil ve oynatıcı hata mesajlarını doğal ve eyleme dönük hale getirmek.
- Tekrarlanan ortak kullanıcı metinlerini çeviri sözlüğüne taşımak.
- Yanlış İngilizce "Previous Episode" etiketini düzeltmek.
- Metin tonu ve kritik çeviri eşleşmeleri için regresyon kontrolleri eklemek.

## Kapsam disi

- Görsel tasarım ve yerleşim değişiklikleri.
- IPTV, TMDB, oynatma veya profil iş kurallarını değiştirmek.
- Üçüncü bir dil eklemek.
- Commit, push, yayınlama veya release işlemleri.

## Etkilenen dosyalar

- `README.md`
- `src/utils/translations.ts`
- `src/utils/toastHelpers.tsx`
- `src/components/CinematicPlayer.tsx`
- `src/components/CreateProfileWizard.tsx`
- `src/components/FavoritesEmptyState.tsx`
- `src/components/FavoritesView.tsx`
- `src/components/HomeView.tsx`
- `src/components/ProfileScreen.tsx`
- `src/components/SettingsPanel.tsx`
- `src/components/SpotlightSearch.tsx`
- `src/hooks/usePlaylists.ts`
- `src/hooks/useProfiles.ts`
- `src/hooks/useCinematicPlayer.ts`
- `src/hooks/useDynamicIslandToast.ts`
- `src/hooks/usePlaybackNavigation.ts`
- `src/hooks/useAppProvider.ts`
- `src/hooks/cinematicPlayerHelpers.ts`
- `scripts/test-regressions.js`
- `docs/HANDOFF.md`

## Veri tabani etkisi

Yok. Kalıcı veri şeması veya kullanıcı verisi değişmeyecek.

## Guvenlik etkisi

Olumlu: kullanıcıya gösterilen hata metinlerinde ham teknik hata ayrıntılarının görünmesi azaltılacak. Loglama davranışı korunacak.

## Yetki/auth etkisi

Yok. Kimlik doğrulama ve izin akışları değişmeyecek.

## Lokalizasyon etkisi

Türkçe ve İngilizce metinler birlikte güncellenecek. Değişken içeren mesajlarda mevcut değerler korunacak.

## UX etkisi

Metinler daha kısa, somut ve eyleme dönük olacak. Başarı, ilerleme ve hata durumlarının anlamı değişmeyecek.

## Log/audit etkisi

Konsol logları korunacak. Yalnız kullanıcıya gösterilen metinler normalize edilecek.

## Kabul kriterleri

- Deneyim/dünya gibi soyut açılış ve profil metinleri somut işlemleri adlandırır.
- Ayar açıklamaları kontrolün etkisini doğrudan söyler.
- Bilinen profil, playlist ve oynatıcı hataları neyin başarısız olduğunu ve uygun bir sonraki adımı söyler.
- Ham `Hata: ${err.message}` / `Error: ${err.message}` kalıpları kullanıcı toast'larına doğrudan gönderilmez.
- Sonraki bölüm ipucunun Türkçe ve İngilizce etiketleri aynı anlamdadır.
- README'nin giriş cümlesi doğrudan ürün davranışını anlatır.
- Yasaklı no-ai-slop pazarlama sözcükleri kullanıcıya görünen metinlerde bulunmaz.
- Odaklı regresyon kontrolleri, TypeScript ve repository doğrulama kapısı çalıştırılır; önceden mevcut engeller ayrı raporlanır.

## Test adimlari

1. `npm run typecheck`
2. `npm run test:regressions`
3. `npm run lint`
4. no-ai-slop desenleri ve ham hata toast'ları için `rg` taraması
5. `npm run verify`
6. `ackit doctor`
7. `ackit scan --ci`
8. `git diff --check`

## Riskler

- Çalışma ağacı yoğun biçimde kirli; aynı dosyalarda kullanıcı değişiklikleri var. Yalnız hedef satırlar düzenlenecek ve mevcut davranış korunacak.
- Hata sınıflandırması fazla geniş olursa özgün mesaj kaybolabilir. Bilinmeyen mesajlar değiştirilmeden bırakılacak.
- Metin anahtarlarının yanlış kullanımı boş metin gösterebilir. TypeScript/build ve regresyon kontrolleriyle doğrulanacak.

## Geri alma plani

Bu task kapsamında eklenen metin anahtarları, mesaj normalizasyonu çağrıları ve hedef satır değişiklikleri dosya bazında geri alınabilir. Kullanıcının önceden var olan değişikliklerine dokunulmayacak.

## Tamamlama notlari

Tamamlandı.

- Soyut profil/açılış metinleri, retorik boş durum girişi, bürokratik ayar açıklamaları ve README giriş cümlesi doğrudan ve somut biçimde güncellendi.
- Uzun iki dilli kullanıcı metinleri `translations.ts` altında toplandı. Regresyon testi, 55 karakter ve üzerindeki yeni satır içi iki dilli metinleri AST üzerinden reddediyor; kapanış taraması `LONG_INLINE_LOCALIZATION_COUNT=0` verdi.
- `getFriendlyToastMessage` tüm Dynamic Island toast'larına bağlandı. Bilinen profil, playlist, oynatıcı, yedek ve indirme hataları sonraki adımı söylüyor; ham teknik ayrıntılar loglarda kalıyor.
- Sonraki bölüm İngilizce hover etiketi `Previous Episode` yerine `Next Episode` oldu.
- PASS: `npm run typecheck`
- PASS: `npm run test:migration`
- PASS: `npm run test:security`
- PASS: `npm run test:catalog`
- PASS: `npm run test:regressions`
- PASS: `npm run build`
- PASS: `npm run lint` (0 hata; görev öncesi 4 unused uyarısı sürüyor)
- PASS: no-ai-slop yasaklı sözcük/kalıp taraması
- PASS: ham `Hata:` / `Error:` toast taraması
- PASS: task kapsamındaki `git diff --check`
- BLOCKED: `npm run verify` ve `npm run typecheck:unused`; görev öncesi `MainViewRouter.tsx`/`SpotlightSearch.tsx` dört unused değer.
- BLOCKED: `npm run check:a11y`; görev öncesi `SpotlightSearch.tsx` üç adsız düğme.
- BLOCKED: `ackit doctor`, `ackit scan --ci`, `ackit redact-check --profile public-release`; görev öncesi `.env`, eksik repository sağlık dosyaları ve tarama bulguları.
- Veri tabanı, auth, izin, deployment ve release etkisi yok. Commit/push yapılmadı.
