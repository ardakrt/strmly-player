# Canlı TV "Channel Deck" Yeniden Tasarım Spesifikasyonu

## Genel Bakış

Canlı TV sayfası, mevcut "yönetim paneli" benzeri düzeninden (sol sidebar + düz liste + sağ önizleme paneli) kurtarılıp, uygulamanın sinematik tasarım diliyle (glass-morphism, full-bleed scroll, raflar) uyumlu ama **Canlı TV'ye özel** bir kompozisyonla sıfırdan tasarlanıyor. Kabuk (shell) etkileşim dili Diziler/Filmler sayfasıyla aynı; içerik kompozisyonu kanal odaklı: üstte "Son İzlenenler" + "Favoriler" rafları, altta kategori rafları, "Tümünü Gör" ile sanallaştırılmış ızgara.

## Kullanıcı Kararları (Brainstorming Çıktısı)

- İzleme davranışı: sabit kanallar — favoriler ve son izlenenler en üstte, tek tıkla oynatma.
- Üst bölüm: hero yok; iki kompakt yatay raf (Son İzlenenler + Favoriler).
- Keşif: kategori rafları (Netflix stili), "Tümünü Gör" → o kategorinin ızgarası.
- Sağ önizleme paneli: kaldırıldı; hover/focus bilgisi kartın üzerinde.
- Yaklaşım: **A — Channel Deck**.

## 1. Shell ve Üst Bar

