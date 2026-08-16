# TASK-0003: Canlı TV Channel Deck kullanılabilirlik yenilemesi

## Amac

Canlı TV sayfasındaki mevcut Channel Deck çalışmasını, kanal seçimini hızlandıran ve uzaktan kumanda/klavye odağını görünür kılan üretime hazır bir deneyim olarak tamamlamak.

## Kapsam

- Kanal adını logo kalitesinden ve hover durumundan bağımsız olarak her kartta sürekli göstermek.
- Kanal kartlarına global focus sıfırlamalarından etkilenmeyen, belirgin bir `focus-visible` durumu eklemek.
- Mevcut Son İzlenenler, Favoriler, kategori rafları, kategori drawer'ı, arama ve sanallaştırılmış ızgara davranışlarını korumak.
- Tasarım spesifikasyonunu uygulanan erişilebilir davranışla eşitlemek.
- Kategori drawer'ı açıldığında tam ekran backdrop'un odak çerçevesi üretip sayfayı kare içine alıyormuş gibi göstermesini engellemek.

## Kapsam disi

- EPG/program verisi eklemek veya gerçek olmayan yayın bilgisi üretmek.
- Oynatıcı, profil, playlist veya TMDB veri akışını değiştirmek.
- Mevcut çalışma alanındaki diğer kullanıcı değişikliklerini düzenlemek.
- Commit, push, tag, yayın veya deployment yapmak.

## Etkilenen dosyalar

- `src/components/live/LiveChannelTile.tsx`
- `src/components/live/LiveCategoryDrawer.tsx`
- `src/components/AppShell.tsx`
- `src/index.css`
- `docs/superpowers/specs/2026-08-08-live-tv-channel-deck-design.md`
- `docs/tasks/TASK-0003-canlı-tv-channel-deck-kullanılabilirlik-yenilemesi.md`

## Veri tabani etkisi

None: Veri modeli veya kalıcı depolama değişmiyor.

## Guvenlik etkisi

None: Kimlik bilgileri, URL'ler veya harici servis sözleşmeleri değişmiyor. ACKit'in önceden mevcut `.env`, lockfile ve release workflow bulguları bu görevin kapsamı dışındadır ve gizlenmeyecektir.

## Yetki/auth etkisi

None: Profil ve oturum davranışı değişmiyor.

## Lokalizasyon etkisi

Yeni metin yok; mevcut Türkçe/İngilizce kanal ve eylem etiketleri korunuyor.

## UX etkisi

- Kanal adı her durumda okunur olacak.
- Fare, klavye ve D-pad odağı aynı kart üzerinde tutarlı görsel geri bildirim verecek.
- Favori, kalite ve yalnızca ölçülmüş çevrimiçi/çevrimdışı durumu korunacak.

## Log/audit etkisi

None: Yeni log veya telemetri eklenmiyor.

## Kabul kriterleri

1. Canlı kanal adı hover/focus olmadan görünür.
2. Kanal kartı `focus-visible` olduğunda belirgin çerçeve, gölge ve hafif yükselme gösterir.
3. Hover ve reduced-motion durumları kontrollü çalışır; otomatik kayan içerik eklenmez.
4. Kart Enter/Space ile oynatmayı, favori düğmesi ve sağ tık menüsünü korur.
5. Son İzlenenler/Favoriler/kategori rafları, arama, drawer ve sanallaştırılmış ızgara gerilemez.
6. `npm run verify` başarıyla tamamlanır veya önceden mevcut kapsam dışı hata açıkça kaydedilir.
7. Kategori drawer'ı açıldığında yalnızca panelin sol ayırıcısı görünür; backdrop tüm içerik alanını çevreleyen border/outline üretmez.
8. Canlı TV, Filmler ve Diziler ile aynı full-bleed katalog kabuğunu kullanır; dış shell üst/yan padding eklemez ve içerik kaydırıldığında navbarın arkasından görünür.

## Test adimlari

1. `npm run typecheck`
2. `npm run test:regressions`
3. `npm run check:a11y`
4. `npm run verify`
5. Electron uygulamasında gerçek Canlı TV verisiyle kanal adı, hover, focus, arama, raf ve oynatma akışlarının görsel QA'sı.
6. `git diff --check`
7. `ackit doctor` ve `ackit scan --ci`

## Riskler

