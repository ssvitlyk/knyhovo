import type { PrismaClient } from '@prisma/client';
import type { Mailer } from './mailer.js';
import type { AuthConfig } from './config.js';
import {
  upsertUserByEmail,
  findUserByEmail,
  countLoginCodesInWindow,
  createLoginCode,
  findActiveLoginCode,
  incrementLoginCodeAttempts,
  consumeLoginCode,
  invalidateOtherLoginCodes,
  countMagicLinkTokensInWindow,
  createMagicLinkToken,
  findMagicLinkTokenByHash,
  consumeMagicLinkToken,
  invalidateOtherMagicLinkTokens,
  createSession,
  findSessionByTokenHash,
  deleteSessionByTokenHash,
  deleteExpiredSessions,
} from './repository.js';
import { hashCode, hashToken, safeCompare } from './crypto.js';
import { buildMagicLinkUrl, sanitizeReturnTo } from './return-to.js';
import {
  InvalidCredentialsError,
  RateLimitedError,
} from '../errors.js';

/**
 * Injected dependencies for the auth service.
 * All dependencies are explicit so unit tests can inject deterministic fakes
 * without touching process.env, the real clock, or real crypto.
 */
export interface AuthDeps {
  readonly prisma: PrismaClient;
  readonly mailer: Mailer;
  readonly config: AuthConfig;
  /** Returns the current time. Injected so tests can control the clock. */
  readonly now: () => Date;
  /** Generate a 6-digit OTP. Injected so tests can use a fixed value. */
  readonly generateCode: () => string;
  /** Generate a random session token. Injected so tests can use a fixed value. */
  readonly generateToken: () => string;
}

/**
 * Request a one-time login code for the given email address.
 * Creates the user record if it does not yet exist, then sends the code via
 * the injected mailer. Enforces a rate limit on code requests per time window.
 */
export async function requestCode(deps: AuthDeps, email: string): Promise<void> {
  const { prisma, mailer, config, now, generateCode: genCode } = deps;
  const currentTime = now();

  const user = await upsertUserByEmail(prisma, email);

  // Housekeeping: remove stale sessions in the background.
  await deleteExpiredSessions(prisma, currentTime);

  // Rate-limit: count ALL codes (including consumed/expired) in the window.
  const windowStart = new Date(currentTime.getTime() - config.rateWindowMs);
  const codeCount = await countLoginCodesInWindow(prisma, user.id, windowStart);
  if (codeCount >= config.maxCodesPerWindow) {
    throw new RateLimitedError('Too many login attempts. Please try again later.');
  }

  const code = genCode();
  const expiresAt = new Date(currentTime.getTime() + config.codeTtlMs);
  await createLoginCode(prisma, {
    userId: user.id,
    codeHash: hashCode(code, config.secret),
    expiresAt,
  });

  await mailer.sendLoginCode(email, code);
}

/**
 * Request a Magic Link for the given email address — the primary web flow.
 * Creates the user record if needed, then emails a clickable login link.
 * Enforces the same per-window rate limit as OTP requests.
 *
 * `returnTo` is the page the user came from; it is sanitised to an internal
 * path before being stored, so the verify step can redirect safely.
 */
export async function requestMagicLink(
  deps: AuthDeps,
  email: string,
  returnTo: string | null,
): Promise<void> {
  const { prisma, mailer, config, now, generateToken: genToken } = deps;
  const currentTime = now();

  const user = await upsertUserByEmail(prisma, email);

  // Housekeeping: remove stale sessions in the background.
  await deleteExpiredSessions(prisma, currentTime);

  // Rate-limit: count ALL tokens (including consumed/expired) in the window.
  const windowStart = new Date(currentTime.getTime() - config.rateWindowMs);
  const tokenCount = await countMagicLinkTokensInWindow(prisma, user.id, windowStart);
  if (tokenCount >= config.maxCodesPerWindow) {
    throw new RateLimitedError('Too many login attempts. Please try again later.');
  }

  const token = genToken();
  const expiresAt = new Date(currentTime.getTime() + config.magicLinkTtlMs);
  await createMagicLinkToken(prisma, {
    userId: user.id,
    tokenHash: hashToken(token),
    returnTo: sanitizeReturnTo(returnTo),
    expiresAt,
  });

  const url = buildMagicLinkUrl(config.linkBaseUrl, token);
  await mailer.sendMagicLink(email, url);
}

