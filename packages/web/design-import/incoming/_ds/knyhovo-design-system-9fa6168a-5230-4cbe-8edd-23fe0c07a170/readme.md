# Knyhovo Design System · v1.0

> **Status: frozen & ready for extension.** All tokens, components, mascot, logo and the approved hero layout are locked as v1.0. New work should extend — not alter — the foundations defined here.

**Knyhovo** is a Ukrainian book price comparison platform: it helps readers find the best price for a book across multiple bookstores (Yakaboo, Книгарня «Є», Rozetka, BookChef, Nash Format). The brand acts as a *friendly guide* that helps people discover books and buy them smarter.

**Brand personality:** warm, trustworthy, intelligent, slightly magical — without feeling childish. Premium editorial aesthetics combined with cozy storytelling. Calm, elegant, approachable; never playful-cartoonish or overly technical.

**Sources of truth** (in `uploads/`):
- `KNYHOVO_Design_System.png` — the approved design-system sheet (single source of truth for tokens, components, themes).
- `hero-light-approved.png` / `hero-dark-approved.png` — approved hero text layouts.
- Approved mascot reference illustrations (light + magnifying glass, dark + lantern) and final logo lockups (light/dark) — provided by the brand owner; stored in `assets/`.

---

## PROTECTED BRAND ASSETS — read first

1. **The logo lockups are final.** `assets/logo/knyhovo-logo-light.png` and `knyhovo-logo-dark.png` are fixed compositions. Never redraw the mascot icon, change the wordmark typography, adjust spacing, or generate "improved" versions. Allowed: uniform scaling, switching light/dark by background contrast, format export.
2. **The mascot "Knyhovyk" is a fixed character.** Same face, proportions, page shape, scarf, satchel, illustration style, warm paper texture — always. Only the **pose and accessory** may change: light theme → **magnifying glass** (`assets/mascot/mascot-magnifier.png`), dark theme → **lantern** (`assets/mascot/mascot-lantern.png`). Never redraw or regenerate him; place the approved PNGs.
3. When uncertainty exists, prioritize the approved assets and the design-system sheet over creativity.

---

## CONTENT FUNDAMENTALS

- **Language:** Ukrainian first. Brand name "Knyhovo" stays Latin even inside Ukrainian sentences ("Knyhovo знає.").
- **Voice:** a knowledgeable, warm guide. First person plural for the product ("Щодня знаходимо найнижчу ціну…"), direct address to the reader implied, not shouted.
- **Headlines:** a question + a confident short answer. Pattern: "Де купити цю книгу? *Knyhovo знає.*" — the answer is set in italic serif accent color.
- **Eyebrows:** uppercase, letter-spaced, dot-separated facts: "ПОРІВНЯННЯ ЦІН · 5 КНИГАРЕНЬ · ЩОДНЯ".
- **Casing:** sentence case everywhere except eyebrow labels and stat labels (uppercase xs).
- **Numbers as proof:** short stat clusters — "5 книгарень · 12k+ книг · щодня оновлення". Numerals in serif, labels uppercase.
- **CTAs:** single short verbs — "Знайти", "Увійти". No exclamation marks.
- **No emoji.** Warmth comes from the mascot and the palette, not emoticons.
- Prices formatted as "245 ₴" (space before ₴); store name follows after a middle dot or "·".

## VISUAL FOUNDATIONS

