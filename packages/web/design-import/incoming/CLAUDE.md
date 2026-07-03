# Knyhovo — project notes for Claude sessions

## Frozen pattern: Knyhovo Collections Landing v1.0 · «Добірки» · /dobirky · 2026-07-02

> **"Collections Landing v1.0 — APPROVED & FROZEN. Implementation source of truth for the «Добірки» page. Do not redesign; bug fixes + backend integration only. It must read as a natural continuation of the existing Knyhovo product, not a separately-designed page."**

- **File:** `Collections Landing Page.html` (single self-contained React/Babel page; light + dark via `data-theme`, responsive). Composes only `window.KnyhovoDesignSystem_9fa616` (`SearchBar`, `BookCard`, `Badge`, `Chip`, `Button`, `ThemeToggle`) + DS v1.0 tokens. No new visual language, colors, type, radii, or shadows.

### Page structure (frozen)
- **No hero heading** — the page opens directly with the featured **«Книговик радить»** block. Order: Featured → **«Актуальні добірки»** (Щодня оновлюється grid) → divider → **«За жанром»** (Навігація) → divider → **«Популярні автори»** (Авторські добірки) → footer.
- The old editorial **«Curated / Редакційне»** three-card spotlight section is **removed** — do not reintroduce it.

### Featured «Книговик радить» block (FINAL — pixel-identical to v1.0, do NOT touch)
- Grid `[mascot] [title+desc] [count + CTA]`, `background: #f2dbc1` (light — matches the mascot's own paper scene) / `#0a0909` (dark — matches the dark scene), `height: 204px` (= the «Актуальні добірки» card height) on desktop, `height:auto` on mobile (≤768px). `overflow:hidden` desktop only.
- Mascot = approved reading-chair PNG (`assets/mascot/mascot-reading-chair-light-hybrid.png` / `-dark-final.png`), feathered into the block with a radial mask (no rectangle). Badge = **«Книговик радить»** only (no «· Редакційна добірка»). Desc clamped to 3 lines, kept short so it never cuts mid-word.
- **Mobile (≤768px):** `.feat-meta` becomes a single row (count + «книг у добірці» left) with the **«Переглянути» CTA right-aligned** via `margin-left:auto`.

### Icons (frozen — line icons only)
- All topic/genre icons are inline **Lucide-style line SVGs** via `<DynIcon name size>` (2px stroke, round caps, `var(--accent)`). **No emoji, no unicode glyphs.**
- Dynamic collections: Популярне зараз → `flame` · Новинки → `sparkles` · Найбільші знижки → `badge-percent` · Ціна знизилась → `trending-down` · Найбільш бажані → `bookmark` · Рекордна ціна → `arrow-down-to-line`.
- Genres: Фентезі → `swords` · Психологія → `brain` · Художня проза → `book-open` · Бізнес → `chart-column` · Наукова фантастика → `rocket` · Історія → `landmark` · Дитячі → `palette` · Наука → `microscope`.

### Chrome (frozen)
- Header = approved interior `.site-header` (theme-based logo, nav Головна · Добірки · Бажанки · Про нас, ThemeToggle + secondary Увійти). Footer = `.site-footer` on `--surface`; **logo uses the transparent lockups** `assets/logo/knyhovo-logo-light-trans.png` / `-dark-trans.png` (background flood-filled to transparent — text/mascot on the general background, no box).

### Do not modify
The **«Книговик радить» featured-block recipe** (bg colors `#f2dbc1`/`#0a0909`, 204px height, radial-mask mascot `mascot-reading-chair-light-hybrid.png`/`-dark-final.png`, badge text, 3-line desc, mobile row) — FINAL. Also keep: the line-icons-only rule (no emoji/unicode), frozen chrome (header/footer + transparent footer logos), DS token/component usage, protected brand assets. Everything else below the featured block is v2.0 working design — extend/refine freely, but keep the cozy-bookstore direction and real-cover shelves.

## Collections Landing v2.0 (UNFROZEN + evolved) · «Добірки» · /dobirky · 2026-07-02

> **"Collections Landing v2.0 — unfrozen from v1.0 and evolved into a richer, cozy-independent-bookstore discovery experience (Apple Books / Waterstones editorial feel). The «Книговик радить» featured block stays pixel-identical to v1.0; everything below it was recomposed around real book covers."**

- **Files:** `Collections Landing Page.html` (thin shell: DS links + all page CSS + `#root` + `<script type="text/babel" src="collections-app.jsx">`) and `collections-app.jsx` (all React — data, components, page). v1.0 preserved as `Collections Landing Page v1.0 (frozen).html`.
- **Real covers:** 24 editorial cover PNGs in `assets/covers/*.png` (atomni, sapiens, dumai, tonke, dofamin, internat, dotsia, feliks, drabyna, dveri, svitlo, perekop, majster, sto-rokiv, harry, b1984, pryntz, tygrolovy, misto, tini, lisova, kobzar, eneida, toreadory) — warm-paper Ukrainian book covers, used throughout the shelves. `CATALOG` in collections-app.jsx maps id → {cover,title,author,price,old,store}.
- **Section order (v2.0, alternating rhythm shelf▸nav▸editorial):** frozen Featured → **«Популярне зараз»** cover rail → **«Актуальні добірки»** (reduced to compact QuickNav, 6 cards) → divider → **«За настроєм»** mood tiles (6) → **«Новинки місяця»** new-arrivals rail («Новинка» accent badge) → **«Найбільші знижки»** DS `BookCard` grid (old→new prices, first = green «Найкраща ціна», rest −N%) → divider → **«За жанром»** genres (kept) → **«Читають просто зараз»** ranked trending list (01–NN + readers count) → **«Недооцінені книги»** hidden-gems editorial band (green-wash, fanned cover trio, hidden <1024px) → divider → **«Популярні автори»** author chips (kept) → **«Нові добірки цього тижня»** fresh editorial cards (3, cover thumbnails) → footer.
- **Book shelf = the core unit:** horizontal scroll rail (`.shelf-rail`, scroll-snap), 150×225 covers (132×198 mobile), title/author/price(+strike old) below, trailing dashed «more» card. This is what makes books appear immediately after the hero.
- **Line icons only** (inline Lucide-style `<DynIcon>` in collections-app.jsx, 2px stroke, `var(--accent)`) — the brief's emoji (📖💛☕🌙) were illustrative; rendered as icons (coffee/moon/compass/plane/feather/clock for moods, award/swords/lightbulb for fresh). No emoji/unicode glyphs.
- **Entrance:** `.reveal` = pure-CSS `kn-rise` fade (no JS/IntersectionObserver — those get throttled in non-painting iframes and trapped content invisible; do NOT reintroduce a JS-gated opacity:0). Guarded by `prefers-reduced-motion` + `@media print`.
- Composes only `window.KnyhovoDesignSystem_9fa616` (`BookCard`, `Badge`, `ThemeToggle`) + DS v1.0 tokens. Light + dark, responsive (desktop / ≤1024 tablet / ≤768 mobile). No new visual language.

### Do not modify
The «Книговик радить» featured block (pixel-identical to v1.0), the line-icons-only rule, frozen chrome + transparent footer logos, DS token/component usage, protected brand assets, and the no-JS-gated-opacity entrance rule. The v2.0 discovery composition is working design — refine within the cozy-bookstore + real-cover-shelf direction.

## Collections Landing v3.0 / Iteration 4 (mobile-first IA) · «Добірки» · /dobirky · 2026-07-02

> **"Full mobile-first UX/IA rework of the «Добірки» home page — designed as an Apple Books / Goodreads / Netflix-style discovery feed answering «Що почитати сьогодні?», not a bookstore catalog. Visual language untouched (freeze respected); only section order, genre list, section-treatment rhythm, and mobile card sizing changed."**

- **Files (canonical):** `Collections Landing Page.html` (thin shell + all CSS) + `collections-app.jsx`. Iteration-3 snapshot preserved as `Collections Landing Page v3.0 iter3 (history).html` + `collections-app-v3iter3.jsx`.
- **Section order (Iteration 4 — interleaved so carousels never stack, editorial moments break the rhythm):** 1 frozen Featured «Книговик радить» → 2 **«Обране читачами»** shelf (FULL header: rose eyebrow+title+sub+status) → 3 **«Що читати сьогодні»** mood editorial (sage band) → 4 **«Популярне зараз»** shelf (MINIMAL header: title + live status only, no eyebrow/sub) → divider → 5 **«За жанром»** nav grid (structural break) → divider → 6 **«Новинки місяця»** shelf (NO description) → divider → 7 **«Добірки редакції»** editorial cards (rich full-width on mobile, cover stacks — a culmination, not list-rows) → 8 **«Найбільші знижки»** deals shelf (SHORT status, warm band) → 9 **«Недооцінені книги»** hidden-gems editorial band (fanned cover trio, final culmination) → footer.
- **Deliberate section-treatment rhythm** (the page should "breathe"): each section varies its header — full / minimal / no-description / short-status — and its card badges (rose save-counts / accent «В тренді» / «Новинка» / green −N%). Editorial blocks (mood, «Добірки редакції» cards, gems band) break the carousel runs. Do not flatten every section back to the same eyebrow+title+sub+status+carousel template.
- **Genres = navigation, popular reader genres (revised from academic):** Трилери (`eye`) · Детективи (`search`) · Фентезі (`swords`) · Фантастика (`rocket`) · Романтика (`heart`) · Жахи (`ghost`) · Young Adult (`sparkles`) · Класика (`feather`). Only the top 8 surface; full catalog via «Усі жанри». Still line icons only.
- **Mobile book cards:** shelf card `flex-basis: 142px` at ≤768px → ~2.3–2.5 covers visible per screen so the rail visibly continues (peek edge + right-edge fade + trailing «see all» card). Mood section stays dense list-rows on mobile (variety); «Добірки редакції» stays rich cards.

### Do not modify
Same freeze as v2.0 (featured block, line-icons-only, chrome + transparent footer logos, DS tokens/components, protected assets, no-JS-gated-opacity entrance). The Iteration-4 IA + section-treatment rhythm + popular-genre list are the current working design — refine within the mobile-first discovery direction; don't revert to the old section order or academic genres.

## FROZEN: Knyhovo Collections Landing v2.0 — FINAL DESIGN FREEZE · «Добірки» · /dobirky · 2026-07-03

> **"Collections Landing v2.0 (= v3.0/Iteration-4 IA + Iteration-5 production polish) — APPROVED & FROZEN. Implementation source of truth for the «Добірки» page. No further visual exploration; bug fixes + backend integration only."**

- **Canonical files:** `Collections Landing Page.html` (shell + all CSS) + `collections-app.jsx` + `collections-nav.jsx`. These ARE the frozen artifact — do not fork or duplicate.
- **Frozen as a whole:** the Iteration-4 mobile-first IA (section order, section-treatment rhythm, popular-genre list, shelf/card/mood/editorial patterns, mobile card sizing, bottom sheet) + the Iteration-5 polish below. All previous "working design — refine freely" allowances for this page are revoked.

### Iteration-5 polish (part of the freeze; supersedes v1.0 numbers where listed):
- **Hero «Книговик радить»:** height 204→232px, padding 26px 36px, mascot 236×163→262×181. Dark bg one tone darker `#070606` (was `#0a0909`) + subtle mascot `brightness(1.07)`. Composition otherwise unchanged — these values supersede the v1.0 numbers.
- **Hero CTA:** padding 15px 30px, radius 11px, stronger copper glow, hover `translateY(-3px) scale(1.015)` (also on direct :hover), mobile height 54px. Colors unchanged.
- **cnav:** gap 40px, font-weight 600, hover `#FFC261`, active underline 48% width centered (`left:50%` + `translateX(-50%) scaleX`), 200ms. Stuck state (`.cnav--stuck`, scrollY>8): `rgba(23,20,17,.94)` + `backdrop-filter: blur(16px)` + soft bottom shadow.
- **Mega menu:** full-width panel kept; bg `rgba(23,20,17,.97)` + blur; genre list reordered to popular-reader order (Фантастика…Художня проза, 17 items) + «Усі жанри →» footer.
- **Nav-jump settle:** after cnav smooth scroll, target section gets one-shot `[data-cnav-flash]` → `.sec-head` fade-in 300ms (scrollend + fallback; reduced-motion static).

### Do not modify
Everything on this page: hero recipe (232px etc.), CTA, cnav (typography, underline, stuck glass state), mega menu + mobile bottom sheet, section order + rhythm, book/collection cards, palette, typography, logos, mascot, line-icons-only rule, no-JS-gated-opacity entrance. Extend functionality (backend integration) only; never redesign.

## Review artifact: Knyhovo MVP Product Board · 2026-06-30
- **`Knyhovo MVP Product Board.html`** (root) is the single read-only **review board** for the whole MVP — a Figma-style showcase of every approved screen as a live lazy `<iframe>`, in 13 labeled sections (incl. **08 · Auth «Вхід»** → Magic Link Login), plus a guided Home→Search→Book→Wishlist→Settings→Notifications→Unsubscribe→Home tour (fullscreen overlay, prev/next). Helpers: `board-foundations.html` (token/brand specimen) + `board-components.html` (real DS-bundle components).
- **It is a review artifact, NOT a source design file.** It embeds the approved screens by reference and must never become a second source of UI. Never edit a screen *in* the board — change the real screen file (or its shared implementation), and the board reflects it. Every frame points at the canonical file; the Wishlist frame uses `Wishlist v1.0 - Hybrid Freeze v2.html`; the Auth frame uses `Magic Link Login.html`. Profile / Security settings are clearly-labeled "Not yet designed" placeholders.

## Frozen pattern: Knyhovo Magic Link Login v1.0 · Auth · /login · 2026-06-30

> **"Magic Link Login v1.0 — APPROVED & FROZEN. Implementation source of truth. Do not redesign. Only integrate with the existing auth backend and DS components. It must read as a natural continuation of the existing Knyhovo product (Settings → Сповіщення, Public unsubscribe), not a separately-designed auth experience."**

- **Files:** `Magic Link Login.html` (design canvas: all states, both themes, desktop + mobile 375px), `ml-shared.jsx` (`window.ML_Frame`, `ML_LoginFlow`, `ML_AuthSpecimen`, `ML_Toast`, `ML_ToastSpecimen`, `ML_LoginPanel`), `ml-canvas.jsx` (canvas layout + implementation-spec notes). Reuses the frozen interior chrome **verbatim** via `window.NP_SiteHeader` / `NP_SiteFooter` from `np-shared.jsx`.
- **Compose only from** `window.KnyhovoDesignSystem_9fa616` (`Button`, `Badge`) + the frozen NP chrome. No new visual language, colors, type, radii, shadows, or components. **No password, no social login, no registration, no mascot.**

### Frozen rules
- **Panel = a DS card** (`--surface` + 1px `--border` + `--radius-md` + `--shadow-sm`, padding `--space-12`, max-width 440px), centred in `.ml-main` (same rhythm as Public unsubscribe). Medallion `.np-unsub__icon` → title `.np-unsub__title` (Lora) → `.ml-lead` (`--text-muted`).
- **States:** login (idle) · sending (disabled + `.ml-spin`, «Надсилаємо посилання…») · success «Перевірте пошту» · error (inline `.al-note--err`, CTA **«Надіслати ще раз»** — never red) · invalid/expired «Посилання недійсне» · redirect «Входимо…» · auth-required reusable block. Each in light + dark, desktop + mobile.
- **Success screen:** recipient email is the **primary visual anchor** — `.ml-email` (serif `--font-display`, `--fw-semibold`, `--fs-title`, `--accent`) on its own line under the title. Muted «Спам» helper `.ml-spam` at the bottom (never dominant). «Посилання діє обмежений час.» supporting line + secondary «Надіслати ще раз» + quiet `.ml-link` «Змінити email».
- **Redirect loading:** subtle animated **DS logo** (`.ml-redirect-logo`, existing asset, opacity-pulse only) — NOT a bare/generic spinner. Static (full opacity) under `prefers-reduced-motion`. `.ml-spin` stays for the in-flight sending action only. No infinite content animations.
- **Invalid/expired:** «Отримати нове посилання» (primary) + **secondary Button** «На головну» (matches Wishlist/Settings interaction; not a plain text link).
- **Toast** «Посилання надіслано» appears **only** after «Надіслати ще раз» on the success screen (calm `.np-toast`/`al-toast`). **Never** after the first successful submission — the success screen is already the confirmation.
- **Mobile (375px):** single full-width card, **+48px top breathing room** below the header (`.np--mob .ml-main` padding-top), 44–48px touch targets. No sidebar; compact header.

### Flow (frozen — see `ml-canvas.jsx` notes for the full spec)
- **Entry behaviour:** header «Увійти» → **centred login modal over the current page**. The dedicated `/login` page is only for auth-required redirects, expired/invalid magic links, direct URL access, and bookmarked login. **Modal and page reuse the exact same login component.**
- **Invalid → prefill:** «Отримати нове посилання» returns to login with the previously entered email already prefilled.
- **returnTo:** preserved through the flow; the user always returns to where login started — Wishlist, Settings, Book Details, Search Results — with Home as the fallback.

### Do not modify
Header / footer / navigation (frozen NP chrome), the DS-card panel recipe, typography, spacing scale, color tokens, radii, shadows, the DS component set, the email-anchor rule, the toast-only-on-resend rule, the never-red rule, the animated-logo redirect, the no-password / no-social / no-registration / no-mascot constraints. Extend functionality (backend integration) only; never redesign.

## Frozen pattern: Knyhovo Notification Preferences v1.0 · Settings → Сповіщення · 2026-06-30

> **"Notification Preferences v1.0 — FROZEN. Implementation source of truth. No further visual exploration; bug fixes only. It must read as a natural continuation of the existing Knyhovo product (Homepage / Search Results / Wishlist / Book Details / Collections) — not a later-designed page."**

- **Files:** `Notification Preferences.html` (design canvas: all states, both themes, desktop + mobile), `np-shared.jsx` (`window.NP_Frame`, `NP_Unsubscribe`, `NP_ToastSpecimen`), `np-canvas.jsx` (canvas layout), `Notification Unsubscribe.html` (standalone public page). `alerts.jpeg` was backend/API context, NOT UI direction.
- **Compose only from** `window.KnyhovoDesignSystem_9fa616` (`Button`, `Badge`, `ThemeToggle`). No new visual language, colors, type, radii, shadows, or components.

### Chrome (frozen — reused verbatim, never redesigned)
- Header = the approved interior `.site-header` (single theme-based logo via `theme==='dark' ? dark : light` — NEVER both logos at once; nav `Головна · Каталог · Знижки · Про нас`; `ThemeToggle` + secondary `Профіль`). Mobile = compact `.np-header-mob` (burger + logo · ThemeToggle), no sidebar.
- Footer = approved `.site-footer` (logo 36px + line + copy), bottom padding `--space-6`.
- Settings sidebar = `.np-sidenav` (Профіль · **Сповіщення** active · Безпека та вхід), desktop only.

### Content (frozen)
- Title «Налаштування сповіщень» (display, `--fs-h2`) + subtitle «Керуйте email-сповіщеннями від Knyhovo.» **No section eyebrow** (single group). Heading→first card gap kept tight (`np-head` margin-bottom `--space-3`).
- Two DS cards (`.np-card`: surface + hairline + `--radius-md` + `--shadow-sm`) with a subtle warm-paper wash `color-mix(in oklab, var(--accent) 4.5%, var(--surface))` — no new color, no visible beige, no stronger border.
- Toggle right in each card; copper/accent track. **Autosave** (PATCH) → calm low-contrast toast «Налаштування збережено» (sunk surface, hairline, `--shadow-sm`, `--fs-xs`). **No save button.**
- Autosave helper «Зміни зберігаються автоматично» — secondary supporting text, centered under the cards, `opacity: 0.58`.
- **No green «підписані» badge** — the toggles communicate subscription state.

### States (frozen)
subscribed (both ON) · unsubscribed · loading · error · success-toast · public unsubscribe. Each in light + dark, desktop + mobile (375px).
- **Unsubscribed = minimal:** muted `neutral` Badge «Ви відписані від усіх сповіщень» + one short line + disabled cards. Nothing else. **Never red** (DS rule).
- **Loading:** warm `--surface-accent` skeletons, one-shot fade (no infinite loops).
- **Error:** local recoverable `.al-note--err` + compact **secondary** «Спробувати ще раз» (trimmed horizontal padding) — emphasis stays on the message.
- **Mobile:** single column, full-width cards (vertical padding `--space-3 --space-4`), 44px toggle touch area, 16px between cards.

### Public unsubscribe (frozen)
Separate minimal page (`Notification Unsubscribe.html`), NOT mixed into Settings: same header/footer, centered icon + «Ви відписані від усіх сповіщень» + short text + reduced-width primary «Повернутися на головну».

### Do not modify
Header / footer / navigation / Settings sidebar, typography, spacing scale, color tokens, radii, shadows, the DS component set, autosave-no-button model, no-eyebrow rule, warm-card wash recipe, never-red rule, toast calmness. Extend functionality only; never redesign.

---

## Frozen pattern: Knyhovo Search Results v1.0

> **"This pattern is approved and frozen. Future iterations may extend Search Results functionality, but must not redesign the established visual foundations."**
> Approved 2026-06-10. Stable Knyhovo pattern intended for direct reuse in Claude Code implementations.

- **Files:** `Search Results Page.html` (live pattern, light/dark via `data-theme`), `search-results.jsx` (composition logic), `Search Results — Pattern Spec.html` (anatomy, all frozen specs, machine-readable JSON note).
- **Compose only from** `window.KnyhovoDesignSystem_9fa616` exports: `SearchBar`, `BookCard`, `Button`, `Badge`, `Chip`, `ThemeToggle`. No new visual language, colors, type, radii, or shadows.

### Footer
- Footer is **always present** in all three states: results, loading, empty. Layout and content identical across states and themes.

### SearchBar states
- **Idle:** icon + placeholder only.
- **Typing:** entered query + `× Очистити запит` button below (`--text-muted`, hover → `--accent`). Clear resets query + committed + page.
- **Loading:** `<SearchBarSkeleton />` reuses `.kn-field` capsule — exact dims, 16px radius, border preserved.
- **Results / Empty:** query preserved in field exactly as typed.

### BookCard metadata hierarchy (frozen)
- Primary: current price (large serif, `--accent`).
- Secondary: old price if available (muted strikethrough, smaller).
- Tertiary: store name — **always `--text-muted`, never accented, never competes with title or price**.
- Badge priority: Найкраща ціна (green) → -N% (solid) → Новинка (accent). Max one per card.

### Pagination
- Algorithm: always show first + last + current + ±1 adjacent. Fill single hidden pages instead of ellipsis. Ellipsis only when gap > 1 page.
- Buttons: prev/next → `secondary sm`; pages → `ghost sm`; current → `primary sm` + `aria-current="page"`.
- `<768px`: row wraps, all buttons min 44×44px touch targets.
- Sort change or new search resets to page 1.

### View modes
- **Grid View only** — List View excluded from MVP v1.0. No layout toggle.

### Loading states
- Warm `--surface-accent` blocks only — never cold greys.
- SearchBar skeleton: reuses `.kn-field` capsule exactly.
- BookCard skeleton: mirrors full anatomy (cover 84×122, badge zone, title, author, price+store row); `min-height: 156px` prevents layout shift.
- Animation: staggered fade-in 280ms ease-out, 50ms cascade per card. **No infinite animations.** Static under `prefers-reduced-motion`.

### Empty state
- Approved mascot illustrations: magnifier (light) / lantern (dark). Height 230px desktop / 180px ≤900px.
- Messaging hierarchy: headline → supporting text → popular-query Chips.
- **Illustration-driven by intent — do NOT simplify or minimize. Knyhovyk acts as a guide.**

### Responsive
- ≥768px: 2-col grid, horizontal BookCards, full pagination.
- <768px: single column, BookCards switch to vertical via page-level CSS (BookCard component untouched), full-width SearchBar, wrapping sort chips, 44px touch targets.

### Do not modify
Hero typography, SearchBar appearance, header/nav, BookCard visual design, sorting-control appearance, empty-state composition/mascot usage, color palette, typography, spacing rules, shadows/borders — and all v1.0 protected brand assets (logo, mascot).

---

## Frozen pattern: Knyhovo Book Details v1.1

> **"This pattern is approved and frozen. Future iterations may extend Book Details functionality, but must not redesign the established visual foundations."**
> Approved 2026-06-11. Variant C (Balanced) — desktop + mobile adaptation. Stable Knyhovo pattern intended for direct reuse in Claude Code implementations.

- **Files:** `Book Details - Exploration.html` (live pattern reference, all artboards, light/dark), `Book Details — Pattern Spec.html` (anatomy, all frozen specs, machine-readable JSON note).
- **Compose only from** `window.KnyhovoDesignSystem_9fa616` exports: `SearchBar`, `BookCard`, `Button`, `Badge`, `Chip`, `ThemeToggle`. No new visual language, colors, type, radii, or shadows.

### Desktop layout (≥1024px)
- Two-pane grid: discovery pane (cover · title · author · description · metadata) left; decision panel (best price · all offers · wishlist) right at 460px fixed.
- Cover placeholder: 300×440px, `--radius-md`, `--shadow-md`.
- Breadcrumbs below the persistent SearchBar.
- Footer always present in every state.

### Mobile layout (<768px)
- Single column, decision-first order: hero → offers panel → description → metadata → price history → shelves.
- Compact header: logo left · theme toggle + menu (44px targets) right. No bottom navigation.
- Full-width SearchBar (inherits frozen Search Results <768px rule).

### Sticky purchase bar (mobile only)
- Appears after the best-price block leaves the viewport (IntersectionObserver); hidden on unavailable state.
- Content: best price (serif `--accent`) · old price (muted strikethrough) · store name · primary CTA «Перейти до книгарні».
- Opaque `--surface` + 1px `--border` top. Page reserves bottom padding = bar height + `env(safe-area-inset-bottom)`.

### Offers panel
- Best offer: green «Найкраща ціна» badge + `--accent-weak` block + full-width primary CTA.
- All other offers sorted: in-stock by ascending price, out-of-stock last.
- Store name always `--text-muted` (inherits frozen BookCard metadata hierarchy).
- Old price: muted strikethrough; `-N%` solid badge.
- Desktop row layout: store name | availability | price stack | CTA. Mobile: two-line (store+avail left, price stack right, CTA).
- «Ціни оновлено» note below the list.

### Price metadata hierarchy (frozen)
- Primary: current price — large serif, `--accent`.
- Secondary: old price if available — muted strikethrough, smaller.
- Tertiary: store name — always `--text-muted`, never accented.
- Badge priority: Найкраща ціна (green) → -N% (solid). Max one per offer row.

### Wishlist
- Sits directly below the best-price CTA in the offers panel (desktop and mobile).
- States: unsaved (bookmark icon + «До вішлиста») → saved (bookmark-check + «У вішлисті») → saved + alert (+ «Стежимо за ціною» accent badge).

### Description
- Desktop: full multi-paragraph text in left pane.
- Mobile: clamped to 6 lines, ghost «Показати все» / «Згорнути» toggle.

### Metadata
- Desktop: 2-column `<dl>` grid (publisher, ISBN, language, format, series, year).
- Mobile: single-column label–value rows in a surface card.
- Missing values shown as «—» or «Уточнюємо…» in partial-data state.

### Price history
- Always a reserved placeholder section. No chart styles defined yet.
- Shows icon + «Динаміка ціни» title + «Незабаром» neutral badge + explanatory text.

### Related shelves
- Desktop: 4-column BookCard grid.
- Mobile: horizontal scroll rail (page-level flex; BookCard component untouched), edge-cut implies scrollability.
- Series shelf first, then author shelf.

### Loading state
- Warm `--surface-accent` skeleton blocks only — never cold greys (inherits frozen Search Results rule).
- One-shot 280ms ease-out stagger (class removed after cascade). Static under `prefers-reduced-motion`.
- SearchBar skeleton reuses `.kn-field` capsule exactly.
- Footer always present.

### Unavailable state
- Mascot guides to wishlist + «Повідомити про наявність» primary CTA.
- Mascot height: 230px desktop / 180px ≤900px (inherits frozen empty-state rule).
- All store rows remain visible as proof of the check (out-of-stock state, opacity 0.66).
- Sticky purchase bar hidden in this state.

### Partial data state
- Missing description: replaced by a `bd-hint` info block.
- Missing metadata fields: shown as «Уточнюємо…».
- Offers note states list is still being populated.

### Breakpoints
- **Desktop ≥1024px** — two panes, offers panel 460px, 4-up shelves.
- **Tablet 768–1023px** — two panes retained, panel narrows to 380px, shelves 3-up.
- **Mobile <768px** — single column, compact header, sticky CTA bar, horizontal shelves, 44px touch targets.

### Do not modify
Cover dimensions, offer panel width, best-price block composition, sticky bar structure, metadata hierarchy, mascot usage rules, description clamp/toggle pattern, price-history placeholder, skeleton warm-surface rule, breakpoint order, BookCard and all other DS component internals — and all v1.1 protected brand assets (logo, mascot).

---

## Frozen pattern: Knyhovo «Бажанки» (Wishlist) v1.0 — FINAL DESIGN FREEZE (Hybrid D + C) · 2026-06-13

> **"Wishlist v1.0 — Final Design Freeze. Production-ready, approved for implementation handoff. Desktop = Variant D, Mobile = Variant C accordion. No new concepts — consistency & polish only."**
> Finalized 2026-06-13 in `Wishlist v1.0 - Hybrid Freeze v2.html` + `wl-h2-*.jsx` (live final pattern). Earlier same-day revision and the 2026-06-12 freeze (`Wishlist v1.0 - Hybrid Freeze.html` + `wl-hd-*.jsx`) kept as history.

### Canonical entrypoint (restored 2026-06-30)
- **`Wishlist v1.0 - Hybrid Freeze v2.html` is the canonical HTML entrypoint** for «Бажанки» — there is exactly one. The HTML file is a **thin mounting host only**: DS token/component CSS + the canonical Wishlist stylesheet `design-import/price-history-v1/ph-wl.css` + the script chain (`design-canvas.jsx` → `wishlist-shared.jsx` → `wl-h2-shared.jsx` → `wl-h2-views.jsx` → `wl-h2-states.jsx` → `wl-h2-docs.jsx` → `wl-h2-canvas.jsx`) + `<div id="h2-root">`. It contains **no copied CSS, no copied JSX, no recreated components** — `tweaks-panel.jsx` is not loaded (the canvas uses its own inline tweaks).
- **Source of truth = the shared `wl-h2-*` implementation** (`window.WL` → `window.H2`). Future Wishlist changes must be made in the shared `wl-h2-*.jsx` / `ph-wl.css`, **never in the HTML host**. Never fork or duplicate the Wishlist implementation.

### Final polish pass (2026-06-13) — these are the production rules
- **Headline rule:** ANY state with ≥1 book uses `«Бажанки, за якими стежить Книговик.»` (em on Книговик). `«Ваші бажанки»` / onboarding copy is ALLOWED ONLY in the empty state (0 books). Applies to first-book, quiet, 50+, price-drop, unavailable.
- **Section names unified (desktop + mobile):** top `«Книги зі знижками»`, bottom `«Інші бажанки»`. Removed `«Чекають свого моменту»`, `«Знайомимось»`, `«Готові до купівлі»`, `«Моменти»`. Mobile now uses the same two-group split as desktop (`desktopGroups`).
- **Empty state copy:** head «Не просто зберігайте книги — купуйте їх у правильний момент.» · sub «Додайте книгу — щодня о 08:00 Knyhovo перевірить ціни у 5 книгарнях, а Книговик підкаже, коли настане час купувати.» Mascot allowed (central hero).
- **Quiet-week copy:** «Knyhovo перевіряє ціни щодня о 08:00, а Книговик підкаже, коли настане правильний момент купувати.»
- **Role split (all copy):** Knyhovo = шукає / перевіряє / моніторить ціни (інструмент). Книговик = радить / стежить / підказує / повідомляє (персональний помічник, майбутній AI-персонаж). Recommendations never read as coming from a store.
- **CTA order (frozen, desktop + mobile, one row):** `[Деталі книги · secondary] → [До книгарні · primary]`. Mobile buttons equal width (50/50 grid).
- **Footer:** single reusable `<KnyhovoFooter />`, bottom-anchored via `.v1-shell-content` flex, identical spacing across ALL states (desktop 80px / mobile 48px above divider). No drift.
- **Green hierarchy:** green only for positive events (discount, target met, historical low, good moment); never neutral states; CTA never green.
- **Unavailable book:** utilitarian, no mascot — title · fact · `[Повідомити мене] [Знайти схожі]`.
- **Status label:** «Wishlist v1.0 — Final Design Freeze». No Exploration marks remain. No new concepts to be proposed.

---

## History: Knyhovo «Бажанки» (Wishlist) v1.0 — HYBRID DESIGN FREEZE (D + C) · Ревізія 2026-06-13

> **"This pattern is approved and frozen. Desktop = Variant D (Primary Direction), Mobile = Variant C accordion (Mobile Foundation), Discounts = D styling, Expansion = C behavior."**
> Revised 2026-06-13 (`Wishlist v1.0 - Hybrid Freeze v2.html`, `wl-h2-*.jsx`) — supersedes the 2026-06-12 freeze (`Wishlist v1.0 - Hybrid Freeze.html` + `wl-hd-*.jsx`, kept as history). Stable Knyhovo pattern intended for direct reuse in Claude Code implementations.

### Revision 2026-06-13 — key changes (these override the older bullets below where they conflict)
- **Renaming:** «Wishlist / Вішлист» → **«Бажанки»** everywhere; wishlist item → «книга у бажанках»; filter «Моменти» → **«Книги зі знижками»**.
- **Hero:** «Бажанки, за якими стежить Книговик.» · sub «Не просто зберігайте книги — купуйте їх у правильний момент. Книговик підкаже, коли настане час купувати.» Книговик is positioned as a personal **adviser** (not a store/brand-assistant), future AI persona — all copy reinforces the wise book-helper image.
- **Savings:** «Заощаджено з Knyhovo: N ₴» — accumulated benefit over all time (not weekly), green serif.
- **Desktop sections:** «Вигідний момент настав» → **«Книги зі знижками»**; «Решта полиці» → **«Інші бажанки»**. Order: Hero → Книги зі знижками → Інші бажанки → weekly letter. Discounted books auto-promote to the top section (desktop + mobile) — never hunted in the list.
- **Desktop cards:** full content-width, single grid `cover → book info → recommendation/status → pricing → CTA → secondary`, equal height (`min-height:104px`), identical paddings, fixed CTA column. No narrow/variable-width offers.
- **CTA order (frozen, desktop + mobile, one row):** `[Деталі книги · secondary] → [До книгарні · primary]`. «Деталі книги» is a real secondary button, not text/link. Rationale: explore → decide → buy. Unavailable book: 2nd slot = «Повідомити мене» (secondary), position unchanged.
- **Economy emphasis:** «Економія N ₴» — green serif, legible on card and in collapsed mobile state.
- **Unavailable book = UTILITARIAN state:** Книговик/mascot **fully removed**, no hero illustration, no emotional block. Title · «Наразі книги немає в наявності. Книговик повідомить, коли вона з'явиться.» · `[Повідомити мене] [Знайти схожі]`.
- **Mascot now allowed ONLY in: empty · first-book** (no longer in unavailable).
- **Principle:** «Knyhovo знаходить ціни. Книговик радить.» Бажанки = books Книговик watches, not a list.

- **Files (older freeze, history):** `Wishlist v1.0 - Hybrid Freeze.html` (live pattern: 4 main artboards desktop/mobile × light/dark, 7 states, docs), `wl-hd-*.jsx` (composition logic).
- **Variant statuses:** Variant C — Mobile Foundation · Variant D — Primary Direction · A/B — rejected.
- **Philosophy:** «Не просто зберігай книги. Купуй їх у правильному моменті.» Wishlist is a decision assistant, not a list. Calm, no FOMO copy.
- **Compose only from** `window.KnyhovoDesignSystem_9fa616` exports. No new visual language, colors, type, radii, or shadows.

### Desktop (Variant D)
- Single content column (max-width 940px), sections by purchase-readiness: «Готові до купівлі» (green-tinted section) → «Чекають свого моменту» → «Знайомимось» → недільний лист (weekly digest letter).
- Each row carries a verdict badge (Чудовий момент green / Зачекайте neutral / Ціна висока blue / Збираємо дані / Очікуємо наявності) + one honest reason line.
- Savings counter in page head: green serif number («Заощаджено з Knyhovo: 412 ₴»).

### Mobile (Variant C accordion + D enhancements)
- Compact list, one book = one card, accordion **closed by default**.
- Collapsed: cover 36×52 · title · author · current price · delta · status/badge · CTA (visible for moment cards).
- Expanded: економія · стара ціна · книгарня · остання перевірка · цільова ціна · сповіщення (+ Змінити) · дії (Деталі книги, стеження, прибрати).
- Info priority: назва → ціна → економія → CTA → статус → решта після розкриття.
- CTA «До книгарні» max one extra tap. Sticky «Додати книгу» bottom CTA. 44px touch targets.

### Green hierarchy (frozen)
- Green (`--brand-green`) **only for positive events**: ціль досягнута, подешевшало, historical low, вигідний момент, рекомендація купувати.
- Intensity scale: 1) green delta only → 2) + green badge → 3) + green border `color-mix(brand-green 45%, border)` + tinted bg `color-mix(brand-green 5–6%, surface)` + green price. Stronger benefit = more green.
- Never: green for neutral/technical states, green CTA buttons (CTA always accent), more than one badge per card, red for price rises (rises stay muted).