Mevcut [SeriesView](file:///c:/Users/ardak/OneDrive/Masaüstü/premium-iptv-player/src/components/series/SeriesView.tsx) kabuğu birebir referans alınır:

- Kök: `relative flex h-full min-h-0 flex-1 flex-col overflow-hidden page-transition-enter`.
- Scrollport: `<section className="hide-scrollbar relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-8">` — pencerenin en üstünden başlar, içerik şeffaf navbar'ın altından akarak kayar.
- Header **statik geometri** (SeriesView'deki gibi `pt-[5.75rem]`, grid `grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]`); collapse animasyonu YOK (collapse, scroll sırasında flicker ürettiği için SeriesView'de terk edildi).
- Özel DOM scrollbar: `SeriesScrollbar` (targetRef = scrollport) aynen yeniden kullanılır.
- Header sol: tek kategori/ızgara modunda "← Geri Dön" butonu; showcase modunda mikro etiket "CANLI TV" + başlık ("Tüm Kanallar").
- Header orta (toolbar): "Kategoriler" drawer butonu (`SlidersHorizontal`), kanal arama inputu (temizle X'li), sayaç pili (`AnimatedTicker` + "kanal").
- **Vitrin/Izgara anahtarı YOK** — ızgaraya yalnızca "Tümünü Gör", drawer seçimi veya arama ile girilir.

## 2. Kategori Drawer'ı

- Yeni `LiveCategoryDrawer` bileşeni: `src/components/live/LiveCategoryDrawer.tsx`. [SeriesCategoryDrawer](file:///c:/Users/ardak/OneDrive/Masaüstü/premium-iptv-player/src/components/series/SeriesCategoryDrawer.tsx) ile aynı yapı ve etkileşim dili; scrollport'un dışında (kök div'in sibling'i).
- İçerik: kategori arama, Düzenle modu (sürükle-bırak sıralama, favori, gizle), "Favoriler" bölümü, "Diğerleri" bölümü, "Daha fazla" limiti.
- Veri: mevcut `liveCat` yöneticisi + `liveFavCatsToShow` + `categorySearchQuery` + `visibleLiveCategoryLimit` props'ları aynen korunur. Platform logo sınıflandırması YOK (canlı kategorileri platform bazlı değil).
- Drawer'dan kategori seçimi → `setActiveLiveCategory(cat)` → ızgara modu.

## 3. Raflar (Showcase Modu)

`activeLiveCategory === 'Tümü'` ve arama boşken render edilir. Raf sırası:

1. **Son İzlenenler** — `recentlyWatched` listesinin `type === 'live'` öğeleri; boşsa raf gizlenir.
2. **Favoriler** — `allLiveItems`'in `globalFavorites` setiyle filtrelenmesi (katalog sırası korunur); boşsa gizlenir.
3. **Favori kategori rafları** — `liveFavCatsToShow` sırasıyla.
4. **Diğer kategori rafları** — `liveCat.filteredOtherCategories` sırasıyla, `visibleLiveCategoryLimit` kadar.

Kurallar:

- Yeni `LiveRail` bileşeni: `src/components/live/LiveRail.tsx`; [SeriesRail](file:///c:/Users/ardak/OneDrive/Masaüstü/premium-iptv-player/src/components/series/SeriesRail.tsx) ile aynı iskelet: başlık (mikro etiket stili), `railArrowClass` ok butonları, `hide-scrollbar` yatay kaydırma, `React.memo`.
- Kategori başlıkları metin olarak render edilir (logo/rozet yok).
- Raf başına kanal limiti: `MAX_ROW_ITEMS = 30`; fazlası için başlıkta "Tümünü Gör" → `setActiveLiveCategory(category)` (ızgara modu).
- Gruplama: tek geçişli `Map<group, PlaylistItem[]>` (SeriesView `seriesByGroup` deseni), memoize. Kategori birleştirme/merge-key YOK (canlıda birebir grup adları).
- `rowEntries` SeriesView'deki gibi memoize edilip render başına yeni dizi üretimi önlenir (React.memo korunur).

## 4. Izgara Modu

`searching || activeLiveCategory !== 'Tümü'` iken render edilir:

- `VirtualizedGrid` + `LiveChannelTile`; SeriesView `renderGrid` ile aynı scroll-reveal: `series-card-enter` sınıfı + `(index % 7) * 40ms` stagger.
- Arama: toolbar inputu `allLiveItems` üzerinde isim filtresi uygular.
- Header'da "← Geri Dön" → `setActiveLiveCategory('Tümü')`.

## 5. Kanal Tile'ı (LiveChannelTile)

Yeni bileşen: `src/components/live/LiveChannelTile.tsx`. Canlı TV sayfasında eski `LiveChannelCard` ve `LiveChannelGridCard`'ın yerini alır; `LiveChannelGridCard` silinir, `LiveChannelCard` FavoritesView için taşınır (aşağıdaki not).

- Geometri: `aspect-video`, `rounded-2xl`, `border-white/[0.06]`, `bg-neutral-900/40`; raf içinde sabit genişlik `w-52`, ızgarada `VirtualizedGrid` kolonlarına akar.
- Logo: ortalanmış `object-contain`, `ImageWithFallback` ile (lazy, decoding async — flaş/flicker yok, Netflix kalite standardı); logo yoksa/hata durumunda `Tv` ikonu.
- İsim: altta kalıcı gradient bilgi bandında **her zaman görünür**; logo eksik, yanlış veya tanınmaz olsa da kanal seçilebilir kalır. `aria-label` her zaman kanal adını taşır.
- Rozetler: sol üstte kalite (`getQualityBadge`: 4K/FHD/HD/SD); sağ üstte çevrimiçi/çevrimdışı noktası (yalnızca `checkedStatusMap` girdisi varsa, emerald/red).
- Hover/focus: hover'da `translateY(-2px)` lift ve beyaz parlama; `focus-visible` durumunda daha güçlü çerçeve, düşük ölçek ve derin gölge. Reduced-motion tercihinde focus ölçeği kaldırılır. Favori kalp butonu hover/focus'da belirir (`stopPropagation` ile toggle).
- Etkileşim: tık → `handlePlayStream`; Enter/Space aynı; sağ tık → `MediaCardContextMenu` (onPlay + onToggleFavorite); `focusable-item` + `tabIndex={0}` (kumanda/klavye navigasyonu).
- Yardımcılar: `getQualityBadge` ve `cleanChannelName` mevcut [LiveTvView](file:///c:/Users/ardak/OneDrive/Masaüstü/premium-iptv-player/src/components/LiveTvView.tsx) içinden `src/components/live/channelHelpers.ts` dosyasına taşınır.
- **Not (FavoritesView):** Eski `LiveChannelCard`, [FavoritesView](file:///c:/Users/ardak/OneDrive/Masaüstü/premium-iptv-player/src/components/FavoritesView.tsx) tarafından da kullanılır. SeriesCard emsalinde olduğu gibi `LiveChannelCard` `src/components/live/LiveChannelCard.tsx` dosyasına taşınır ve FavoritesView yeni import yoluyla kullanmaya devam eder; FavoritesView'in kendisi yeniden tasarlanmaz (kapsam dışı). `LiveChannelGridCard` ise tamamen silinir.

## 6. Veri Akışı / Props Sözleşmesi

`useAppProvider` → `MainViewRouter` → `LiveTvView`:

- **Yeni prop** `allLiveItems: PlaylistItem[]` — aktif kategoriden bağımsız tam canlı katalog (`items` içinden `type === 'live' || type === undefined` filtresi, provider'da memoize).
- **Yeni prop** `recentlyWatched: PlaylistItem[]` — zaten provider'da mevcut.
- Korunan props: `liveCat`, `liveFavCatsToShow`, `categorySearchQuery/setCategorySearchQuery`, `visibleLiveCategoryLimit/setVisibleLiveCategoryLimit`, `activeLiveCategory/setActiveLiveCategory`, `checkedStatusMap`, `globalFavorites`, `toggleFavorite`, `handlePlayStream`, `handleMainScroll`, `setVisibleCount`.
- **Kaldırılan prop**: `filteredDisplayItems` (gruplama `allLiveItems`'ten türetilir).

## 7. Korunan / Kaldırılan

Korunan: tek tık oynatma, favoriler, sağ tık menüsü, çevrimiçi durumu, kategori düzenleme (drawer içinde), TR/EN çeviriler, merkezlenmiş boş durumlar, `focusable-item` uzamsal navigasyon, özel scrollbar, `page-transition-enter`.

Kaldırılan: sol kategori sidebar'ı, liste/ızgara görünüm anahtarı, sağ önizleme paneli, `LiveChannelGridCard`, `chunkedDisplayItems` mantığı, `strmly_livetv_viewmode` / `strmly_livetv_preview_collapsed` localStorage anahtarları. (`LiveChannelCard` silinmez, `live/` klasörüne taşınır — bkz. Bölüm 5.)

## 8. Performans

- Tüm handler'lar `useCallback` ile stabil (React.memo zincirini korur).
- `rowEntries`/`seriesByGroup` benzeri memoize tek geçiş gruplama; render başına dizi üretimi yok.
- Raflar 30 tile ile sınırlı; logo görselleri lazy.
- Izgara modu `VirtualizedGrid` ile sanallaştırılmış.

## 9. i18n (TR/EN)

Yeni etiketler: "Son İzlenenler / Recently Watched", "Tümünü Gör / View All", "Geri Dön / Go Back", "kanal / channels", "Kanal ara… / Search channels…", boş durumlar ("Kanal bulunamadı / No channels found", arama boş durumu). Mevcut `t()` anahtarları (favoriler vb.) yeniden kullanılır.

## 10. Test Planı

- `npm run build` + lint hatasız.
- Manuel: Canlı TV açılışında raflar (son izlenenler + favoriler + kategoriler) render olur; hover lift/glow + isim overlay; ok butonları kaydırma; "Tümünü Gör" → ızgara + stagger; Geri Dön; drawer aç/kapat + düzenle modu (sürükle, favori, gizle); arama → ızgara filtresi; favori toggle (tile + menü); sağ tık menüsü; oynatma; boş durumlar merkezli; klavye ile focus gezinme.
- Mevcut regresyon araçları: `scripts/check-a11y-controls.js`, `scripts/test-regressions.js` çalıştırılır.

## Varsayımlar

- EPG/program verisi yok — tasarım kanal merkezlidir.
- Kanal logoları hatalı/boş olabilir — `ImageWithFallback` + `Tv` ikonu fallback'i yeterlidir.
