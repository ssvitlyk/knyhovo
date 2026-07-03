/**
 * Gradient cover placeholder for the Featured card — ported 1:1 from the frozen
 * `Collections Landing Page` `BookCover`. The frozen design uses deterministic
 * hue-seeded gradients (no real cover images) for the fanned featured stack.
 */
export function BookCover({ seed = 0 }: { readonly seed?: number }): React.JSX.Element {
  const hues = [28, 220, 145, 200, 320, 42, 170, 260];
  const hue = hues[seed % hues.length];
  const h = `oklch(65% 0.12 ${hue})`;
  const hl = `oklch(75% 0.09 ${hue})`;
  return (
    <div
      className="feat-cover__art"
      style={{ background: `linear-gradient(145deg, ${h} 0%, ${hl} 100%)` }}
      aria-hidden="true"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    </div>
  );
}