### Inherited frozen rules
- Footer always present; warm `--surface-accent` skeletons; mascot (reading chair) only in empty / first-book / unavailable; max one strong badge per item; price hierarchy (serif price · muted strike old · muted store).

### Do not modify
Section order and grouping logic, verdict set and tones, green hierarchy rules, accordion collapsed/expanded content split, savings-counter placement and color, weekly-letter composition, mascot usage rules, DS component internals, protected brand assets.

---

## Frozen pattern: Book Details v1.2.1 — Price History API Integration (W5) · 2026-06-14

> **"Amends v1.2 FINAL FREEZE. Changes ONLY the items listed here (approved for W5); all other foundations stay frozen. Production-ready for implementation handoff."**

- **Files (in `design-import/price-history-v1/`):** `Book Details — Price History (W5 API).html` (live integration — all states, both themes, desktop + mobile), `ph-section.jsx` (`window.PHSection.PriceHistorySection` — stateful orchestrator), `ph-api.jsx` (`window.PHApi` — contract + mock + `toViewModel` + period map), `ph-format.jsx` (`window.PHFormat` — копійки→₴). Chart/stats/advisory/empty/loading stay in `ph-chart.jsx` (now data-driven via a `series` prop; backward-compatible with the exploration files). Spec: `Price History - Final Freeze.html` (v1.2.1).
- **API:** `GET /api/books/:id/price-history?period=30d|90d|1y|all`, default `90d`. Response: `{ bookId, period, currency, current, lowest, highest, typicalRange{min,max}, change{amount,percent}, points:[{ amount, currency, availability, recordedAt }] }`. All money = integer **копійки** → format as ₴ (`24000 → 240 ₴`). `recordedAt` ISO; `availability ∈ in-stock|out-of-stock|unknown`. Adapter uses `amount`/`recordedAt`/`availability` (never `price`/`t`).

