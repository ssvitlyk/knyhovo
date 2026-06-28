# Nash Format Provider — Research Note

> **Тип:** Research note / PRD-stub (per-provider). **Статус:** **Deferred / Blocked** (2026-06-28,
> складено після live-recon). **Гілки/коду немає** — scraper не реалізується.
>
> **Правило проєкту:** код під Nash Format **не пишеться**. Цей документ фіксує результат recon і
> причину відкладення, а не план реалізації.

---

## 1. TL;DR

- **Що:** `nashformat.ua` (книжковий інтернет-магазин «Наш Формат», ~53k книг) розглядався як
  кандидат у Tier A провайдери.
- **Вердикт:** **Deferred / Blocked.** Сайт за **агресивним Cloudflare/WAF** — повертає **HTTP 403**
  на всі HTML-шляхи (homepage, каталог, сторінка товару, sitemap), крім `robots.txt`. Блок зберігається
  і для desktop-Chrome-UA, і для Googlebot-UA → це **блок на рівні IP-репутації + WAF**, не лише
  JS-challenge, який знімається браузером.
- **Наслідок:** провайдер **не вписується у політику Tier A MVP** (стабільний прямий доступ через
  `FetchHtmlFetcher` + SSR + sitemap/категорії + структуровані дані). Реальний HTML/JSON-LD/sitemap
  **не вдалося верифікувати** — джерело даних невідоме.

---

## 2. Recon (2026-06-28, live)

| Перевірка | Результат |
|-----------|-----------|
| `robots.txt` | **200 OK.** `server: cloudflare`. Блокує AI-краулерів (ClaudeBot, GPTBot, CCBot, Bytespider, Amazonbot, Applebot-Extended, Google-Extended, meta-externalagent, CloudflareBrowserRenderingCrawler). `Content-Signal: search=yes,ai-train=no`, `Allow: /` для `*`. **Жодної `Sitemap:` директиви.** |
| `GET /sitemap.xml` | **403.** Тіло = `Attention Required! \| Cloudflare`, `cdn-cgi/challenge`, `cf-ray` — Cloudflare **block page** (не XML). |
| `GET /` | **403** (Cloudflare block). |
| `GET /all-books` | **403.** |
| `GET /products/<slug>-<id>` | **403** (напр. `/products/paperova-tsarivna-704757`). |
| Chrome-UA + повні браузерні заголовки | **403** (block незмінний). |
| Googlebot-UA | **403** (block незмінний → не whitelisted за UA; ймовірно IP-репутація). |
| Продуктовий URL-патерн | `/products/<slug>-<id>` (числовий product id у кінці; видобуто з пошукових сніпетів). |
| Каталог | `/all-books`, `/catalog/<slug>` (напр. `/catalog/elektronni-knyzhky`, `/catalog/istoriia`). |
| SSR / JSON-LD / ISBN / sku / availability / breadcrumbs / canonical | **Не верифіковано** — усі сторінки заблоковані. SSR *ймовірний* (Google індексує назви/ціни/авторів), але структуру даних підтвердити неможливо. |

---

## 3. Причина відкладення

- **Cloudflare/WAF block (HTTP 403)** на product / sitemap / усіх HTML-шляхах, крім `robots.txt`.
- Block **не знімається** зміною User-Agent чи браузерних заголовків → не простий JS-challenge, а
  IP-репутація + WAF-правила.
- Отже, `FetchHtmlFetcher` (транспорт Tier A) проти live-сайту **гарантовано заблокований**, а
  структуру даних (JSON-LD `Book`/`Product`, ISBN, sku/mpn, ціна, наявність) **неможливо верифікувати**
  для побудови надійного парсера.

---

## 4. Що НЕ робимо

- **Scraper не пишемо** (немає верифікованого джерела даних і стабільного доступу).
- **Playwright / headless-браузер не додаємо** — поза політикою Tier A MVP.
- **Proxy / residential IP / будь-який anti-bot bypass не впроваджуємо** — свідоме рішення MVP.

> Політика: нові Tier A провайдери приймаються лише за стабільного прямого доступу. Магазини за
> Cloudflare/WAF переводяться у **deferred/blocked** і повертаються окремо.

---

## 5. Майбутній шлях (поза MVP)

- **Офіційний API / data feed / партнерський доступ** до Nash Format.
- **Офіційний запит** на whitelisting нашого crawler-IP/UA у Nash Format / їхньому Cloudflare.
- **Окрема anti-bot стратегія** (browser-context + residential proxy) — лише якщо й коли ухвалять
  загальне рішення про окремий трек для blocked-провайдерів (поза цим MVP).

---

## 6. Споріднені доки

- [bookchef-provider.md](./bookchef-provider.md), [laboratory-provider.md](./laboratory-provider.md)
  — реалізовані Tier A провайдери (sitemap + JSON-LD, `FetchHtmlFetcher`), еталон підходу.
- Наступний Tier A кандидат після recon — **Книголенд** (knigoland.com.ua): доступний без CF,
  sitemap-driven, JSON-LD `Product`+`Book` (клон пайплайну Laboratory).