- Sürekli metin bandı çok küçük kanal logolarının alanını azaltabilir; bant kartın alt kısmında sınırlı ve degrade tutulur.
- Focus ölçeği komşu karta yaklaşabilir; düşük ölçek ve yüksek `z-index` ile taşma kontrollü tutulur.
- Çalışma alanı zaten yoğun biçimde kirli; doğrulama sonuçları görev öncesi değişikliklerden etkilenebilir.

## Geri alma plani

Yalnızca bu görevdeki `live-channel-tile` sınıfı, sürekli isim bandı ve spesifikasyon satırları geri alınır. Diğer mevcut kullanıcı değişikliklerine dokunulmaz.

## Tamamlama notlari

- Uygulama tamamlandı: kanal adı kalıcı bilgi bandına taşındı, favori düğmesine `aria-pressed` eklendi ve `live-channel-tile` için global focus sıfırlamasını aşan scoped `focus-visible` stili tanımlandı.
- Gerçek Electron kataloğunda (586 kanal) görsel QA yapıldı: raflar ve kalıcı kanal adları render oldu; klavye odağı kart üzerinde çerçeve/gölge ve favori eylemini görünür yaptı; `TRT` araması ızgara moduna geçti; kategori drawer'ı açılıp kapandı; uygulama tekrar ana Canlı TV raf durumuna bırakıldı.
- PASS: `npm run typecheck`, `npm run test:migration`, `npm run test:security`, `npm run test:catalog`, `npm run test:regressions`, `npm run build`.
- BLOCKED (önceden mevcut, kapsam dışı): `npm run check:a11y`, `SpotlightSearch.tsx` içindeki 3 adsız düğme nedeniyle başarısız.
- BLOCKED (önceden mevcut, kapsam dışı): `npm run verify`, `MainViewRouter.tsx` ve `SpotlightSearch.tsx` içindeki 4 kullanılmayan tanım nedeniyle `typecheck:unused` aşamasında durdu.
- BLOCKED (önceden mevcut, kapsam dışı): `git diff --check`, `AppOverlays.tsx` EOF boş satırı ve `HomeView.tsx` trailing whitespace bulguları nedeniyle başarısız; görev kapsamındaki dosyalarda yeni whitespace hatası yok.
- BLOCKED (repository health): `ackit doctor`, `ackit scan --ci` ve `ackit redact-check --profile public-release`; `.env` Critical redact riski, release workflow/lockfile tarama bulguları ve eksik repository health belgeleri/test dizini raporlandı. Bulgular değiştirilmedi veya bastırılmadı.
- Commit, push, tag, release ve deployment yapılmadı; kullanıcı çalışma alanındaki diğer değişiklikler korundu.
- Görsel takip düzeltmesi: backdrop tam ekran `<button>` olduğu için focus/outline üretebiliyor, ayrıca düz `bg-black/45` + blur katmanı içerik alanında sert dikdörtgen bir karartma sınırı oluşturuyordu. Backdrop odaklanmayan dekoratif tıklama yüzeyine çevrildi ve karartma panele doğru yumuşakça koyulaşan gradientsiz-kutu hissi veren bir geçişe dönüştürüldü; drawer içindeki gerçek Kapat düğmesi erişilebilir kontrol olarak korunuyor.
- Takip düzeltmesi gerçek Electron penceresinde görsel olarak doğrulandı: drawer açıldığında içerik alanının çevresindeki sert karartma kutusu kayboldu, yalnızca sağ panele doğru yumuşak geçiş ve panelin kendi sol ayırıcısı kaldı. Drawer test sonunda kapatıldı.
- Takip düzeltmesi sonrası PASS: `npm run typecheck`, `npm run test:regressions`, `npm run build`.
- Katalog kabuğu takip düzeltmesi: `AppShell`, full-bleed koşulunu yalnızca Filmler/Diziler için uyguladığı için Canlı TV'ye dışarıdan navbar yüksekliği ve yan padding ekliyordu. Canlı TV aynı full-bleed koşuluna alındı; böylece ayrı kutu görünümü kalktı ve içerik navbarın arkasından akmaya başladı.
- Full-bleed takip düzeltmesi Electron başlangıç görünümünde doğrulandı: Canlı TV dış shell boşlukları olmadan pencere kenarlarına yayıldı ve Filmler/Diziler ile aynı scrollport/navbar katman sözleşmesini kullanıyor. Windows ekran yakalama sırasında öndeki Discord penceresi scroll pikselini örttüğü için bu ikinci kare görsel kanıt olarak kullanılmadı.
- Full-bleed takip düzeltmesi sonrası PASS: `npm run typecheck`, `npm run test:regressions`, `npm run build`.
