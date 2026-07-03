# Knyhovo · W8 — Knyhovyk AI Assistant UX Foundation (design only)

> **Status: AI-ready assistant foundation.** Authored 2026-06-17. Defines how the mascot
> **Knyhovyk** evolves from a static character (Level 0) into a rule-based (1), data-informed (2),
> and AI-powered (3) assistant **without changing identity**. Does **not** design chat UI, prompts,
> agents, RAG, model routing or any backend, and does **not** redesign any frozen Knyhovo screen
> (Search, Book Details, Price History, Wishlist, Alerts, Store Offers). Composes DS v1.0 tokens +
> `window.KnyhovoDesignSystem_9fa616` only — no new colours, type, radii or shadows.

## Core principle
**Knyhovo is the platform; Knyhovyk is the guide.** The user must always feel *"Книговик допоміг мені"*,
never *"сайт сказав мені"*. The future AI is a continuation of Knyhovyk — the same character, smarter —
not a new product. Role split everywhere: **Knyhovo** шукає / перевіряє / моніторить ціни (tool, «ми»);
**Книговик** радить / стежить / підказує / пояснює (helper, «я»).

## Files (8 docs + shared support)
- **`Manifesto.html`** — Knyhovyk Manifesto: identity, the promise, Level 0→3 evolution, beliefs, never-does.
- **`Personality.html`** — Personality Spec: traits, voice & tone, when-speaks/silent, uncertainty behaviour,
  recommendation style, vocabulary, what to avoid.
- **`Character System.html`** — Knyhovyk is a CHARACTER, not an illustration. Identity invariants, four
  presence forms (full scene · avatar · voice-only · icon), future forms, form-selection matrix, rules for
  new forms, recognizability DNA. Identity is **not** bound to chair/lamp/cup/magnifier/lantern.
- **`Presence Map.html`** — every surface × required/optional/hidden × form × role × activation level.
- **`Recommendation Framework.html`** — 9 patterns (anatomy + trigger/verdict/reason/confidence/tone),
  colour rules, **Desktop examples** and **Mobile examples** placed on frozen surfaces.
- **`Trust Model.html`** — how Knyhovyk earns trust, can-be-wrong handling, the four confidence levels
  (visual spec), visible reasoning, trust principles.
- **`Copy System.html`** — role split, message structure, per-surface copy rules, **Do/Don't library**, details.
- **`AI Readiness.html`** — progressive intelligence (Stage 1→3: behaviour/capabilities/limits/UX),
  **AI Use-Case Matrix** (appropriate / з обережністю / unsupported / inappropriate-dangerous),
  assistant surfaces (proactive / on-demand / never), and the **AI-Readiness decision framework** (6 checks per feature).
- **Support:** `ka.css` (doc layout + the additive "assistant chrome" component layer — advice block,
  confidence meter, avatar crop, forms, example surfaces, phone frame), `theme.js` (light/dark + logo +
  `--ka-face` avatar source + `[data-mascot]` swap), `nav.js` (shared cross-document footer nav).

## The 12 deliverables → where they live
Manifesto · Personality Spec · Trust Model · Presence Map · Recommendation Framework · AI Use-Case Matrix
(AI Readiness §02) · Copywriting System · Do/Don't Library (Copy System §04) · Character System ·
Desktop Examples (Rec. Framework §04) · Mobile Examples (Rec. Framework §05) · AI Readiness Framework
(AI Readiness §04).

## Assistant chrome (the only new components — additive, around frozen screens)
- `.ka-advice` (+ `--good` / `--voice` / `--inline`) — the advice block: **verdict → reason → confidence**,
  optional CTA. Green ONLY for positive value; neutral otherwise; **never red**; max one badge.
- `.ka-conf` — neutral (non-coloured) confidence meter: High (3) / Medium (2) / Low (1) / None (0, no fill).
- `.ka-av` — circular avatar cropped from the approved mascot (never redrawn); `.ka-mascot` full scene
  (soft-masked, empty/onboarding only); `.ka-voice` voice-only marker; `.ka-form__icon` icon-only.

## Frozen rules this foundation depends on (inherited — do not contradict)
- Green = positive user value only; rises stay muted; never red (Price History v1.2.1 / Wishlist v1.0).
- Price `240 ₴` (space before ₴); store name after «·», always `--text-muted`.
- «типова ціна» (never «звичайна»); highest price hidden.
- Unavailable = utilitarian, **no mascot** (Wishlist v1.0).
- Mascot full scene only in empty / onboarding / first-book; one Knyhovyk per screen.

## Do not modify
The core principle (Knyhovo = platform, Книговик = guide), the role split, the verdict→reason→confidence
structure, the four confidence levels and their neutral indicator, the green-only-for-positive / never-red
colour discipline, the four character forms + form-selection rules, the "explain every recommendation" rule,
"silence is a valid decision", the Level 0→3 evolution ladder, the AI-readiness 6-check framework, and all
protected v1.0 brand assets (logo, mascot — never redrawn or regenerated). Future work may extend
functionality but must not redesign these foundations.

## Out of scope (explicit)
Chat UI, prompts, agents, model routing, RAG, vector search, backend systems — and any redesign of
Search, Book Details, Price History, Wishlist, Alerts or Store Offers.
