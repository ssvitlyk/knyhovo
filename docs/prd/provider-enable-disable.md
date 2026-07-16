# PRD: Централізований enable/disable провайдерів (BookChef pause)

**Статус:** Затверджено (2026-07-16)

## 1. Проблема

Потрібно тимчасово вимкнути BookChef зі scrape pipeline, не видаляючи код і не
втрачаючи дані, з можливістю повернути інтеграцію без відновлення видаленого коду.

Провайдери сьогодні прописані вручну приблизно у 15 місцях (hardcoded масив у
`run-scrape.ts`, `ALL_PROVIDERS` у `refresh-health.ts`, `FETCHER_FACTORY`, мапи
слагів у `persist-listing.ts` тощо — див. дослідження нижче). Немає жодного
`enabled`-прапорця ні в `ProviderName`, ні в Prisma `Provider`, ні в окремому
конфіг-файлі. Єдиний існуючий фільтр — `--provider=<name>` (обмежує прогін
одним провайдером, не виключає жоден).

Наївне рішення (`if (provider === 'bookchef') return`) розкидане по коду —
відхилено явно в постановці задачі: потрібен один централізований механізм.

Ключовий ризик, знайдений при дослідженні: якщо BookChef просто перестане
скрейпитись, `refresh-health.ts`'s `no-successful-run` (critical) почне
хибно сигналити "down" для навмисно призупиненого провайдера — health-модель
сьогодні не розрізняє "заглушений" від "зламаний".

## 2. Рішення

### 2.1 Єдине джерело правди: `SCRAPE_DISABLED_PROVIDERS`

Новий модуль `packages/api/src/config/provider-filter.ts`. Назва навмисно не
`provider-toggle.ts` — модуль нічого не перемикає (немає стану, немає side
effect), він лише читає env і повертає чисту, детерміновану відповідь на
питання "які провайдери зараз дозволено запускати". `provider-filter`
точніше описує, що це саме фільтр над реєстром провайдерів, а не механізм
керування станом провайдера.

```ts
export function getDisabledProviders(env: NodeJS.ProcessEnv): ReadonlySet<ProviderName>
```

Парсить `SCRAPE_DISABLED_PROVIDERS` — comma-separated список `ProviderName`-слагів
(напр. `SCRAPE_DISABLED_PROVIDERS=bookchef`), консистентно з існуючим
`SCRAPE_`-префіксом інших scrape-related env vars (`SCRAPE_ENRICH_DESCRIPTIONS`,
`SCRAPE_HEARTBEAT_INTERVAL_SECONDS` тощо). Whitespace навколо елементів
обрізається. Невідомий слаг — hard error (той самий strict-validation
патерн, що й `parseModeArg`/`parseProviderArg`: тиша про typo тут гірша за
падіння). Відсутня змінна → порожній `Set`.

Це єдине місце, куди дивляться scrape-entrypoints і health-звіт. Реєстр
провайдерів (`ProviderName`, `run-scrape.ts`'s масив, `FETCHER_FACTORY` та
решта мап з дослідження) залишається без змін — `SCRAPE_DISABLED_PROVIDERS`
лише фільтрує, що з зареєстрованого реально запускається.

### 2.2 `run-scrape.ts` (і дзеркально `run-wishlist-refresh.ts`)

`--provider=<name>` більше не є прихованим способом обійти дизейбл — він
завжди підпорядкований `SCRAPE_DISABLED_PROVIDERS`. Явний override — окремий,
однозначно названий флаг `--force-provider=<name>`.