### v1.2.1 changes vs v1.2 (these override v1.2 where they conflict)
- Terminology **«типова ціна»** everywhere (was «звичайна ціна») — band label, stat label, advisory, aria.
- Stat labels: **Зараз · Найнижча · Типова ціна · Зміна** (shortened).
- Chart does **not** show «найвища» — peak annotation removed; `highest` stays an internal API field. If the line naturally passes the high point that's fine — no dot/label.
- **Blue retired** for high/up states → neutral/muted (`--text-muted`). Green only for positive user value (below typical, negative change, savings). Never red for high prices.
- Empty copy shortened: «Knyhovo перевіряє ціни щодня о 08:00. Книговик підкаже, коли настане вдалий момент купувати.»
- Mobile chart height **~168px**; period chips **44px** (touch rule).

### States (frozen)
filled · loading · empty · **error** · out-of-stock. Block sits directly below `OffersPanel`, never collapses (only its inner body swaps), title + footer always present, offers + rest of page stay usable. Period switch re-queries the API and shows body-only loading (chips persist); error is local + recoverable («Спробувати ще раз»), never a global page, never hides offers. Out-of-stock keeps the historical price (**never 0**); break/hatch visuals deferred (seam left via `point.availability`). Chart is display-only (no tooltip/scrub in v1.2.1).

