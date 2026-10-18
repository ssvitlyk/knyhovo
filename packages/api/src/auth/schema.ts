import { z } from 'zod';
import { parseOrThrow } from '../http/parse.js';

/**
 * Validation schemas for auth endpoints.
 * Email is normalised (trimmed + lowercased) at the API boundary here.
 */

const emailField = z.string().trim().toLowerCase().email();

const requestCodeBody = z.object({
  email: emailField,
});

const verifyCodeBody = z.object({
  email: emailField,
  code: z.string().regex(/^\d{6}$/, 'code must be exactly 6 digits'),
});

const magicLinkBody = z.object({
  email: emailField,
  // Optional post-login redirect target; semantic safety is enforced separately
  // via isSafeReturnTo (internal-only path) — here we only bound the length.
  returnTo: z.string().trim().max(2048).optional(),
});

const verifyLinkBody = z.object({
  token: z.string().trim().min(1).max(512),
});

/**
 * Parse `requestCodeBody`; throw ValidationError on failure.
 */
export function parseRequestCodeBody(input: unknown): z.infer<typeof requestCodeBody> {
  return parseOrThrow(requestCodeBody, input, 'Invalid request body');
}

/**
 * Parse `verifyCodeBody`; throw ValidationError on failure.
 */
export function parseVerifyCodeBody(input: unknown): z.infer<typeof verifyCodeBody> {
  return parseOrThrow(verifyCodeBody, input, 'Invalid request body');
}

/**
 * Parse `magicLinkBody`; throw ValidationError on failure.
 */
export function parseMagicLinkBody(input: unknown): z.infer<typeof magicLinkBody> {
  return parseOrThrow(magicLinkBody, input, 'Invalid request body');
}

/**
 * Parse `verifyLinkBody`; throw ValidationError on failure.
 */
export function parseVerifyLinkBody(input: unknown): z.infer<typeof verifyLinkBody> {
  return parseOrThrow(verifyLinkBody, input, 'Invalid request body');
}