```ts
const disabled = getDisabledProviders(process.env);
const providerFilter = parseProviderArg(process.argv.slice(2), providers.map(p => p.name));
const forceProvider = parseForceProviderArg(process.argv.slice(2), providers.map(p => p.name));

if (providerFilter !== undefined && forceProvider !== undefined) {
  throw new Error('--provider and --force-provider are mutually exclusive');
}

let selectedProviders: ScraperProvider[];
if (forceProvider !== undefined) {
  // Явний override: запускає саме цей провайдер, навіть якщо він у SCRAPE_DISABLED_PROVIDERS.
  selectedProviders = providers.filter(p => p.name === forceProvider);
} else if (providerFilter !== undefined) {
  if (disabled.has(providerFilter)) {
    throw new Error(
      `Provider '${providerFilter}' is disabled via SCRAPE_DISABLED_PROVIDERS. ` +
      `Use --force-provider=${providerFilter} to run it explicitly.`,
    );
  }
  selectedProviders = providers.filter(p => p.name === providerFilter);
} else {
  // Стандартний прогін (cron або ручний без флагів): disabled пропускається мовчки.
  selectedProviders = providers.filter(p => !disabled.has(p.name));
}
```

- Без будь-якого флага (це і є cron, і це дефолтний ручний прогін) —
  вимкнені провайдери автоматично виключені зі списку, що передається в
  `runProductionScrape` → `runFullCatalogRefresh`. Отже вони не беруть участі
  ні у full, ні у incremental refresh, не створюють нових `ScrapeRun`, не
  займають час пайплайна — без жодних змін у `full-catalog.refresh.ts` чи
  `incremental-providers.ts`.
- `--provider=bookchef`, коли bookchef вимкнений, — **hard error** із
  підказкою використати `--force-provider=`, а не мовчазний запуск. Це
  прибирає "магічну" поведінку, коли той самий флаг, що й завжди, раптом
  означає щось інше залежно від стану env var.
- `--force-provider=bookchef` — єдиний, явно названий спосіб запустити
  вимкнений провайдер (для ручної перевірки під час паузи чи перед
  поверненням). Назва флага сама документує намір — не потрібно знати про
  побічний ефект `--provider=`.
- `--provider=` для provider, який не вимкнений, поводиться так само, як і
  раніше (без потреби у `--force-provider=`).
- Railway cron JSON-файли (`railway.scrape-catalog.json`,
  `railway.scrape-wishlist.json`) не змінюються — вимкнення відбувається
  через env var на рівні Railway-сервісу, а не через `startCommand`.

### 2.3 Startup logging

При старті `run-scrape.ts` і `run-wishlist-refresh.ts` лог-рядок містить:

- `requestedProvider` — значення `--provider=`/`--force-provider=` або `all`,
  якщо жоден флаг не заданий;
- `forced` — `true`, якщо провайдер запущено через `--force-provider=`
  (тобто в обхід дизейблу); інакше `false`;
- `enabledProviders` — фінальний список слагів, які реально будуть запущені;
- `disabledProviders` — вміст `SCRAPE_DISABLED_PROVIDERS` (порожній масив, якщо не задано);
- `activeProvidersCount` — `enabledProviders.length`, щоб з логів одразу було
  видно кількість провайдерів у прогоні без підрахунку вручну;
- `mode` — `full`/`incremental` (як і зараз);
- `triggeredBy` — `CRON`/`SYSTEM`/`MANUAL` (як і зараз).

Приклади:
- `run-scrape starting ... (requestedProvider=all, forced=false, enabledProviders=[yakaboo,vivat,book-ye,laboratory,knigoland,book-club], disabledProviders=[bookchef], activeProvidersCount=6, mode=full, triggeredBy=CRON)`.
- `run-scrape starting ... (requestedProvider=bookchef, forced=true, enabledProviders=[bookchef], disabledProviders=[bookchef], activeProvidersCount=1, mode=full, triggeredBy=MANUAL)`.

### 2.4 `refresh-health.ts` — новий статус `'disabled'`

- `RefreshHealthStatus` розширюється: `'healthy' | 'degraded' | 'down' | 'disabled'`.
- `getRefreshHealth()` читає `getDisabledProviders(process.env)` (проброшено
  як `deps?.disabledProviders` для тестованості, дефолт — реальний env).