### Do not modify
API adapter contract (field names), period map + default 90d, «типова ціна» terminology, the 4-stat set/order, no-highest rule, neutral-not-blue/never-red color rules, out-of-stock-never-0 rule, block placement below offers, calm/display-only chart, DS token usage. No Wishlist / alerts / verdict / AI / digest changes.

---

## W5 — Final Freeze Polish · 2026-06-14 (FINAL — feature-complete)

> **"W5 Price History UI is feature-complete. This is the final design freeze — a consistency & polish pass only, NOT a redesign. Layouts, spacing system, typography scales, chart behavior and component hierarchy are unchanged."**
> Applied in `ph-chart.css` + `ph-section.jsx` + `ph-chart.jsx` (`design-import/price-history-v1/`). Production-ready for Claude Code handoff.

### Polish applied (the only changes in this pass)
1. **Chips ↔ title alignment (desktop filled/loading):** `.ph-head` is `align-items:center; flex-wrap:nowrap`; chips (`flex:0 0 auto`) stay on the «Динаміка ціни» title's row, optically centred with the serif (verified glyph-center = chip-center). Chips never wrap below the title.
2. **Loading skeleton mirrors the final chart layout:** real title + real chips (preserved, see below) → two-line explanatory text → chart area sized to the **real chart footprint** (`.ph-sk-chart` 244px desktop / 168px mobile = no loading→filled shift) with a typical-range band hint + a sparse axis-label row → 4 statistics placeholders whose widths mirror the real labels/values (Зараз · Найнижча · Типова ціна · Зміна). Warm `--surface-accent`/`--surface-sunk` only.
3. **Error is a compact card:** `.ph-empty--error { max-width: 520px }` — desktop error no longer spans full width; left-aligned, calm, recoverable. Mobile unaffected.
4. **Empty-state badge proximity:** «Збираємо дані» badge now sits **directly beside** the «Ще збираємо історію» heading (`.ph-empty__title { flex:0 1 auto }`, titlerow gap `--space-2`) instead of being pushed to the far edge.
5. **Mobile chip minimum widths (floors):** `.ph-periods--mob .ph-period` — 30 днів 72px · 90 днів 72px · Рік 56px · Весь час 80px. Even footprints, single row, no horizontal scroll, 44px touch height preserved.

