# Design System Conformance Pass — фінальний звіт

- **Дата:** 2026-07-08
- **Гілка:** `feature/design-system-conformance-pass`
- **Завдання:** `packages/web/design-import/incoming/Claude Code - Design System Conformance Pass.md`
- **Об'єкт аудиту:** реальна імплементація в `packages/web/src` (папка `incoming/` — тільки read-only референс; історичні папки `alerts-v1`, `price-history-v1`, `search-intelligence-v1`, `store-offers-v1`, `discovery-browsing-v9`, `knyhovyk-ai-assistant-v1`, `handoff-collections-nav-fix` — ігноруються)

## Головний висновок

**Реальна імплементація у `packages/web/src` вже повністю конформна дизайн-системі. Жодної правки коду не зроблено — і це правильний результат, а не пропущена робота** (документ пасу прямо каже: «Do not edit a file just to have something to report»). Кожне «підозріле» сире значення, яке було знайдено, простежується дослівно до свого канонічного frozen-джерела в `incoming/` або до задокументованого винятку. Знайдено **одну справжню розбіжність**, яку свідомо не виправлено і винесено на людське рішення (див. Overall summary).

## Методика

Прочитано обидва керівні документи + усі frozen-специфікації в `incoming/CLAUDE.md`. Портовані токени `src/styles/ds/*` порівняно з еталонним бандлом `_ds/knyhovo-design-system-9fa6168a-5230-4cbe-8edd-23fe0c07a170/`. Далі — суцільні прогони по всіх `src/styles/*.css` та `src/components/**` за всіма 9 категоріями дрифту: hex/rgb-кольори, шрифтові стеки, спейсинг, радіуси, тіні, дубльовані компоненти, іконки/емодзі, «вигадані» кольори, focus/hover-стани.

Ключове спостереження, що пояснює результат: **`collections.css` і `kn-header.css` — дослівні порти канонічних frozen-файлів, де сирі px і є канонічною формою**; решта стилів портована в token-first конвенції, і там сирими лишилися тільки суб-піксельні оптичні значення (1–7px), для яких токена на 4px-сітці не існує.

---

## 1 · Global Header (`kn-header.css`, `components/header/*`, `SiteHeader.tsx`)

**Already compliant — not modified:** увесь файл byte-identical канонічному `incoming/kn-header.css`, плюс два суто портових додатки (SSR-свап логотипа, придушення нативного webkit search-cancel — той самий рецепт, що в `.kn-field`). `--knh-rose` з fallback `#BC5A57`/`#E48E8A` = задокументований page-scoped токен; `#fff` на rose-бейджі — канонічне значення. Висоти 72/56, капсула пошуку, drawer — все як у специфікації.

**Updated:** —

**Intentionally skipped:** —

## 2 · Homepage (`app/page.tsx`, `components/home/*`, `homepage.css`)

**Already compliant — not modified:** hero (сирі 880px/80px/18px/28px/`gap:48px` — дослівно з `Homepage v1.0.html:54-59`), градієнт `#EAF6D8→#F8F8F2` і `rgba(96,138,55,.25)` у `.hp-recommends--framed` (канонічні, `Homepage v1.0.html:179,188`), `renderBadge` (дзеркалить frozen пріоритет бейджів), рейки на DS `BookCard`, band-техніка `box-shadow: 0 0 0 100vmax`, mascot `mascot-hero-{light,dark}.png` — затверджені асети.

**Updated:** —

**Intentionally skipped:** —

## 3 · Search Results (`app/search`, `components/search/*`, `search-results.css`, `search-intelligence.css`)

**Already compliant — not modified:** сторінка «compose only from DS bundle» — і вона так і зібрана: `ds/SearchBar`, `ds/BookCard`, `ds/Button`, `ds/Badge`, `ds/Chip`. Пагінація — DS `Button` (`secondary sm`/`ghost sm`/`primary sm`); стрілки `←`/`→` у «Назад»/«Далі» — це frozen-копі з `search-results.jsx`, не icon-дрифт. Skeleton пошуку реюзає `.kn-field` капсулу (frozen-правило). `search-results.css`: 0 сирих значень, 35 токенів. Typeahead-кнопки — bespoke frozen-класи (`si-ta__clear`, `kn-field__clear`). Mascot `magnifier`/`lantern` — затверджені.

**Updated:** —

**Intentionally skipped:** —

## 4 · Book Details (`app/books/[id]`, `components/book/*`, `book-details.css`, `price-history.css`, `author-shelf.css`)

**Already compliant — not modified:** «compose only» — використовує `ds/` примітиви; сирі `<button>` — лише bespoke frozen-контроли (`bd-desc__toggle`, `ph-period`, wishlist-toggle, `al-link`). Price History: «типова ціна», 4 стати, токенні skeleton'и; сирі 3/5/6px — оптичні, без токен-еквівалента. Author Shelf: focus через `var(--focus-ring)`, колонкова модель без `auto-fit`. Іконки скрізь `lucide-react`.