- `deriveProviderHealth()` отримує `disabled: boolean`. Якщо `true` —
  жодна issue-перевірка не виконується (no-successful-run, stale-listings
  тощо не мають сенсу для навмисно вимкненого провайдера), `status =
  'disabled'`, `issues = []`. Дані про останній успішний прогін
  (`lastSuccessfulRunAt`, `totalListings` тощо) лишаються у відповіді —
  видимість "що було", просто без алертів.
- `deriveSummary()` виключає провайдерів зі статусом `'disabled'` з
  `degradedProviders`, зі перевірки `every(status === 'healthy')` та
  `every(status === 'down')` (вимкнений провайдер не тягне систему в
  `degraded`/`down`), але провайдер лишається в `providers[]` масиві —
  оператор бачить "bookchef: disabled", а не мовчазну відсутність рядка.
- `ALL_PROVIDERS` не змінюється (BookChef лишається в списку — це і є те,
  що дає health-репорту можливість показати `disabled` замість того, щоб
  провайдер просто зник з репорту).

### 2.5 Дані, що не чіпаються

- `provider_scrape_state` (watermarks для incremental) — не видаляється.
  При поверненні BookChef auto-escalation (`auto-escalation.ts`,
  `AUTO_FULL_STALE_DAYS = 10`) вже коректно форсує `full`-режим, якщо з
  останнього full-run пройшло >10 днів — існуючий safety-net без змін.
- `ProviderListing`, ціни, історія, canonical matches, genre-mapping seed —
  без змін. Це вже гарантовано тим, що дизейбл — це лише "не викликати
  `.scrape()`", решта пайплайна (persist, search, alerts, genres) не знає
  і не має знати про дизейбл-статус.
- Search/alerts продовжують показувати наявні BookChef-лістинги як є (жоден
  провайдер сьогодні не має auto-hide за staleness — це не змінюється цим
  PRD, лишається поза скоупом).

## 3. Тести (обов'язково)

1. `provider-filter.test.ts`: парсинг `SCRAPE_DISABLED_PROVIDERS` — порожньо/відсутнє
   → порожній `Set`; один слаг; кілька через кому з пробілами; невідомий
   слаг → throw.
2. `run-scrape-args`-рівень (або inline у `run-scrape.test.ts`):
   - без флагів вимкнений провайдер виключений зі списку;
   - `--provider=bookchef` при `SCRAPE_DISABLED_PROVIDERS=bookchef` —
     hard error з підказкою про `--force-provider=`;
   - `--force-provider=bookchef` при `SCRAPE_DISABLED_PROVIDERS=bookchef` —
     bookchef запускається (єдиний провайдер у `selectedProviders`);
   - одночасні `--provider=` і `--force-provider=` — hard error (mutually exclusive);
   - `--provider=<enabled-provider>` — поведінка як і раніше, без потреби у `--force-provider=`;
   - startup-лог містить `enabledProviders`/`disabledProviders`/`activeProvidersCount`/`forced`.
3. `refresh-health.test.ts`: вимкнений провайдер отримує `status: 'disabled'`,
   `issues: []`, не впливає на `summary.status`/`degradedProviders`;
   лишається присутнім у `providers[]`.
4. Regression: існуючі `run-scrape.test.ts`, `full-catalog.refresh.test.ts`,
   `production-runner.test.ts` — без `SCRAPE_DISABLED_PROVIDERS` поведінка
   незмінна (порожній `Set` — no-op).

## 4. Railway rollout checklist

Після мерджу, у такому порядку:

1. Deploy нового коду (без env var — behavior-preserving зміна).
2. Переконатися, що без `SCRAPE_DISABLED_PROVIDERS` поведінка повністю не
   змінилася (усі 7 провайдерів запускаються як і раніше, health без
   статусу `disabled`).
3. Виставити `SCRAPE_DISABLED_PROVIDERS=bookchef` в Railway env для
   catalog scrape cron і wishlist refresh cron сервісів.
