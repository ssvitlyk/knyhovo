import { cache } from 'react';
import { cookies } from 'next/headers';
import { me } from './auth';
import type { AlertDto, AuthUserDto } from './types';
import { alertContextFromWishlist, getWishlist } from './wishlist';

/**
 * Server-only helpers (Server Components / route handlers). Imports
 * `next/headers`, so never import this module from a client component.
 *
 * The `cache()` wrappers dedupe identical upstream calls within one render:
 * `SiteHeader` resolves `me` + `getWishlist` on every page and the pages
 * themselves need the same data (the raw fetches use an `AbortController`
 * signal, which defeats Next's native fetch dedupe — see `book-cache.ts`).
 * `cache()` keys primitives by value, so the cookie string is the key.
 */

/** The request's cookies serialised as a `Cookie` header value, for forwarding to the API. */
export async function getCookieHeader(): Promise<string> {
  return (await cookies()).toString();
}

/** Request-scoped memoized {@link me}. */
export const getSessionUser: (cookie: string) => Promise<AuthUserDto | null> = cache(
  (cookie: string) => me(cookie),
);

/** Request-scoped memoized {@link getWishlist}. */
export const getWishlistCached = cache((cookie: string) => getWishlist({ cookie }));

/** Request-scoped memoized {@link getBookAlertContext} (shares the wishlist fetch with the header). */
export async function getBookAlertContextCached({
  bookId,
  cookie,
}: {
  bookId: string;
  cookie: string;
}): Promise<{ inWishlist: boolean; alert: AlertDto | null }> {
  try {
    return alertContextFromWishlist(await getWishlistCached(cookie), bookId);
  } catch {
    return { inWishlist: false, alert: null };
  }
}
