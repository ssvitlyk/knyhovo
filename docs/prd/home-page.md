# PRD: Home Page v1.0

> Статус: Чорновик.
> Реалізація затвердженого дизайну **Homepage v1.0** (`packages/web/design-import/incoming/`) як production-ready головної сторінки. Дизайн — джерело істини для UI. Реалізується після затвердження цього PRD.

## Business Goals

- Дати Knyhovo справжню головну сторінку як **search-first landing / entry point** (зараз `/` лише redirect на `/search`).
- Провести користувача в основну воронку: приземлення → пошук (назва / автор / ISBN) → Результати → Деталі книги.
- Показати цінність продукту через discovery-полиці (Популярне, Новинки, добірка Книговика) без потреби у явному запиті.

## Контекст і проблема

- **Сьогодні** `/` рендерить `redirect('/search')` ([packages/web/src/app/page.tsx](../../packages/web/src/app/page.tsx)); окремої головної немає.
- **Дизайн уже затверджено й заморожено:** `Homepage v1.0` (Concept A — Oracle Search) — живий патерн [homepage.jsx](../../packages/web/design-import/incoming/homepage.jsx) + [Homepage - Pattern Spec.html](../../packages/web/design-import/incoming/Homepage%20-%20Pattern%20Spec.html). Складено виключно з frozen DS-компонентів; нового візуального словника не введено.
- **API не має** ендпоінтів для полиць (популярне / новинки / рекомендації), а `SearchItemDto` не віддає стару ціну, знижку чи бейдж «Новинка» — тобто бейджі дизайну неможливо взяти з `/api/search`.

## Зафіксовані рішення

- **Секції — строго за frozen spec §2/§6:** Hero → **Популярне зараз** → **Новинки** → **Knyhovo радить**. Кількість і порядок секцій заморожені. Блоку «Жанри» немає (не входить у затверджений дизайн).
- **Джерело даних (v1.0):** курований **статичний** контент-модуль у web-пакеті (як у frozen mock; обкладинки вже є в `design-import/incoming/assets/covers/`). Ізольований модуль = чистий seam для майбутньої заміни на API. **Без змін API/БД.**
- **Тільки web-PR.** Не чіпаємо auth, wishlist, settings, profile, notifications і не редизайнимо жодного frozen-патерну (Search Results, Book Details, Бажанки).
- **Design system:** заморожений DS v1.0 — джерело істини для токенів; класи `.hero`/`.hp-*` переносяться з `Homepage v1.0.html` (як свого часу `search-results.css`). Нових залежностей немає (не Tailwind/shadcn).

## Що робимо

**Сторінка та композиція (web):**
- `/` стає Server Component, що рендерить Hero + 3 полиці у замороженому порядку; хедер/футер успадковуються з root layout.
- **Hero** (client) — затверджений макет 50/50: eyebrow, h1 «Де книга дешевша? / *Knyhovo знає.*», лід, `SearchBar`, статистика (5+ · 12k+ · 24/7), популярні запити (`Chip`), Книговик (mascot-hero, theme-swap). Пошук/чип → `/search?q=…`.
- **Полиці** «Популярне зараз» і «Новинки» + framed-полиця «Knyhovo радить» (аватар Книговика, `--surface-accent`) — горизонтальні rail-и з **frozen** `BookCard` (компонент не змінюється; rail/вертикаль — лише page-level CSS).
- Курований статичний контент-модуль (`content.ts`) + helper бейджів (green «Найкраща ціна» / `-N%` solid / «Новинка» accent, max один на картку).
- Нова таблиця стилів `homepage.css` + підключення у `globals.css`; копіювання потрібних активів (mascot-hero, аватар, covers) у `public/`.
- Мінімальний header-wiring: «Головна»/лого ведуть на `/` (без зміни візуалу/складу навігації).

**SEO:**
- `metadata` для головної (унікальні `title`/`description`, `openGraph`, `twitter`, `canonical`).
- JSON-LD `WebSite` + `SearchAction` (sitelinks searchbox → `/search?q={query}`).

## Що НЕ робимо

- Блок «Жанри», журнальні/блогові макети, будь-який новий візуальний словник.
- Зміни API/БД, нові ендпоінти, реальні dynamic-полиці (майбутній seam через `content.ts`).
- Зміни auth / wishlist / settings / profile / notifications і редизайн frozen-патернів.
- Мобільне бургер-меню з дизайн-канви (реальний `SiteHeader` — свій, не чіпаємо його склад).

## Стани

- **Дані статичні** → runtime loading/error станів **не потрібно**.
- **Empty-shelf:** якщо масив полиці порожній — секція повністю ховається. Hero присутній завжди.
- Майбутнє (при переході полиць на API): додати skeletons (reuse `Skeletons.tsx`) + error boundary — поза scope v1.0.

## Респонсив / теми

- **≥901px:** hero 50/50, полиці — rail. **≤900px:** hero стекається (Книговик зверху). **<768px (вкл. 375):** 1 колонка, вертикальний `BookCard`, full-width `SearchBar`, 44px touch targets.
- Light/dark: токени флипаються через `data-theme`; лого/mascot/аватар — theme-swap через CSS.

## Acceptance Criteria

- `/` рендерить головну (не redirect): Hero + Популярне зараз + Новинки + Knyhovo радить — у замороженому порядку.
- Пошук у hero та клік по популярному чипу ведуть на `/search?q=…` з відповідними результатами.
- Бейджі відповідають frozen-ієрархії (Найкраща ціна → -N% → Новинка), max один на картку; ціна серіф-accent, стара ціна muted-strike, книгарня — `--text-muted`.
- Порожня полиця → секція схована; Hero завжди присутній.
- Обидві теми (light/dark) і брейкпоінти (desktop / ≤900 / 375) відповідають `Homepage v1.0.html`.
- Головна має унікальні `metadata` + валідний JSON-LD `WebSite`/`SearchAction`.
- `typecheck` / `lint` / `test` / `build` — зелено; покриття нових модулів ≥ 80%.
- Auth / wishlist / settings / notifications та їх тести лишаються незмінними й зеленими.

## Out of scope / майбутнє

- Динамічні полиці з реального API (популярність за вікном, поріг «новинки», алгоритмічна/кураторська добірка) — окремий API PRD.
- Персональні рекомендації (на основі wishlist / історії) — див. `ai-discovery.md`.
- Блок «Жанри» / каталог за категоріями — за потреби окремий дизайн + PRD.
