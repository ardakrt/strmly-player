# TASK-0011: Arayüz odak altyapısını ve erişilebilirlik bulgularını düzelt

## Amac

Genel `.focusable-item` sinifini ve ona bagli uygulama-geneli spatial-navigation motorunu kaldirmak; arayuz denetiminde kullanici tarafindan secilen erisilebilirlik, metin, yerlesim ve tipografi bulgularini mevcut tasarim dilini bozmadan duzeltmek.

## Kapsam

- Tum renderer kaynaklarindan `focusable-item` sinifini ve ona ozel CSS secicilerini kaldirmak.
- `useAppBoot` icindeki genel spatial-navigation baslaticisini ve artik kullanilmayan yardimciyi kaldirmak.
- Spotlight modaline dialog semantigi, odak siniri, Escape kapanisi ve tetikleyiciye odak donusu eklemek.
- Spotlight gecmisindeki ikon-only silme kontrollerine yerellestirilmis ad ve yeterli hedef boyutu vermek.
- Home poster kartindaki ic ice interaktif kontrol yapisini ayirmak.
- Favori eylem adlarini gercek ekle/cikar durumuna gore yerellestirmek.
- Dar navbar icin gizli yatay icerigi belirten kenar ipucu eklemek.
- Navbar ve Spotlight icindeki 12 px altindaki kritik UI metinlerini okunabilir olcege cekmek.

## Kapsam disi

- Arama sonuc kartlarini native butonlara donusturen ayri pointer/keyboard bulgusu.
- Yeni tasarim sistemi veya yeni bagimlilik.
- Commit, push, release ve yayin islemleri.
- Kullaniciya ait profil, playlist veya IPTV verisi degisiklikleri.

## Etkilenen dosyalar

- `src/index.css`
- `src/hooks/useAppBoot.ts`
- `src/utils/spatialNavigation.ts` (kaldirilacak)
- `src/components/HomeView.tsx`
- `src/components/Navbar.tsx`
- `src/components/SpotlightSearch.tsx`
- `focusable-item` kullanan mevcut renderer bilesenleri
- `scripts/check-a11y-controls.js` (yalniz mevcut tarama davranisi gercek DOM adlarini yanlis siniflandiriyorsa)
- `docs/HANDOFF.md`
- Bu task belgesi

## Veri tabani etkisi

None: kalici veri semasi veya runtime veri formati degismiyor.

## Guvenlik etkisi

None: kimlik bilgisi, ag istegi, IPC veya izin yuzeyi degismiyor. Mevcut ACKit `.env` ve public-release bulgulari bu task disinda release-blocking kalir.

## Yetki/auth etkisi

None: profil yetkilendirmesi ve oturum akisi degismiyor.

## Lokalizasyon etkisi

Turkce ve Ingilizce favori/silme/modal adlari birlikte korunacak; hard-coded tek dilde erisilebilir ad birakilmayacak.

## UX etkisi

- Genel yapay odak sinifi ve global ok-tusu yakalama kaldirilacak.
- Native Tab davranisi korunacak.
- Spotlight modal odagi modal icinde kalacak ve kapanista onceki kontrole donecek.
- Gizli navbar icerigi dar genislikte kenar ipucuyla fark edilecek.
- Kritik kucuk etiketler en az 12 px olacak.

## Log/audit etkisi

None: yeni log veya telemetri eklenmiyor.

## Kabul kriterleri

1. `rg "focusable-item" src index.html` sonuc vermemeli.
2. `initSpatialNavigation` ve `spatialNavigation.ts` renderer calisma yolunda kalmamali.
3. Spotlight dialog semantigi, focus trap, Escape ve odak geri yukleme davranisina sahip olmali.
4. Spotlight gecmis silme kontrollerinin erisilebilir adlari ve en az 24x24 CSS px hedefleri olmali.
5. Home poster kartinda interaktif kontrol baska bir interaktif kontrolun icinde olmamali.
6. Favori eylem adlari mevcut duruma ve dile gore ekle/cikar sonucunu dogru bildirmeli.
7. Dar navbar yatay devam eden icerik icin gorunur kenar ipucu sunmali.
8. Hedef navbar/Spotlight metinleri 12 px altina dusmemeli.
9. Odakli kontroller ve `npm run verify` task kaynakli hata vermeden tamamlanmali.

## Test adimlari

1. `rg -n "focusable-item|initSpatialNavigation|spatialNavigation" src index.html`
2. Hedefli ESLint: degisen TS/TSX dosyalari.
3. `npm run check:a11y`
4. `npm run typecheck:unused`
5. `npm run verify`
6. Yerel tarayicida profil giris ekrani ve ulasilabiliyorsa Navbar/Spotlight; 320 px ve klavye odak akisi.
7. `git diff --check`, `ackit doctor`, `ackit scan --ci`.

## Riskler

- Global spatial-navigation kaldirilinca uzaktan kumanda/D-pad benzeri ozel ok-tusu davranisi artik bulunmayacak; native Tab ve bilesenlerin yerel klavye davranisi kalacak.
- Kirli agactaki ayni dosyalarda genis kullanici degisiklikleri var; yama yalniz ilgili satirlarla sinirli tutulmali.
- Modal odak yonetimi kapanma ve yeniden acilma sirasinda stale element referansi uretmemeli.

## Geri alma plani

Yalniz TASK-0011 kapsaminda degisen hunklar tersine uygulanir; mevcut kullanici degisiklikleri restore/reset/stash ile geri alinmaz.

## Tamamlama notlari

Devam ediyor. Baslangic kaniti: `ackit scan` mevcut `.env`/release bulgularini, `ackit doctor` repository-health eksiklerini raporladi; bunlar bu UI taskindan once mevcuttu. Calisma agaci yogun kirli ve korunuyor.
