# TASK-0013: Spotlight tıklanabilir kartlarını klavye erişimine aç

## Amac

Spotlight arama sonucunu, arama geçmişini ve son açılan medya kartlarını yalnızca fareyle değil klavyeyle de çalıştırmak; özel tıklama davranışını yerel düğme semantiğine taşımak.

## Kapsam

- Arama sonuç kartlarını `button` yapmak.
- Arama geçmişi seçme ve kaldırma eylemlerini iki ayrı düğme olarak düzenlemek.
- Son açılan medya kartında açma ve kaldırma eylemlerini iç içe düğme oluşturmadan ayırmak.
- Görsel düzeni ve mevcut davranışı korumak.

## Kapsam disi

- Arama algoritması, veri kaynakları ve sıralama davranışı.
- Spotlight tasarımının yeniden yapılması.
- Yeni test altyapısı veya performans benchmark değişikliği.

## Etkilenen dosyalar

- `src/components/SpotlightSearch.tsx`
- `docs/tasks/TASK-0013-spotlight-tıklanabilir-kartlarını-klavye-erisimine-ac.md`
- `docs/HANDOFF.md`

## Veri tabani etkisi

Yok.

## Guvenlik etkisi

Yok; veri akışı ve saklama davranışı değişmeyecek.

## Yetki/auth etkisi

Yok.

## Lokalizasyon etkisi

Yeni görünür metin yok. Erişilebilir adlar mevcut Türkçe/İngilizce içerikten üretilecek.

## UX etkisi

Kartlar Tab ile odaklanabilecek, Enter ve Space ile çalıştırılabilecek. Fare davranışı ve görünüm korunacak.

## Log/audit etkisi

Yok.

## Kabul kriterleri

- Tıklanabilir sonuç kartı yerel düğme semantiğine sahip.
- Arama geçmişindeki seçme ve kaldırma eylemleri iç içe etkileşimli öğe oluşturmuyor.
- Son açılan kartındaki açma ve kaldırma eylemleri ayrı düğmeler.
- Her yeni düğmenin erişilebilir adı var.
- Hedef lint, kullanılmayan kod kontrolü, erişilebilirlik kontrolü, regresyon testleri ve tam doğrulama geçiyor.

## Test adimlari

1. `npx eslint src/components/SpotlightSearch.tsx`
2. `npm run typecheck:unused`
3. `npm run check:a11y`
4. `npm run test:regressions`
5. `npm run verify`

## Riskler

- Düğmelerin varsayılan tarayıcı stilleri görünümü etkileyebilir.
- Son açılan kartındaki kaldırma düğmesinin katman sırası açma düğmesiyle çakışabilir.

## Geri alma plani

Yalnızca `SpotlightSearch.tsx` içindeki semantik öğe değişikliklerini geri al; diğer çalışma ağacı değişikliklerine dokunma.

## Tamamlama notlari

- Arama sonuç kartları erişilebilir adı olan yerel `button` öğelerine dönüştürüldü.
- Arama geçmişi kapsülü, seçim ve kaldırma için iç içe olmayan iki düğmeye ayrıldı.
- Son açılan medya kartı, medya açma düğmesi ve üst katmandaki ayrı kaldırma düğmesi olarak düzenlendi.
- Tab odağı ile Enter/Space aktivasyonu tarayıcının yerel düğme davranışı üzerinden sağlandı.
- PASS: hedefli ESLint, `typecheck:unused`, `check:a11y` (Spotlight 11 düğme, 7 `aria-label`, 0 adsız), regresyon testleri ve tam `npm run verify`.
- Commit, push veya release yapılmadı; mevcut kirli çalışma ağacı korundu.
