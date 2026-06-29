# Книгарня Є (book-ye) — Provider Recon

> **Тип:** research / recon. **Дата:** 2026-06-29. **Ціль:** `https://book-ye.com.ua`.
> **Питання дослідження:** чи існує легальне машинно-читане джерело (API / feed / structured data / sitemap) для інтеграції Книгарні Є як provider'а **без обходу anti-bot**.
> **Короткий висновок:** **Ні.** 🔴 **BLOCKED.** Сайт повністю за **Cloudflare Managed Challenge** на edge — challenge віддається на **все**, крім `/robots.txt`. HTML, sitemap, Magento GraphQL/REST, feed-шляхи — усі повертають HTTP 403 + `cf-mitigated: challenge` ("Just a moment..."). Жодного публічного machine-readable джерела не знайдено. **Tier C.** До PRD **не готовий** — потрібен офіційний партнерський feed/API.
> **Зв'язок:** slug `book-ye` вже зарезервовано (`Provider.BOOK_YE @map("book-ye")`, `ProviderName`). Узгоджується з попереднім recon ([bookstore-feasibility.md §Книгарня Є](bookstore-feasibility.md), [provider-integration-strategy.md §4](provider-integration-strategy.md)) і memory `book-ye-cloudflare-content-wait`. Стек **уточнено**: не Bitrix (як вважалося раніше), а **Magento 2**.

---

## 1. Architecture (як влаштований сайт)

| Аспект | Значення | Джерело |
|--------|----------|---------|
| Платформа | **Magento 2** (e-commerce) | заголовки `x-magento-cache-debug: HIT`, `x-magento-my-test` на `/robots.txt` |
| CDN / edge | **Cloudflare** (`server: cloudflare`, HTTP/2 + h3) | усі відповіді |
| Anti-bot | **Cloudflare Managed Challenge** (Turnstile/JS PoW) | `cf-mitigated: challenge`, `<title>Just a moment...</title>`, CSP з `challenges.cloudflare.com`, per-request `nonce-…` |
| URL-схема | path-based Magento URL rewrites: категорії `/khudozhnya-literatura/`, вкладені `/dytyacha-literatura/<sub>/<sub2>/<slug>/`, товар = повний шлях категорії + slug | WebSearch індекс |
| API (теоретично) | Magento дає вбудовані `/graphql` і `/rest/V1/*` — **існують, але за тим самим challenge** | проба нижче |
| Sitemap | задекларовано `https://book-ye.com.ua/media/sitemap/sitemap_index.xml` у robots | `/robots.txt` |
| Каталог (оцінка) | велика мережа; держпрограма «єКнига» згадує **50 000+** позицій (paper+ebook+foreign) | WebSearch |

**Раніше vs зараз:** попередній feasibility припускав «1C-Bitrix» через `PAGEN_*`/`SID=` у robots. Заголовки `x-magento-*` однозначно вказують на **Magento 2** — старі Bitrix-патерни в robots, ймовірно, legacy disallow-правила. На висновок (BLOCKED) це не впливає, але міняє теоретичний шлях інтеграції (Magento GraphQL замість Bitrix-парсингу).

## 2. Discovery — що було б доступне, якби не challenge

Перелічено для повноти; **жодне джерело не віддається** через Cloudflare:

- **sitemap** — `sitemap_index.xml` + дочірні (типовий шлях до повного переліку URL товарів). 403.
- **robots** — `Crawl-delay: 30`; disallow на `/admin_*`, `/customer/`, `/checkout/`, параметрах сортування/пагінації. **Єдиний доступний ресурс.**
- **category pages** — `/khudozhnya-literatura/`, `/elektronni-knyhy/`, вкладені дерева. 403.
- **новинки / топ** — `/novinki/`, `/top/` (потенційні discovery-індекси). 403.
- **search** — Magento catalogsearch / GraphQL `products(search:)`. 403.
- **pagination/filters** — Magento `?p=`, layered navigation; robots частково disallow PAGEN/SID. Недоступно.
- **paper-only filter** — Magento layered navigation за атрибутом формату/типу теоретично дозволив би серверний paper-фільтр. Недоступно для перевірки.