### Resiliency rules — locked (these were already true; now explicitly frozen)
- **Highest price is hidden** in the UI. `highest` stays an internal API field only — no dot, callout, label, or stat. The 4-stat set is Зараз · Найнижча · Типова ціна · Зміна.
- **Empty & error states show NO period chips** — there is no data to switch between (empty) and switching won't fix a failure (error). Header = title only.
- **Loading state PRESERVES the period chips** — loading can follow a period change, so the real title + chips stay put above a body-only skeleton; layout never shifts.
- **«Типова ціна» terminology** everywhere (band label, stat label, advisory, aria) — never «звичайна ціна» / «найвища».
- **Book Details resiliency:** the «Динаміка ціни» block never collapses (only its inner body swaps), title always present, and any Price-History failure (loading/empty/error) leaves OffersPanel and the rest of Book Details fully usable. Error is local + recoverable, never a global page.

### Do not modify (W5 final)
The five polish items above, all v1.2.1 «Do not modify» rules, and the resiliency rules — these are the final frozen W5 Price History foundations. Future work may extend functionality but must not redesign them.

---

## Frozen pattern: Knyhovo «Інші книги автора» (Author Shelf) v1.0 · W9a · 2026-06-20

> **"Author Shelf v1.0 — approved and frozen for implementation. Future iterations may extend Author Shelf functionality, but must not redesign the established visual foundations."**
> Approved 2026-06-20. The only new UI component for W9a. Extends Book Details v1.1 (Variant C). Does NOT introduce new pages and does NOT modify Search Results or the Book Details hero. Production-ready for engineering + QA handoff.

