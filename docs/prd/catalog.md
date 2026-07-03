# Catalog v1.0 — Curated Navigation Landing

Статус: Затверджено.

> Реалізація затвердженого дизайну **Collections Landing Page** («Добірки», `packages/web/design-import/incoming/Collections Landing Page.html`) як production-ready curated-навігаційної сторінки під маршрутом `/catalog`. Дизайн — джерело істини для UI. Реалізується після затвердження цього PRD.

## Business Goals

- Дати Knyhovo повноцінну **curated navigation landing** як окремий entry point — сьогодні пункт меню «Каталог» лише перекидає на `/search`.
- Провести користувача у воронку пошуку **без явного запиту**: приземлення → вибір жанру / автора / добірки → Результати пошуку.
- Показати ширину продукту (жанри, автори, редакційні та динамічні добірки) як SEO-friendly сторінку-навігацію, а не marketplace-фільтри чи новий search engine.

## Контекст і проблема

- **Сьогодні** nav-пункт «Каталог» у [SiteHeader.tsx](../../packages/web/src/components/SiteHeader.tsx) веде на `/search`; окремої curated-сторінки немає.
- **Дизайн уже затверджено:** `Collections Landing Page` («Добірки») — живий патерн [Collections Landing Page.html](../../packages/web/design-import/incoming/Collections%20Landing%20Page.html) + `Collections - Technical PRD.html` + `Collections - UX Strategy.html`. Складено виключно з frozen DS-компонентів; нового візуального словника не введено. Header/footer у дизайні — та сама заморожена interior-chrome, що вже реалізована в root layout.
- **API не має** ендпоінтів для добірок, а `?genre=` у `/api/search` не підтримується (лише `?q=`, `?page=`, `?exact=`). Detail-сторінок добірок (`/dobirky/<slug>`) не існує. Тобто клікабельні картки дизайну не мають реальних цільових сторінок — потрібен seam через пошук.

## Зафіксовані рішення

- **Маршрут — `/catalog`;** nav-пункт «Каталог» (зараз → `/search`) репойнтиться на `/catalog`. Склад і візуал навігації не змінюються; активним лишається «Каталог».
- **Секції — строго за frozen дизайном, у замороженому порядку:** Hero → **Featured** (редакційна картка) → **Актуальні добірки** (dynamic grid) → *divider* → **За жанром** (genre grid) → *divider* → **Curated** (editorial spotlight) → **Популярні автори** (author chips). Кількість і порядок секцій заморожені.
  - **Без Hero-SearchBar** — frozen дизайн його не має (Hero = eyebrow + h1 + лід). Пошук доступний із хедера/головної.
  - **Без окремої bottom-CTA секції** — це відхилення від початкового тексту PR; frozen дизайн не має CTA-блока, а Featured-картка вже несе дію «Переглянути →».
- **Джерело даних (v1.0):** курований **статичний** контент-модуль у web-пакеті (`content.ts`, за зразком `home/content.ts`). Ізольований модуль = чистий seam для майбутньої заміни на API. **Без змін API/БД.** Лічильники («147 книг») — курований статичний seed, не live.
- **Навігаційний контракт v1.0:** усі клікабельні картки (жанри, автори, dynamic-добірки, editorial, featured) ведуть на **`/search?q=<curated query>`**. Це seam: коли з'являться реальні collection-сторінки / `?genre=`, змінюється лише `href` у `content.ts`.
- **Тільки web-PR.** Не чіпаємо auth, wishlist, settings, profile, notifications, Search API, і не редизайнимо жоден frozen-патерн (Search Results, Book Details, Бажанки, Homepage).
- **Chrome успадковується:** SiteHeader / SiteFooter / `.page`-wrapper беруться з root layout — сторінка рендерить лише `<main>`. Header/footer/nav не відтворюються.
- **Тільки Server Components.** Catalog v1.0 складається виключно із Server Components — Client Components (`'use client'`) не використовуються. Навігація — лише через `next/link` (жодного `useRouter`/клієнтського навігейшену).
- **Design system:** заморожений DS v1.0 — джерело істини для токенів; класи `.col-hero`/`.sec-*`/`.feat-*`/`.dyn-*`/`.genre-*`/`.ed-*`/`.author-chip` переносяться з `Collections Landing Page.html` (як свого часу `homepage.css`). Нових залежностей немає (не Tailwind/shadcn).

## Що робимо

