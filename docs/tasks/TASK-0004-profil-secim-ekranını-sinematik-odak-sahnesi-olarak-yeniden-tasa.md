# TASK-0004: Profil seçim ekranını sinematik odak sahnesi olarak yeniden tasarla

## Amac

Mevcut profil seçim ekranını; profil açma, düzenleme, oluşturma, sağ tık menüsü ve giriş hazırlık akışlarını koruyarak Strmly'ye özgü, sinematik ve klavye/D-pad odağı belirgin bir sahne olarak yeniden tasarlamak.

## Kapsam

- Marka işaretini ve profil yönetimi eylemini kenara hizalı sade bir üst araç çubuğunda toplamak.
- Başlık, profil kartları ve odak bilgisini tek bir görsel hiyerarşide birleştirmek.
- Odaktaki profili ölçülü büyütme, tema rengi odağı ve gerçek profil tercihleriyle belirginleştirmek.
- Profil ekleme kartını mevcut profillerle eşit kontrast ve etkileşim ağırlığına getirmek.
- Seçim ve yönetim modlarının metin ve görsel durumlarını ayrıştırmak.
- Mobil, dar masaüstü ve reduced-motion davranışlarını korumak.

## Kapsam disi

- Profil veri modeli, playlist kurulumu, Supabase senkronizasyonu veya IPTV kimlik bilgisi akışını değiştirmek.
- `CreateProfileWizard` ve profil düzenleme modalını yeniden tasarlamak.
- Otomatik başlangıç/splash yönlendirmesini değiştirmek.
- Commit, push, tag, yayın veya deployment yapmak.

## Etkilenen dosyalar

- `src/components/ProfileScreen.tsx`
- `src/utils/translations.ts`
- `docs/tasks/TASK-0004-profil-secim-ekranını-sinematik-odak-sahnesi-olarak-yeniden-tasa.md`
- `.hallmark/log.json`

## Veri tabani etkisi

None: Kalıcı veri veya şema değişmiyor.

## Guvenlik etkisi

None: Kimlik bilgisi, profil verisi veya ağ isteği eklenmiyor. ACKit'in önceden mevcut `.env`, lockfile ve release workflow bulguları kapsam dışıdır ve gizlenmeyecektir.

## Yetki/auth etkisi

None: Profil seçimi ve oturum yetkilendirme davranışı korunuyor.

## Lokalizasyon etkisi

Türkçe ve İngilizce profil seçim metinleri doğal, kısa karşılıklarla birlikte güncellenecek.

## UX etkisi

- Aktif profil fare, klavye ve D-pad ile aynı görsel odak durumunu kullanacak.
- Profil adları ve ekleme eylemi odak dışında da okunabilir kalacak.
- Yönetim modu, seçim modundan başlık ve kart rozetiyle ayrılacak.
- Hareket yalnızca `transform` ve `opacity` ile sınırlı tutulacak.

## Log/audit etkisi

None: Yeni telemetri veya uygulama logu eklenmiyor. Hallmark tasarım rotasyonu `.hallmark/log.json` içinde kaydedilecek.

## Kabul kriterleri

1. Logo sol üstte, profil yönetimi eylemi sağ üstte ve profil sahnesi ekranın optik merkezinde yer alır.
2. Odaktaki profil tema rengiyle görünür bir `focus-visible` durumu, kontrollü büyüme ve odak eylem rozeti gösterir.
3. Odak dışı profillerin isimleri okunabilir; profil görselleri hover sırasında agresif yakınlaşmaz.
4. "Profil ekle" eylemi devre dışı görünmez ve mevcut profil kartlarıyla tutarlı klavye odağı alır.
5. Seçim, yönetim, profil oluşturma, sağ tık ve profil giriş davranışları korunur.
6. Türkçe/İngilizce metinler pariteyi korur.
7. `npm run verify` başarıyla tamamlanır veya önceden mevcut kapsam dışı hata kanıtıyla kaydedilir.

## Test adimlari

1. `npm run typecheck`
2. `npm run check:a11y`
3. `npm run test:regressions`
4. `npm run verify`
5. Profil seçimi, yönetim modu, profil ekleme, klavye odağı ve dar ekran görsel QA'sı.
6. `git diff --check`
7. `ackit doctor` ve `ackit scan --ci`

## Riskler

- Profil ekranında önceden mevcut avatar fallback değişikliğiyle çakışma riski; mevcut fallback korunarak aynı render dalı üzerinde çalışılacak.
- Çok sayıda profilde yatay sıkışma; sarmalama ve dar ekran kart ölçüleriyle sınırlanacak.
- Yoğun blur/gölge performans maliyeti; tek ambient katman ve kontrollü gölgeler kullanılacak.

## Geri alma plani

Bu task tarafından eklenen `ProfileScreen.tsx` sunum değişiklikleri, çeviri anahtarları ve Hallmark kaydı ayrı diff olarak geri alınabilir. Önceden mevcut avatar fallback değişikliğine dokunulmayacak.

## Tamamlama notlari

- Hover odak düzeltmesi: `focusedProfileId === null`, "Profil Ekle" kartının kasıtlı odak durumu olduğu halde effect tarafından geçersiz sayılıp ilk profile geri döndürülüyordu. `null` yalnızca seçim modunda ve ekleme kartı görünürken geçerli kabul edildi; yönetim modunda geçerli profil odağı korunuyor.
- Profil seçim yüzeyi kenara hizalı marka/araç çubuğu, tek odaklı başlık ve 4:5 profil kartlarıyla yeniden kuruldu.
- Odaktaki profil runtime tema rengi, kontrollü yükselme ve varsa gerçek `contentPreferences` etiketleriyle ayrıştırıldı; agresif avatar zoom'u kaldırıldı.
- Önceden mevcut boş-avatar `UserRound` fallback'i korundu.
- "Profilleri Düzenle", "Bitti" ve "Profil Ekle" metinleri Türkçe/İngilizce pariteyle güncellendi.
- 1440×900 ve dar pencere ekran görüntüleriyle boş profil durumu incelendi; dar üst çubukta yönetim eylemi 44×44 ikon düğmesine indirildi. Headless Chrome'un 500 CSS px altı pencere minimumu nedeniyle 320/375/414 dosyaları gerçek cihaz emülasyonu değil; tam dar ekran kanıtı olarak kullanılmadı.
- `npm run typecheck`: PASS.
- `npm run test:regressions`: PASS.
- `npm run build`: PASS (1874 modül).
- `npm run verify`: BLOCKED; task kapsamı dışındaki `MainViewRouter.tsx` ve `SpotlightSearch.tsx` kullanılmayan değerleri `typecheck:unused` adımında durdurdu.
- `npm run check:a11y`: BLOCKED; kapsam dışı `SpotlightSearch.tsx` satır 505, 631 ve 684'te üç adsız düğme raporlandı.
- Global `git diff --check`: BLOCKED; önceden mevcut `AppOverlays.tsx` EOF ve `HomeView.tsx` trailing whitespace bulguları. Task dosyaları için scoped `git diff --check`: PASS.
- `ackit doctor` / `ackit scan --ci`: BLOCKED; önceden mevcut SECURITY/test yapısı eksikleri ve `.env` Critical redact bulgusu korunuyor.
- Commit, push, tag veya yayın yapılmadı.