- **Files** (in `packages/web/design-import/discovery-w9a-author-shelf/`): `Author Shelf — Live Pattern.html` (all degradation states, both themes, desktop + mobile), `Author Shelf — Pattern Spec.html` (anatomy, frozen specs, machine-readable JSON note in §19), `author-shelf.jsx` (`window.AuthorShelfKit`), `author-shelf.css`.
- **Integration contract:** render `AuthorShelfSection` — it runs `selectAuthorShelf` **three times** (cap 4 desktop, cap 3 tablet, cap 8 mobile) and renders all three wrappers `.as-desktop` + `.as-tablet` + `.as-mobile`; CSS shows exactly one per breakpoint. This is the **only** supported responsive switch.
- **Compose only from** `window.KnyhovoDesignSystem_9fa616` (`BookCard`, `Badge`) + `window.AuthorShelfKit`. No new visual language, colors, type, radii, or shadows. `BookCard` component untouched — page-level overrides only.
- **Namespace:** `window.AuthorShelfKit` (NOT `window.AuthorShelf` — the React component `AuthorShelf` would shadow a same-named global in Babel scope).

### Placement (frozen)
Last content section in Book Details — after the Series shelf, before the footer. Always below Price History and metadata. Never a separate page. Order of two shelves: Series (first, narrower relation) → Author (second, broader). If no series, author shelf may be the only shelf.