**Сторінка та композиція (web):**
- `/catalog` — Server Component, що рендерить секції у замороженому порядку. Клієнтського острівця не потрібно (немає hero-search; усі картки — статичні `next/link`).
- **Hero** (`.col-hero`): eyebrow (сумарний лічильник добірок/книг), h1 «Де знайти найкращу книгу? / *Knyhovo знає.*», лід.
- **Featured** (`.feat-card`): редакційна картка з cover-плейсхолдерами (gradient), заголовок, опис, лічильник, дія «Переглянути →».
- **Актуальні добірки** (`.dynamic-grid` / `.dyn-card`): grid динамічних добірок (Популярне зараз, Новинки, Найбільші знижки, Ціна знизилась, Найбільш бажані, Рекордна ціна) з іконкою, описом і статичним лічильником.
- **За жанром** (`.genre-grid` / `.genre-card`): grid жанрів (emoji + назва + лічильник) + «Усі жанри →».
- **Curated** (`.editorial-grid` / `.ed-card`): 3 редакційні картки (Книговик радить / Вибір редакції / Приховані скарби); аватар Книговика reuse наявного ассета.
- **Популярні автори** (`.authors-cloud` / `.author-chip`): хмара author-чипів + «Усі автори →».
- Курований статичний контент-модуль (`content.ts`) з типами `FeaturedCollection`, `DynamicCollection`, `Genre`, `EditorialItem`, `PopularAuthor` + helper `searchHref(query)`.
- Нова таблиця стилів `catalog.css` + підключення у `globals.css`; **без** копіювання header/footer/`.page` (вже існують).
- Мінімальний header-wiring: nav «Каталог» → `/catalog`.

**SEO:**
- `metadata` для каталогу (унікальні `title`/`description`, `openGraph`, `twitter`, `canonical` = `/catalog`).
- JSON-LD `CollectionPage` + `BreadcrumbList` (Головна → Каталог).

## Що НЕ робимо

- Hero-SearchBar, окрему bottom-CTA секцію, будь-який новий візуальний словник.
- Зміни API/БД, нові ендпоінти, `?genre=`, реальні collection detail-сторінки, live-лічильники (майбутній seam через `content.ts`).
- Зміни auth / wishlist / settings / profile / notifications, Search API, BookCard і редизайн frozen-патернів.
- Відтворення header/footer/навігації з дизайн-канви (реальні SiteHeader/SiteFooter — свої, не чіпаємо їх склад).

## Стани

- **Дані статичні** → runtime loading/error станів **не потрібно**.
- **Empty sections:** якщо масив будь-якої секції порожній — секція не рендериться (divider поруч теж). **Hero завжди присутній.**
- Майбутнє (при переході на API): skeletons + error boundary — поза scope v1.0.

## Респонсив / теми

- **≥1024px:** dynamic grid 3 колонки, genre grid 4, editorial 3. **≤1024px:** dynamic 2 / genre 3. **≤768px:** hero стекається, featured 1 колонка, dynamic 2 / genre 2, editorial 1, header-nav ховається (успадковано). **≤480px:** dynamic 2. Touch targets 44px.
- Light/dark: токени флипаються через `data-theme`; лого/аватар — theme-swap через CSS (успадковано).

## Acceptance Criteria

- `/catalog` рендерить curated landing: Hero → Featured → Актуальні добірки → За жанром → Curated → Популярні автори — у замороженому порядку, відповідно до `Collections Landing Page.html`.
- Клік по жанру / автору / добірці / featured веде на `/search?q=…` з відповідним запитом.
- Nav-пункт «Каталог» веде на `/catalog` (активний стан збережено); склад навігації незмінний.
- Порожня секція → секція (з divider) схована; Hero завжди присутній.
- Обидві теми (light/dark) і брейкпоінти (≥1024 / ≤1024 / ≤768 / 480) відповідають дизайну.
- Каталог має унікальні `metadata` + валідний JSON-LD `CollectionPage` + `BreadcrumbList`.
- `typecheck` / `lint` / `test` / `build` — зелено; покриття нових модулів ≥ 80%.
- Homepage / Search / wishlist / auth / settings / notifications та їх тести лишаються незмінними й зеленими.

## Out of scope / майбутнє

- Реальні collection detail-сторінки (`/dobirky/<slug>`), `?genre=` у пошуку, live-лічильники (популярність/новинки/знижки за вікном) — окремий API PRD.
- Персональні рекомендації (на основі wishlist / історії) — див. `ai-discovery.md`.
- Каталог-фільтри / marketplace-навігація за фасетами — за потреби окремий дизайн + PRD.
