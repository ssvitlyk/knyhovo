/**
 * Client/server helper mirroring the API's `isSafeReturnTo`: only allow safe,
 * internal, same-origin paths as a post-login redirect target. Prevents
 * open-redirect via a crafted `?returnTo=` query param. The backend re-validates
 * independently — this is defence in depth, not the only check.
 */

const MAX_RETURN_TO_LENGTH = 2048;

/** True only for safe internal paths like `/wishlist?x=1#y`. */
export function isSafeReturnTo(path: string | null | undefined): path is string {
  if (typeof path !== 'string') return false;
  if (path.length === 0 || path.length > MAX_RETURN_TO_LENGTH) return false;
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//') || path.startsWith('/\\')) return false;
  if (path.includes('://')) return false;
  if (/[\s\\]/.test(path)) return false;
  return true;
}

/** Return `path` if it is a safe internal path, otherwise `fallback`. */
export function safeReturnTo(path: string | null | undefined, fallback = '/'): string {
  return isSafeReturnTo(path) ? path : fallback;
}