### Min N = 2 (frozen omit threshold)
0 or 1 matched book → **section omitted entirely** (`selectAuthorShelf → show:false`, component returns `null`). No placeholder, no empty state, no mascot. Книговик **never** appears on this shelf (not an allowed W8c surface).

### Card anatomy (frozen)
Frozen `BookCard` (.kn-book), vertical. **Shown:** cover · title · price · oldPrice? · store · one discount badge. **Hidden:** author (redundant with section heading + hides noisy author-string variants — `.as-shelf .kn-book__author{display:none}`), availability label, rating. **Hierarchy:** price (accent serif) › old price (muted strike) › store (muted, never accent). Cover: 104×150 desktop / 96×138 mobile.

### Column model (frozen)
One mechanism, any N or cap: `--as-cols = min(visibleCards, rowCap)` set inline by JSX → CSS `repeat(var(--as-cols), minmax(0, var(--as-card-max)))`. **`auto-fit`/`auto-fill` forbidden.** Column count == card count in every range (2→2, 3→3, 4→4). Card width clamped 136–272px. No empty/reserved tracks, no filler cards, no overlap/fan/absolute.

### Cap + see-all (frozen)
Desktop 4 / tablet 3 / mobile 8. Over cap → «Усі книги автора (N) →» (desktop/tablet) / trailing rail card (mobile) → author page (Search Results filtered). No second row, no pagination.