4. Restart/Redeploy відповідних Railway services (щоб новий env
   підхопився — процес читає env один раз при старті).
5. Переконатися, що startup log містить `enabledProviders` (без bookchef)
   і `disabledProviders` (`[bookchef]`).
6. Запустити production smoke-test.
7. Переконатися, що BookChef не запускається (немає нового `ScrapeRun` з
   `provider=BOOKCHEF` після прогону).
8. Переконатися, що health endpoint показує `status=disabled` для bookchef.

## 5. Recovery checklist (повернення BookChef)

1. Прибрати `bookchef` зі `SCRAPE_DISABLED_PROVIDERS` (або видалити env
   var повністю, якщо це був єдиний елемент).
2. Restart Railway service(-ів), де env var змінювався.
3. Якщо `bookchef` ще лишається в `SCRAPE_DISABLED_PROVIDERS` на момент
   перевірки — запустити manual scrape через
   `--force-provider=bookchef`; якщо env var вже прибрано (крок 1) —
   достатньо звичайного `--provider=bookchef`. Мета обох варіантів
   однакова: перевірити інтеграцію ізольовано перед поверненням у
   загальний cron.
4. Переконатися, що auto-escalation спрацював як очікується (перший
   прогін після паузи >10 днів має піти `full`-режимом, не
   `incremental` — перевірити `ScrapeRun.metadata.mode`).
5. Перевірити health endpoint — `status` для bookchef більше не
   `disabled`, і немає несподіваних critical issues від першого прогону.
6. Лише після цього повернути bookchef у звичайний cron-прогін (тобто
   нічого додатково робити не треба — досить того, що env var прибрано;
   наступний cron-запуск вже підхопить bookchef автоматично).

## 6. Acceptance criteria

PRD вважається виконаним лише якщо:

- BookChef не виконує жодного network request, поки `bookchef` є в
  `SCRAPE_DISABLED_PROVIDERS`.
- Не створюється жоден `ScrapeRun` з `provider=BOOKCHEF` під час
  стандартного (cron або без `--provider=`) прогону.
- Wishlist refresh не звертається до BookChef під час стандартного прогону.
- Health endpoint показує `status=disabled` для bookchef.
- `summary.status`/`degradedProviders` не деградують через вимкнений
  bookchef (відсутність success-run для disabled-провайдера не вважається
  проблемою).
- Startup log показує `enabledProviders`, `disabledProviders`,
  `activeProvidersCount` і `forced`.
- `--provider=bookchef` (без `--force-provider=`), поки bookchef вимкнений,
  завершується hard error'ом, а не мовчазним запуском вимкненого
  провайдера.
- `--force-provider=bookchef` — єдиний спосіб явно запустити вимкнений
  провайдер вручну, і робить це коректно.
- Після видалення `SCRAPE_DISABLED_PROVIDERS` (або bookchef з нього)
  BookChef знову бере участь у scrape без жодної зміни коду.
- Весь існуючий pipeline інших провайдерів (yakaboo, vivat, book-ye,
  laboratory, knigoland, book-club) працює без змін — жодного
  регресу в full/incremental refresh, health, alerts.

## 7. Поза скоупом

- Auto-hide стейл-лістингів у search/alerts (не існує сьогодні для жодного
  провайдера; окремий PRD, якщо знадобиться).
- `active`/`blocked`/`disabled` state machine з
  `docs/research/provider-integration-strategy.md` (задизайнена для
  Cloudflare-заблокованих провайдерів, ширший скоуп) — цей PRD навмисно
  вужчий: лише voluntary pause через один env var, без окремого
  `DisabledProvider`-адаптера в `packages/scrapers`.
- Множинні провайдери в `SCRAPE_DISABLED_PROVIDERS` одночасно — механізм це
  підтримує (comma-separated), але сьогодні є лише один кандидат (BookChef).