/**
 * Verify a Magic Link token and issue a session.
 * Returns the session token, the authenticated user, and the (sanitised)
 * returnTo path. Always throws `InvalidCredentialsError` on any failure.
 * The token is single-use: it is consumed (and siblings invalidated) on success.
 */
export async function verifyMagicLink(
  deps: AuthDeps,
  token: string,
): Promise<{
  token: string;
  user: { id: string; email: string; createdAt: Date };
  returnTo: string | null;
}> {
  const { prisma, config, now, generateToken: genToken } = deps;
  const currentTime = now();

  const record = await findMagicLinkTokenByHash(prisma, hashToken(token));
  if (!record) throw new InvalidCredentialsError();
  if (record.consumedAt) throw new InvalidCredentialsError();
  if (record.expiresAt < currentTime) throw new InvalidCredentialsError();

  // Success — consume the used token and invalidate any siblings.
  await consumeMagicLinkToken(prisma, record.id, currentTime);
  await invalidateOtherMagicLinkTokens(prisma, record.userId, record.id, currentTime);

  // Issue a new session (same cookie/session mechanism as the OTP flow).
  const sessionToken = genToken();
  const tokenHash = hashToken(sessionToken);
  const sessionExpiresAt = new Date(currentTime.getTime() + config.sessionTtlMs);
  await createSession(prisma, { userId: record.userId, tokenHash, expiresAt: sessionExpiresAt });

  return {
    token: sessionToken,
    user: record.user,
    returnTo: sanitizeReturnTo(record.returnTo),
  };
}

/**
 * Verify an OTP code and issue a session token.
 * Returns the session token and the authenticated user on success.
 * Always throws `InvalidCredentialsError` on any failure (no oracle).
 */
export async function verifyCode(
  deps: AuthDeps,
  email: string,
  code: string,
): Promise<{ token: string; user: { id: string; email: string; createdAt: Date } }> {
  const { prisma, config, now, generateToken: genToken } = deps;
  const currentTime = now();

  const user = await findUserByEmail(prisma, email);
  if (!user) throw new InvalidCredentialsError();

  const loginCode = await findActiveLoginCode(prisma, user.id);
  if (!loginCode) throw new InvalidCredentialsError();

  if (loginCode.expiresAt < currentTime) throw new InvalidCredentialsError();

  // Increment before comparing — prevents hammering the code without each
  // attempt being counted.
  await incrementLoginCodeAttempts(prisma, loginCode.id);

  if (loginCode.attempts >= config.maxVerifyAttempts) {
    // This attempt exceeded the limit — consume/invalidate the code.
    await consumeLoginCode(prisma, loginCode.id, currentTime);
    throw new InvalidCredentialsError();
  }

  const expectedHash = hashCode(code, config.secret);
  if (!safeCompare(expectedHash, loginCode.codeHash)) {
    throw new InvalidCredentialsError();
  }

  // Success — consume used code and invalidate any others.
  await consumeLoginCode(prisma, loginCode.id, currentTime);
  await invalidateOtherLoginCodes(prisma, user.id, loginCode.id, currentTime);

  // Issue a new session.
  const token = genToken();
  const tokenHash = hashToken(token);
  const sessionExpiresAt = new Date(currentTime.getTime() + config.sessionTtlMs);
  await createSession(prisma, { userId: user.id, tokenHash, expiresAt: sessionExpiresAt });

  return { token, user };
}

/**
 * Resolve the user associated with a session token cookie.
 * Returns null if the token is missing, invalid, or expired.
 * This is the reusable guard helper for protected routes (e.g. Wishlist).
 */
export async function resolveSessionUser(
  deps: AuthDeps,
  tokenOrNull: string | null | undefined,
): Promise<{ id: string; email: string; createdAt: Date } | null> {
  if (!tokenOrNull) return null;
  const { prisma, now } = deps;
  const tokenHash = hashToken(tokenOrNull);
  const session = await findSessionByTokenHash(prisma, tokenHash, now());
  return session?.user ?? null;
}

/**
 * Invalidate the session for the given token.
 * Idempotent — does nothing if the token is absent or already gone.
 */
export async function logout(
  deps: AuthDeps,
  tokenOrNull: string | null | undefined,
): Promise<void> {
  if (!tokenOrNull) return;
  const { prisma } = deps;
  const tokenHash = hashToken(tokenOrNull);
  await deleteSessionByTokenHash(prisma, tokenHash);
}
