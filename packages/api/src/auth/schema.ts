import { z } from 'zod';
import { ValidationError } from '../errors.js';

/**
 * Validation schemas for auth endpoints.
 * Email is normalised (trimmed + lowercased) at the API boundary here.
 */

const emailField = z.string().trim().toLowerCase().email();

export const requestCodeBody = z.object({
  email: emailField,
});

export const verifyCodeBody = z.object({
  email: emailField,
  code: z.string().regex(/^\d{6}$/, 'code must be exactly 6 digits'),
});

export const magicLinkBody = z.object({
  email: emailField,
  // Optional post-login redirect target; semantic safety is enforced separately
  // via isSafeReturnTo (internal-only path) — here we only bound the length.
  returnTo: z.string().trim().max(2048).optional(),
});

export const verifyLinkBody = z.object({
  token: z.string().trim().min(1).max(512),
});

export type RequestCodeBody = z.infer<typeof requestCodeBody>;
export type VerifyCodeBody = z.infer<typeof verifyCodeBody>;
export type MagicLinkBody = z.infer<typeof magicLinkBody>;
export type VerifyLinkBody = z.infer<typeof verifyLinkBody>;

/**
 * Parse `requestCodeBody`; throw ValidationError on failure.
 */
export function parseRequestCodeBody(input: unknown): RequestCodeBody {
  const result = requestCodeBody.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    const message = issue ? `${path ? `${path}: ` : ''}${issue.message}` : 'Invalid request body';
    throw new ValidationError(message);
  }
  return result.data;
}

/**
 * Parse `verifyCodeBody`; throw ValidationError on failure.
 */
export function parseVerifyCodeBody(input: unknown): VerifyCodeBody {
  const result = verifyCodeBody.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    const message = issue ? `${path ? `${path}: ` : ''}${issue.message}` : 'Invalid request body';
    throw new ValidationError(message);
  }
  return result.data;
}

/**
 * Parse `magicLinkBody`; throw ValidationError on failure.
 */
export function parseMagicLinkBody(input: unknown): MagicLinkBody {
  const result = magicLinkBody.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    const message = issue ? `${path ? `${path}: ` : ''}${issue.message}` : 'Invalid request body';
    throw new ValidationError(message);
  }
  return result.data;
}

/**
 * Parse `verifyLinkBody`; throw ValidationError on failure.
 */
export function parseVerifyLinkBody(input: unknown): VerifyLinkBody {
  const result = verifyLinkBody.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    const message = issue ? `${path ? `${path}: ` : ''}${issue.message}` : 'Invalid request body';
    throw new ValidationError(message);
  }
  return result.data;
}