### Ordering + dedup (frozen)
Dedup key = canonical `id` (exclude `currentId` + `seriesIds`). **Never title** (titles collide across editions). In-stock first (`in`/`low`), then price ascending, tie-break by id (deterministic). Out-of-stock (`out`) → price «—», sorted last. All-out: shelf still shown; omit only when total < 2.

### Mobile rail (frozen)
Horizontal flex rail, scroll-snap x proximity, 168px cards, cover 96×138. Edge-bleed: first card fully visible at left gutter; trailing card cut by viewport edge (peek = only scroll affordance). `scroll-snap-align: start` + `scroll-padding-left: --space-4`. Trailing see-all card when `hasMore`. 44px touch targets.

### Entrance animation (frozen)
One-shot stagger, 280ms ease-out, 50ms cascade, gated on `prefers-reduced-motion: no-preference`. **Never infinite.** Static under reduced-motion.

### Examples are normative
Live Pattern + rendered specimens win over prose if they ever conflict. Both render from the same `author-shelf.jsx` + `author-shelf.css` as production.

### Do not modify
Placement order, min-N=2 omit threshold, BookCard reuse (no new card), author-line suppression, shown/hidden card fields + metadata hierarchy, cap + see-all behavior, selection/ordering, grid↔rail breakpoint switch, one-shot (non-infinite) entrance, DS v1.0 tokens, protected brand assets. Do not touch Search Results or the Book Details hero.