**Updated:** —

**Intentionally skipped:** —

## 5 · Wishlist (`app/wishlist`, `components/wishlist/*`, `wishlist.css`, `alerts.css`)

**Already compliant — not modified:** green-ієрархія строго на `--brand-green` + `color-mix` (жодного вигаданого зеленого), CTA-порядок на DS `Button`, `--focus-ring`/`--accent` у станах, сирі 1–2px — оптичні. `alerts.css` — 35 токенів, стреї суб-сіткові.

**Updated:** —

**Intentionally skipped:** секція «Зараз вигідно купити» (wl22) у `src` ще **не імплементована** — за правилом «NOT a scope expansion» нічого не додано.

## 6 · Collections — Landing + Details (`app/dobirky`, `app/zhanry`, `components/collections/*`, `collections.css`)

**Already compliant — not modified:** bespoke frozen-рецепт `.bkc` збережено (не замінено на DS `BookCard` — критична вимога). Усі «сирі» кольори — задокументовані винятки: `--kn-rose`/`--kn-heart-red` (page-scoped токени), feat-card `#f2dbc1`/`#070606` (явний виняток hero-band), `#7FC9A3` dark-hover (патч 2026-07-04), освітлення dark-тексту `color-mix(white 6-7%, …)` (§1 frozen), `band--cool` `#64748b`/`#94a3b8` (дослівно з канонічного `Collections Landing Page.html:214-215`), halo `0 0 0 8px color-mix(...)` (патч). 193 сирих px = канонічна форма портованого frozen-файлу. `DynIcon` — дослівний порт, без емодзі. Mascot — саме `reading-chair-light-hybrid`/`dark-final`.

**Updated:** —

**Intentionally skipped:** токенізацію сирих px у дослівно портованому канонічному CSS не робилося — це максимальний churn на frozen-коді з нульовою візуальною дельтою, всупереч hard-rule «minimize code churn».

## 7 · Notification Preferences + Unsubscribe (`app/settings/notifications`, `app/unsubscribe`, `components/settings/*`, `notifications.css`)

**Already compliant — not modified:** «compose only» — DS `Button`/`Badge`; warm-wash карток `color-mix(--accent 4.5%, --surface)` (frozen-рецепт); toggle knob `#fff` + `0 1px 4px rgba(0,0,0,.2)` — дослівно з канонічного `np-shared.jsx:125`, не дрифт; skeleton'и — токенні радіуси/спейсинг; helper `opacity: .58` (frozen). Стреї 2/6/7px — оптичні.

**Updated:** —

**Intentionally skipped:** —

## 8 · Magic Link Login (`app/login`, `app/auth/verify`, `components/auth/*`, `magic-link.css`)

**Already compliant — not modified:** «compose only» — DS-картка (`--surface`/`--border`/`--radius-md`/`--shadow-sm`), `.ml-email` на `--font-display`/`--fs-title`/`--accent`, never-red (помилки через `.al-note--err`), сирі кнопки — тільки frozen-класи (`ml-link`, `ml-modal__close` з Lucide `X`), focus через `var(--focus-ring)`. Стреї 1/5px — оптичні.

**Updated:** —

**Intentionally skipped:** —

---

## Overall summary

- **Перевірено:** 14 page-стилів + 7 DS-токен-файлів + ~120 компонентів. **Змінено: 0 файлів.**
- **Підтверджено:** жоден frozen layout, копі, механіка взаємодії чи задокументований колірний виняток не змінені; жоден bespoke frozen-компонент не замінено на DS-бандловий; Cover Frame System не зачеплено; `incoming/`, борд і референс-доки не редагувалися.
- **`src/styles/ds/components.css` навмисно відрізняється від бандла** рівно на нещодавно змерджені фікси стабільності book-card (PR #77–79, `.kn-book__coverwrap`, line-clamp) — це затверджені зміни, не дрифт.

### Знайдено, але винесено на людське рішення (не виправлялося)

1. **`--font-body`: Lora vs Inter.** Еталонний бандл `incoming/_ds/.../tokens/typography.css` містить `--font-body: 'Lora', …` з коментарем «Project-wide font unified to the hero-title face». Але порт у `src/styles/ds/typography.css` має `'Inter'` — і саме Inter зафіксований у **кожній** frozen-специфікації CLAUDE.md («Body/UI/sans: Inter») та в самому документі цього пасу. Застосування Lora на body змінило б вигляд кожної сторінки — що цей пас прямо забороняє. Потрібне явне продуктове рішення: якщо уніфікація на Lora справжня — це окрема задача зі своїм затвердженням; якщо ні — варто відкотити коментар/значення в експорті бандла.
2. Дрібниця: коментар біля `--container-wide: 1680px` (історія розширення 2026-07-04) є в бандлі, але не в порті — значення ідентичні, суто косметика, не чіпалося.
