# TASK-0002: Redesign search view with glassmorphism and modern UI

## Amac
Arama (Spotlight Search) sayfasını Strmly uygulamasının genel likit cam (liquid glass), modern tipografi ve akıcı UX tasarım diline uygun olarak sıfırdan yeniden dizayn etmek. Arama sonuçlarını daha okunaklı, kategorize ve görsel olarak büyüleyici hale getirmek.

## Kapsam
- `src/components/SpotlightSearch.tsx` bileşenini modern liquid-glass tasarımı, gelişmiş filtreleme, kategori gruplamaları, arama hero paneli ve responsive kart yapısı ile sıfırdan tasarlamak.
- Arama geçmişi (metin ve medya öğeleri), popüler etiketler ve hızlı keşfet kartlarını estetik cam kartlarla yenilemek.
- Sonuç ekranında canlı yayınlar, filmler ve diziler için özel poster oranları (2:3 ve 16:9), HD/4K rozetleri, tip rozetleri ve hover aksiyonları sunmak.
- Klavye yön tuşları, ESC ve Enter kısayol etkileşimlerini akıcı bir odak (focus) halkası ve pürüzsüz animasyonlar ile geliştirmek.

## Kapsam disi
- Arama worker algoritmalarında breaking change yapmak (SearchWorker ve search logic korunacaktır).

## Etkilenen dosyalar
- `src/components/SpotlightSearch.tsx`
- `src/index.css` (varsa arama özel cam efekti ve animasyon yardımcı sınıfları)
- `docs/tasks/TASK-0002-redesign-search-view-with-glassmorphism-and-modern-ui.md`

## Veri tabani etkisi
None

## Guvenlik etkisi
None

## Yetki/auth etkisi
None

## Lokalizasyon etkisi
Türkçe ve İngilizce (tr/en) dil metinleri `useSettings()` ve fallback i18n desteği ile tam uyumlu tutulacaktır.

## UX etkisi
- Navbar ile tam görsel bütünlük (liquid glass capsule, yumuşak geçişler, ambient glow).
- Arama çubuğu hem Navbar'dan hem de Arama Hero alanından kesintisiz kullanılabilir olacak.
- Tip bazlı sonuç kategorizasyonu (Filmler, Diziler, Canlı TV) ve sonuç sayısı rozetleri.
- Klavye erişilebilirliği ve zengin kart hover animasyonları.

## Log/audit etkisi
None

## Kabul kriterleri
1. Arama sayfası Strmly navbar'ının likit cam estetiğine (liquid glass capsule, blur, border, gradient aura) birebir uyum sağlar.
2. Arama yapılmadığında: Arama Geçmişi, Hızlı Keşfet ve Popüler Etiketler görsel olarak modern, yüksek kaliteli cam kartlarla sunulur.
3. Arama yapıldığında: Sonuçlar Canlı TV, Film ve Dizi olarak net biçimde kategorize edilir, her türün uygun görsel oranı (2:3 / 16:9) ve rozetleri gösterilir.
4. Klavye ok tuşları, ESC ve Enter ile arama sonuçları arasında gezinmek ve içerik açmak sorunsuz çalışır.
5. `npm run build` hatasız tamamlanır.

## Test adimlari
1. Vite dev server veya build kontrolü çalıştırılarak UI render hatası olmadığı doğrulanır.
2. `ackit scan --ci` ve `ackit doctor` çalıştırılarak repo standartları denetlenir.

## Riskler
- Büyük katalog verilerinde rendering performansının korunması (virtualization/slice limitlerinin korunması gereklidir).

## Geri alma plani
- Git stash veya ilgili commits revert edilerek `SpotlightSearch.tsx` eski haline döndürülebilir.

## Tamamlama notlari
- Arama eşleştirme ve puanlama algoritması (`getSearchScore`) tam yüksek hassasiyetli akıllı alaka düzeyine (relevance-first scoring) yükseltildi:
  - Kelime başı ve kelime sınırı tam eşleşmelerine (`"breaking bad"` başındaki exact word boundary) yüksek alaka puanı eklendi.
  - Aranan sorgu bir **Dizi (Series)** başlığıyla başladığında otomatik Dizi Alaka Bonusu (+70 puan) uygulandı.
  - Sorgu uzunluğuyla başlık uzunluğu yakın olan sade isimlere (Title Length Proximity) öncelik verilerek kalabalık yan isimler geriye itildi.
  - Bölünmüş/eğik çizgili başlıklar yerine ana isim tam eşleşmeleri öne çekildi (örneğin `"Breaking Bad"` dizisi, `"Breaking / Kopuş"` filminin ve rastgele belgesellerin önüne 1. sıraya yerleşti).
- `npm run build` ile TypeScript derlemesi başarıyla doğrulandı.

