import { cache } from 'react';
import { getBookDetails } from './book';

/**
 * Request-scoped memoized wrapper around {@link getBookDetails}. Both
 * `generateMetadata` and the page component fetch the same book; `cache()`
 * dedupes them into a single upstream request per render (the raw fetch uses an
 * `AbortController` signal, which defeats Next's native fetch dedupe).
 */
export const getBookDetailsCached = cache(getBookDetails);