## 3. Endpoints — результати проб (2026-06-29)

Усі запити: realістичний Chrome UA, `Accept-Language: uk-UA`. Результат однаковий — edge-level challenge.

| Endpoint | HTTP | `cf-mitigated` | Примітка |
|----------|------|----------------|----------|
| `GET /robots.txt` | **200** | — | ✅ єдиний доступний; Magento-заголовки, `cf-cache-status: BYPASS` |
| `GET /` (homepage) | 403 | `challenge` | "Just a moment...", CSP+nonce |
| `GET /media/sitemap/sitemap_index.xml` | 403 | `challenge` | sitemap за challenge |
| `GET /sitemap.xml`, `/pub/sitemap.xml` | 403 | `challenge` | альт. шляхи теж |
| `GET /ua/catalog/` (category) | 403 | `challenge` | каталог за challenge |
| `GET /graphql?query={__typename}` | 403 | `challenge` | Magento GraphQL за challenge |
| `GET /rest/V1/store/storeViews` | 403 | `challenge` | Magento REST за challenge |
| `GET /rest/default/V1/store/storeConfigs` | 403 | `challenge` | те саме |
| `GET /feed.xml`, `/media/feed/google.xml` | 403 | `challenge` | feed-шляхи за challenge |

**Перехресні перевірки (усі підтверджують edge-блок):**
- **UA Googlebot** на category → 403 `challenge` (CF верифікує Googlebot за IP, спуф UA не проходить).
- **Без UA / curl-default** → 403.
- **WebFetch** (інша egress-інфраструктура/IP) на `/` і sitemap → **403** обидва. Тобто блок не прив'язаний до одного IP.
- **DNS субдомени** `api|mobile|m|app|backend.book-ye.com.ua` → **NXDOMAIN** (немає окремого API-хоста / мобільного backend).
- **TLS-сертифікат**: SAN = `book-ye.com.ua, *.book-ye.com.ua` (wildcard) — жодних натяків на alt-хости.

**Висновок §3:** challenge застосовано на рівні Cloudflare edge до **всього домену**, з єдиним whitelisted-винятком `/robots.txt`. Тип ресурсу (HTML / GraphQL / REST / XML feed / sitemap) значення не має. Окремого незахищеного API-хоста немає.

## 4. Mapping → RawProviderListing

**N/A на цьому етапі.** Джерело даних недоступне, тож мапінг неможливо ні спроєктувати, ні перевірити на реальних полях. Якщо/коли з'явиться офіційний feed/Magento-GraphQL-доступ:
- Magento GraphQL `products` дає `sku`, `name`, `price_range`, `image`, `url_key`, `stock_status` та кастомні атрибути (ISBN/author/publisher зазвичай як EAV-атрибути) — потенційно достатньо для повного `RawProviderListing` **без** окремого enrichment-запиту.
- ISBN у Magento книгарень типово зберігається як кастомний атрибут (`isbn`/`gtin`/`ean`) — потребує перевірки на реальній відповіді.
- Це **проєктувати передчасно** до отримання доступу.

## 5. Rate limits / anti-bot / cache

- **Anti-bot:** Cloudflare **Managed Challenge** — інтерактивний JS/Turnstile PoW. Це **не** простий UA/rate-фільтр; вимагає виконання браузерного челенджу. Обхід = порушення (і ToS, і технічно крихко) — **поза скоупом проєкту** (правило: не обходимо Turnstile/Managed Challenge).
- **robots:** `Crawl-delay: 30` — власник очікує ≤1 запит/30с навіть для дозволених краулерів; але CF challenge все одно блокує до того, як це стає релевантним.
- **Cache / batching / compression:** оцінити неможливо — реальні відповіді контенту не отримані. (Для `/robots.txt`: `cf-cache-status: BYPASS`, `no-store`.)
- **Playwright/headful:** теоретично Managed Challenge можна пройти headful-браузером, але це **Nearly impossible** для стабільного продакшну (Turnstile + Client Hints + TLS-fingerprint, перегони з оновленнями CF), Maintenance **Very High**. Не рекомендовано.

## 6. Benchmark

