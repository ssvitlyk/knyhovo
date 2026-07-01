/**
 * Full-page navigation helper. A hard navigation (not client-side routing) is
 * used after auth transitions (magic-link verify, logout) so the root layout —
 * and therefore the auth-aware SiteHeader — re-renders on the server with the
 * updated session cookie. Extracted so it can be mocked in tests.
 */
export function hardNavigate(url: string): void {
  window.location.assign(url);
}
