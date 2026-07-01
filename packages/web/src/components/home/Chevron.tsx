/**
 * See-all chevron — a plain chevron-right used on mobile section title rows
 * (replaces the desktop ghost CTA on small screens). Static inline SVG, mirrors
 * `homepage.jsx` `Chevron`.
 */
export function Chevron(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
