# Knyhovo — project notes for Claude sessions

## Frozen pattern: Knyhovo Global Header v1.0

> **Approved + frozen 2026-07-04.** Supersedes every previous per-page header
> implementation (`.site-header` chrome on Homepage, Search Results, Collections
> Landing, Collection Details) and the "Header" sections of their earlier frozen
> specs. Footers are NOT touched — each page keeps its own frozen footer.

- **Files:** `kn-header.css` (all header styles: `.knh*`, `.knh-so*` search overlay, `.knh-dr*` drawer), `kn-header.jsx` (reference markup/behavior for the prototype — port markup + behavior only, never the prototype plumbing: no localStorage auth, no `window.KnHeader`), `Claude Code - Global Header.md` (canonical handoff spec).
- Implement the production header from these three files only — never from memory of older per-page header specs.

### Do not modify
Desktop/mobile anatomy, search capsule recipe, nav link set/order, drawer/overlay behavior, focus-ring-on-wrapper-only rule, rose badge recipe, icon set (inline SVGs only). Extend functionality (real session/wishlist data) only — never redesign.
