import { createHmac, createHash, randomInt, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-SHA256 hex of `code` keyed by `secret`.
 * Used to store login codes without plaintext — the secret prevents offline
 * rainbow-table attacks.
 */
export function hashCode(code: string, secret: string): string {
  return createHmac('sha256', secret).update(code).digest('hex');
}

/**
 * SHA-256 hex of `token`.
 * Session tokens are random enough that a plain hash is sufficient.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Compare two code hashes in constant time to prevent timing-oracle attacks.
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/**
 * Generate a cryptographically random 6-digit numeric code (zero-padded).
 * e.g. "042789".
 */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Generate a cryptographically random opaque session token (base64url, 32 bytes).
 */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}
