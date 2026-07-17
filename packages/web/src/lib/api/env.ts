/**
 * Resolve the backend API origin for server-side fetches.
 *
 * Trims and treats an empty string the same as unset: a deployed environment
 * (e.g. Vercel) can have `API_BASE_URL` *created* with an empty value without
 * it being `undefined`, and `?? 'default'` does not catch that — an empty
 * string silently produced a relative fetch URL that Node's `fetch` rejects
 * before any network call is made.
 *
 * On Vercel a missing/empty value must fail loudly instead of silently
 * falling back to localhost, which the deployed server can't reach.
 */
export function apiBaseUrl(): string {
  const raw = process.env.API_BASE_URL;
  const trimmed = raw?.trim();
  if (!trimmed) {
    if (process.env.VERCEL) {
      throw new Error('API_BASE_URL is required for Vercel builds');
    }
    if (raw !== undefined) {
      console.error('[api] API_BASE_URL is set but empty — falling back to http://localhost:3000');
    }
    return 'http://localhost:3000';
  }
  return trimmed;
}
