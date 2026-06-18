/** Result of a successful ISBN detection. */
export interface DetectedIsbn {
  readonly normalized: string;
  readonly kind: 'isbn-10' | 'isbn-13';
}

const STRIP_RE = /[\s\-–—]/g;
const ISBN_13_RE = /^(978|979)\d{10}$/;
const ISBN_10_RE = /^\d{9}[\dX]$/i;

/**
 * Client-side ISBN recognizer.
 *
 * Strips spaces, hyphens, and en/em dashes, then matches:
 * - ISBN-13: 978/979 prefix followed by 10 digits.
 * - ISBN-10: 9 digits followed by a digit or uppercase X.
 *
 * Checksum validation is intentionally omitted (MVP).
 * Returns `null` for any non-ISBN input.
 */
export function detectIsbn(input: string): DetectedIsbn | null {
  const stripped = input.replace(STRIP_RE, '');

  if (ISBN_13_RE.test(stripped)) {
    return { normalized: stripped, kind: 'isbn-13' };
  }

  if (ISBN_10_RE.test(stripped)) {
    return { normalized: stripped.slice(0, 9) + stripped[9].toUpperCase(), kind: 'isbn-10' };
  }

  return null;
}

/** Returns `true` when the input is recognisable as an ISBN-10 or ISBN-13. */
export function looksLikeIsbn(input: string): boolean {
  return detectIsbn(input) !== null;
}