**N/A.** Немає доступного API/джерела для бенчмарку (немає successful-відповіді з даними). Бенчмарк стане можливим лише після офіційного feed/API-доступу.

## 7. Risks

| Ризик | Оцінка / мітигація |
|-------|--------------------|
| Cloudflare Managed Challenge на всьому домені | **Блокер №1.** Немає легального технічного обходу; єдиний шлях — офіційний доступ |
| Обхід Turnstile | Заборонено правилами проєкту + крихко + ToS-ризик → **не робимо** |
| Playwright headful як «рішення» | Very High maintenance, нестабільно, перегони з CF → не рекомендовано |
| Залежність від доброї волі власника | Партнерський feed/API залежить від перемовин; немає публічної affiliate-API-програми |
| Зміна стеку (Bitrix→Magento) | Уточнено цим recon; будь-який майбутній план будувати на Magento GraphQL, не на Bitrix |
| Невідома повнота полів | ISBN/author/publisher як Magento-атрибути — підтвердити лише на реальній відповіді |

## 8. Recommendation

- **Tier C.** 🔴 **BLOCKED** — не інтегрувати scrape-шляхом. Узгоджено з [provider-integration-strategy.md §4](provider-integration-strategy.md).
- **НЕ писати scraper.** Edge Managed Challenge робить будь-який HTTP/Playwright-підхід нелегальним та/або нестабільним.
- **Архітектура (якщо колись розблокується):** `FeedProvider` (партнерський XML/Google Merchant feed) **або** `ApiProvider` поверх Magento GraphQL — **не** HTML-scraper. Не плодити абстракції зараз (YAGNI): спроєктувати під конкретне підтверджене джерело.
- **Provider lifecycle зараз:** лишити `book-ye` як `disabled`/`blocked` у scrape-health (видимо для операторів, **не** у публічному search — гарантія з integration-strategy §5.3 зберігається). Не active.
- **Єдиний легальний трек:** офіційні перемовини про доступ до даних —
  - партнерська сторінка `book-ye.com.ua/partners`,
  - контакт мережі `+38 (044) 228 05 66`,
  - запит на product feed (Google Merchant / XML) або whitelisting нашого краулера в Cloudflare + Magento GraphQL read-доступ.
- **PRD-готовність:** ❌ **Не готовий.** PRD має сенс писати лише **після** підтвердженого джерела даних. Зараз PRD був би на гіпотетичному API.

## 9. Implementation notes

- **Production-код не писати, scraper не створювати** — recon-висновок негативний.
- Slug **`book-ye`** уже існує в `ProviderName` ([packages/shared/src/types/provider.ts](../../packages/shared/src/types/provider.ts)) і Prisma enum (`BOOK_YE @map("book-ye")`, [packages/api/prisma/schema.prisma:20](../../packages/api/prisma/schema.prisma#L20)) — **новий slug не створювати**.
- **Наступний крок (не код):** надіслати партнерський запит (за патерном Yakaboo-листа в [provider-integration-strategy.md §3.2](provider-integration-strategy.md)). Якщо отримаємо feed/GraphQL-доступ → окремий recon на реальних даних → PRD `docs/prd/ye-bookstore-provider.md` → імплементація як `FeedProvider`/`ApiProvider`.
- **Пріоритет реалізації:** після розблокованих провайдерів (Knigoland, BookClub та ін.). Книгарня Є — **не наступний** для коду; наступний крок по ній — комерційний/legal, не інженерний.

---

## Verification (команди для перепровірки)
```bash
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
# robots — єдиний доступний (200, Magento-заголовки):
curl -sI -A "$UA" https://book-ye.com.ua/robots.txt | grep -iE 'http|x-magento|cf-'
# усе інше — 403 + cf-mitigated: challenge:
for u in / /media/sitemap/sitemap_index.xml /graphql?query=%7B__typename%7D /rest/V1/store/storeViews; do
  curl -s -A "$UA" -o /dev/null -w "[%{http_code}] cf-mit=%header{cf-mitigated}  $u\n" "https://book-ye.com.ua$u"
done
# окремого API-хоста немає:
for h in api mobile m app backend; do dig +short "$h.book-ye.com.ua"; done   # NXDOMAIN
```