- **Color:** warm, natural tones only. Light theme = warm paper (`#F9F3ED` page, white cards) with **copper `#B56A2D`** accent; dark theme = near-black ink (`#0F0E0D`, surfaces `#1C1916`/`#2A2521`) with cream text `#EADFCF` and **light-orange `#F0A34A`** accent. Spot colors: forest green `#24513E` (the scarf), deep blue `#243C7A`. Semantic tokens (`--bg`, `--surface`, `--text`, `--accent`…) flip automatically via `data-theme="light|dark"` on `<html>`.
- **Type:** Lora (serif) for headings, display, prices, and the italic accent line; Inter (sans) for body, UI, menus, buttons. Display is large (clamp up to 72px), tight leading 1.08, −0.02em tracking. Body 16px/1.55.
- **Spacing:** generous whitespace, 4px grid (`--space-*`), sections `--section-y` (48–112px), container 1200–1320px.
- **Radii:** buttons & inputs 8px, cards 12px, hero search capsule 16px, chips & avatars pill.
- **Shadows:** soft, warm-brown tinted, low opacity (`--shadow-sm/md/lg`); primary buttons get a gentle copper/amber glow (`--shadow-accent`). Never harsh black shadows in light theme.
- **Backgrounds:** flat warm paper or ink; no gradients except the subtle glow baked into the dark mascot scene. Decorative botanical/leaf motifs exist only inside the approved illustrations — don't draw new ones.
- **Imagery:** the Knyhovyk illustrations (warm paper texture, soft 3D-ish storybook rendering). Light scenes on cream, dark scenes lit by lantern glow. No stock photos.
- **Animation:** calm and gentle — opacity/transform fades, 140–360ms, ease-out. No bounces, no infinite loops.
- **Hover:** links/nav → accent color; primary buttons → darker copper (light) / lighter amber (dark); cards → lift 2px + larger soft shadow; chips → accent border.
- **Press:** buttons translate down 1px and deepen one more step.
- **Borders:** hairlines `--border` (`#ECE1D2` light / `#322C26` dark); stronger `--border-strong` for outlined buttons.
- **Cards:** surface bg + 1px hairline border + 12px radius + `--shadow-sm`, hover to `--shadow-lg`.
- **Transparency/blur:** not part of the language — surfaces are opaque paper/ink.
- **Focus:** 3px soft accent ring (`--focus-ring`).

## ICONOGRAPHY

- Line icons, ~2px stroke, rounded caps/joins, tinted `--icon` (copper light / amber dark) or `--icon-muted`.
- The source sheet's icons match **Lucide**; load from CDN: `<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>` then `lucide.createIcons()`. Common icons: `search`, `book-open`, `tag`, `trending-up`, `bell`, `bookmark`, `star`, `log-out`, `sun`, `moon`. *(Substitution flag: Lucide is the closest CDN match to the sheet's icon style — supply source SVGs to replace if they differ.)*
- No icon font, no emoji, no unicode-as-icon. The mascot face avatar (`assets/avatar/`) doubles as the app icon/avatar fallback.

## THEMES

Set `data-theme="light"` or `data-theme="dark"` on `<html>`. Everything re-themes via tokens. Pair rules:
- logo: `knyhovo-logo-light.png` ↔ `knyhovo-logo-dark.png`
- mascot: magnifier (light) ↔ lantern (dark) — identical character, same scale & position
- accent: copper ↔ light-orange; both themes keep identical layout metrics.

## INDEX

- `styles.css` — global entry (imports everything below)
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `fonts.css` (Lora + Inter via Google Fonts), `base.css`
- `styles/components.css` — CSS classes behind the React components (`.kn-btn`, `.kn-field`, `.kn-book`…)
- `assets/` — `logo/` (approved lockups), `mascot/` (approved illustrations), `avatar/` (mascot face, light/dark)
- `components/buttons/` — **Button**; `components/forms/` — **Input, Chip, SearchBar**; `components/display/` — **Badge, BookCard, Avatar, ThemeToggle** (each with `.d.ts` + `.prompt.md` + specimen card)
- `ui_kits/website/` — homepage recreation (`index.html` + `Header.jsx`, `Hero.jsx`, `Sections.jsx`): approved 50/50 hero, popular books, footer; theme-switchable
- `guidelines/` — specimen cards for the Design System tab
- `SKILL.md` — agent skill entry point

**Fonts caveat:** the sheet names Lora & Inter; loaded from Google Fonts (`tokens/fonts.css`). Supply licensed font binaries to self-host if needed.
