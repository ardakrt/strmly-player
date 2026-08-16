# TASK-0014: ACKit proje entegrasyonunu kaldır

## Amac

AgentContextKit (ACKit) tarafından projeye eklenen aktif yapılandırma, beceri ve üretilmiş ajan bağlamlarını kaldırmak; uygulamanın çalışma ve doğrulama zincirini değiştirmemek.

## Kapsam

- `.ackit` proje yapılandırmasını kaldırmak.
- Projeye özel `ackit-first-development` becerisini kaldırmak.
- ACKit tarafından üretilmiş Codex, Claude, Anthropic, Copilot, Cursor ve Continue yönerge/context dosyalarını kaldırmak.
- ACKit tarafından üretilmiş genel workflow, geliştirme standardı ve proje haritası belgelerini kaldırmak.
- Kalan aktif dosyalarda ACKit entegrasyon referansı olmadığını doğrulamak.

## Kapsam disi

- Bilgisayarda kurulu global `ackit` .NET aracını kaldırmak.
- Geçmiş görev ve handoff kayıtlarındaki tarihsel ACKit doğrulama kanıtlarını yeniden yazmak.
- Uygulama kaynak kodunu, bağımlılıklarını veya kullanıcı verilerini değiştirmek.

## Etkilenen dosyalar

- `.ackit/config.yml`
- `.agents/skills/ackit-first-development/**`
- `AGENTS.md`, `CLAUDE.md`, `ANTHROPIC.md`
- `.codex/CONTEXT_PACK.md`, `.codex/HANDOFF.md`
- `.continue/config.json`, `.cursor/rules/project.mdc`
- `.github/copilot-instructions.md`
- `docs/AI_WORKFLOW.md`, `docs/DEVELOPMENT_STANDARD.md`, `docs/PROJECT_MAP.md`
- Bu görev kaydı ve `docs/HANDOFF.md`

## Veri tabani etkisi

Yok.

## Guvenlik etkisi

ACKit tarama entegrasyonu kaldırılır; uygulamanın güvenlik kodu ve secret dosyaları değiştirilmez. Mevcut `.env` commit edilmez veya içeriği okunmaz.

## Yetki/auth etkisi

Yok.

## Lokalizasyon etkisi

Yok.

## UX etkisi

Yok.

## Log/audit etkisi

Tarihsel görev ve handoff kayıtları korunur. Aktif ACKit context/rapor dosyaları kaldırılır.

## Kabul kriterleri

- `.ackit` ve projeye özel ACKit becerisi mevcut değil.
- ACKit tarafından üretilen ajan/config/context dosyaları mevcut değil.
- Paket manifestinde ACKit bağımlılığı veya scripti yok.
- Tarihsel kayıtlar dışındaki aktif proje yüzeylerinde ACKit referansı yok.
- `npm run verify` geçiyor.

## Test adimlari

1. ACKit yollarının artık bulunmadığını doğrula.
2. Aktif dosyalarda `ackit`, `ac-kit` ve `AgentContextKit` referanslarını tara; tarihsel kayıtları ayrı değerlendir.
3. `npm run verify`.
4. `git diff --check` ve hedefli `git status`.

## Riskler

- ACKit tarafından üretilmiş ama genel amaçla kullanılabilecek yönergeler de kaldırılır.
- Gelecekteki ajan oturumları ACKit preflight/task-first zorunluluğunu artık projeden almaz.

## Geri alma plani

Gerekirse ACKit yeniden açıkça benimsenerek yapılandırma ve ajan hedefleri güncel araçla yeniden üretilebilir; tarihsel dosyalardan eski üretilmiş içerik geri kopyalanmaz.

## Tamamlama notlari

- `.ackit` proje yapılandırması ve `.agents/skills/ackit-first-development` tamamen kaldırıldı.
- ACKit tarafından üretilen `AGENTS.md`, `CLAUDE.md`, `ANTHROPIC.md`, Codex context/handoff, Continue config, Cursor kuralı ve Copilot yönergesi kaldırıldı.
- Üretilmiş `AI_WORKFLOW.md`, `DEVELOPMENT_STANDARD.md` ve eski `PROJECT_MAP.md` kaldırıldı.
- Paket manifestinde ACKit bağımlılığı veya scripti olmadığı doğrulandı.
- Tarihsel görev/handoff kayıtları denetim geçmişini korumak amacıyla bırakıldı; aktif yüzey taramasında ACKit referansı bulunmadı.
- PASS: `npm run verify`; lint, unused typecheck, migration/security/catalog/regresyon testleri, erişilebilirlik kontrolü ve 1873 modüllü production build geçti.
- `git diff --check` proje genelindeki önceden mevcut `src/components/AppOverlays.tsx:75` EOF boş satırı nedeniyle 2 döndürdü; kapsam dışı kullanıcı değişikliğine dokunulmadı.
- Global `ackit` .NET aracı değiştirilmedi. Commit, push veya release yapılmadı.
