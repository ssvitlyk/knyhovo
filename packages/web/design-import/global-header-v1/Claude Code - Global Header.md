# Claude Code handoff — Knyhovo GLOBAL HEADER v1.0 · 2026-07-04

> **This supersedes every previous per-page header implementation** (the old
> `.site-header` chrome on Homepage, Search Results, Collections Landing,
> Collection Details) **and the "Header" parts of earlier frozen specs.**
> Footers are NOT touched — each page keeps its frozen footer.
> UX reference was ksd.ua; visuals are 100% Knyhovo DS. Implement from the
> canonical files, not from memory.

## Canonical files
- `kn-header.css` — all header styles (`.knh*`, `.knh-so*` search overlay, `.knh-dr*` drawer).
- `kn-header.jsx` — `window.KnHeader = { Header, useAuth }`. Single React component used by every page.
- Integrated pages (reference integrations): `Homepage v1.0.html` + `homepage.jsx`,
  `Search Results Page.html` + `search-results.jsx`,
  `Collections Landing Page.html` + `collections-app.jsx`,
  `Collection Details Page.html` + `collection-details-app.jsx`.

## Load order (per page)
```html
<link rel="stylesheet" href="kn-header.css">            <!-- after DS token/style links -->
<script type="text/babel" src="tweaks-panel.jsx"></script>
<script type="text/babel" src="kn-header.jsx"></script> <!-- after React + DS bundle -->
<script type="text/babel" src="<page>.jsx"></script>
```
```jsx
<window.KnHeader.Header theme={theme} onToggleTheme={setTheme}
  active="dobirky"            // 'home' | 'dobirky' | 'bazhanky' | 'about' | undefined
  wishCount={saved.size} />   // optional; falls back to localStorage 'kn_wishlist'
```

## Desktop (>768px) — frozen anatomy
Sticky (`top:0`, `z-index:100`), `background: var(--bg)`, 1px `--border` bottom hairline.
Row 72px inside `.knh__page` (`max-width: var(--container-wide,1680px)`, `padding: 0 var(--gutter,32px)`):
1. **Logo** 64px (`assets/logo/knyhovo-logo-{light|dark}.png`, `margin-left:-9px`), links to Homepage.
2. **Search capsule** — `flex: 0 1 440px`, 44px tall, `--surface` bg + `--border`, radius 12px,
   Lucide `search` icon left, placeholder **«Пошук книги, автора або ISBN»**, clear «×» appears with input.
   Focus = `:focus-within` on the wrapper only (`--accent` border + `--focus-ring`); the input never
   draws its own outline — **no double rings** (same recipe as the Collections genre search).
   Submit → `Search Results Page.html?q=…` (Search Results seeds its query from `?q`).
   The capsule is a quiet part of the header, never the dominant element.
3. **Nav** (`margin-left:auto`, gap 28): Головна · Добірки · Бажанки (+rose count badge) · Про нас.
   Link recipe: 15.5px/500 `--text-body`, hover/active `--accent`, active weight 600.
4. **Actions**: DS `ThemeToggle` + secondary `kn-btn` «Увійти» (logged-in: «Профіль» with `user` icon).

Mid-width (≤1180px): gaps tighten, search min-width drops to 150px — one row, no overflow.

## Mobile (≤768px) — frozen anatomy
Row 56px: logo 42px left · right cluster of three 44px icon buttons — **wishlist** (heart + rose
count bubble), **search**, **burger** (Lucide `menu`). Theme toggle lives in the drawer, not the bar.

- **Search overlay** (`.knh-so`): tap search → page dims (`color-mix(var(--text) 45%, transparent)`),
  a bar drops from the top: 52px capsule (search icon · input · 44px clear «×») + accent «Знайти»
  submit button. Autofocus; Escape/backdrop close; body scroll locked.
- **Menu drawer** (`.knh-dr`): right sheet `min(320px, 86vw)` on `--surface`, hairline left border.
  Head «Меню» (Lora 18) + close ×. Nav rows 50px, hairline-separated, active = accent.
  Logged-out: Головна · Добірки · Про нас + full-width secondary «Увійти». Logged-in: + Бажанки
  (badge), Профіль, Вийти (muted, `log-out` icon). Bottom row: «Тема» + DS ThemeToggle.
  In the prototype «Увійти»/«Вийти» flip the shared auth state; in production «Увійти» opens the
  Magic Link login modal (frozen ML spec) and «Вийти» calls the auth API.
- Animations: 200–260ms ease-out fade/slide, disabled under `prefers-reduced-motion`.

## Shared auth state (prototype)
`window.KnHeader.useAuth()` → `[loggedIn, setLoggedIn]`, persisted in localStorage `kn-logged-in`,
synced across pages via a `kn-auth-change` event. Every integrated page exposes a Tweaks toggle
(«Акаунт → Користувач увійшов»). In production replace this hook with the real session.

## Ripple effects already applied (do not re-derive)
- Collections mobile secondary nav (`.cnav` dropdowns «Розділи/Жанри») is UNCHANGED and stays
  below the header; `.cnav { top: 56px }` mobile / `72px` desktop still matches the header heights.
- Collection Details sort bar now sticks **below** the sticky header: `.cd-sortbar { top: 72px }`,
  `56px` at ≤768px.
- Homepage hero height math measures `.knh` (was `.site-header`); header renders outside `.page`
  (it carries its own `.knh__page` container with the same width tokens).
- Old `.site-header/.site-nav/.nav-link/.site-actions/.site-burger/.site-menu/.site-drawer` header
  CSS was deleted from all four pages. `.site-footer/.footer-*` rules remain.
- Nav labels unified: «Добірки» everywhere (Collections pages previously said «Колекції»;
  Homepage/Search previously had «Каталог»/«Знижки» — search reaches the catalog now).

## Regression rules
- Never give the input its own focus outline/box-shadow — ring lives on the wrapper only.
- All touch targets ≥44px (icon buttons, drawer rows, overlay clear button).
- Max one rose badge style (`--kn-rose` / fallback `#BC5A57` light · `#E48E8A` dark); never red.
- No emoji, no icon fonts — inline Lucide outline SVGs only (paths embedded in `kn-header.jsx`).
- Header must theme-follow via DS tokens; no hardcoded surface/text hex.
- Not-yet-designed destinations (Бажанки page, Про нас, Профіль) intentionally link to `#`.
