import type { PrismaClient } from '@prisma/client';

/**
 * Auth repository — pure Prisma data access. No business logic here.
 * All queries use parameterized Prisma calls (no raw SQL interpolation).
 */

// ── User ─────────────────────────────────────────────────────────────────────

/** Find or create a user by email. Returns the persisted user. */
export async function upsertUserByEmail(
  prisma: PrismaClient,
  email: string,
): Promise<{ id: string; email: string; createdAt: Date }> {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });
}

/** Find a user by email. Returns null if not found. */
export async function findUserByEmail(
  prisma: PrismaClient,
  email: string,
): Promise<{ id: string; email: string; createdAt: Date } | null> {
  return prisma.user.findUnique({ where: { email } });
}

// ── LoginCode ────────────────────────────────────────────────────────────────

/**
 * Count login codes created for `userId` since `since`.
 * Counts ALL rows — including consumed/expired — to enforce the rate limit.
 */
export async function countLoginCodesInWindow(
  prisma: PrismaClient,
  userId: string,
  since: Date,
): Promise<number> {
  return prisma.loginCode.count({
    where: {
      userId,
      createdAt: { gte: since },
    },
  });
}

/** Insert a new login code record. */
export async function createLoginCode(
  prisma: PrismaClient,
  data: { userId: string; codeHash: string; expiresAt: Date },
): Promise<void> {
  await prisma.loginCode.create({
    data: {
      userId: data.userId,
      codeHash: data.codeHash,
      expiresAt: data.expiresAt,
    },
  });
}

/**
 * Find the most recently created, unconsumed login code for `userId`.
 * Returns null if none exists.
 */
export async function findActiveLoginCode(
  prisma: PrismaClient,
  userId: string,
): Promise<{ id: string; codeHash: string; expiresAt: Date; attempts: number; consumedAt: Date | null } | null> {
  return prisma.loginCode.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

/** Increment the `attempts` counter on a login code. */
export async function incrementLoginCodeAttempts(
  prisma: PrismaClient,
  id: string,
): Promise<void> {
  await prisma.loginCode.update({
    where: { id },
    data: { attempts: { increment: 1 } },
  });
}

/** Mark a login code as consumed by setting `consumedAt`. */
export async function consumeLoginCode(
  prisma: PrismaClient,
  id: string,
  now: Date,
): Promise<void> {
  await prisma.loginCode.update({
    where: { id },
    data: { consumedAt: now },
  });
}

/** Consume (invalidate) all unconsumed login codes for a user except the given id. */
export async function invalidateOtherLoginCodes(
  prisma: PrismaClient,
  userId: string,
  exceptId: string,
  now: Date,
): Promise<void> {
  await prisma.loginCode.updateMany({
    where: { userId, consumedAt: null, id: { not: exceptId } },
    data: { consumedAt: now },
  });
}

/** Consume all unconsumed login codes for a user (used after rate-limit breach). */
export async function invalidateAllLoginCodes(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<void> {
  await prisma.loginCode.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: now },
  });
}

// ── MagicLinkToken ─────────────────────────────────────────────────────────────

/**
 * Count magic-link tokens created for `userId` since `since`.
 * Counts ALL rows — including consumed/expired — to enforce the rate limit.
 */
export async function countMagicLinkTokensInWindow(
  prisma: PrismaClient,
  userId: string,
  since: Date,
): Promise<number> {
  return prisma.magicLinkToken.count({
    where: {
      userId,
      createdAt: { gte: since },
    },
  });
}

/** Insert a new magic-link token record. */
export async function createMagicLinkToken(
  prisma: PrismaClient,
  data: { userId: string; tokenHash: string; returnTo: string | null; expiresAt: Date },
): Promise<void> {
  await prisma.magicLinkToken.create({
    data: {
      userId: data.userId,
      tokenHash: data.tokenHash,
      returnTo: data.returnTo,
      expiresAt: data.expiresAt,
    },
  });
}

/**
 * Find a magic-link token by its hash, with the associated user.
 * Returns null if no row matches. Expiry/consumed checks live in the service.
 */
export async function findMagicLinkTokenByHash(
  prisma: PrismaClient,
  tokenHash: string,
): Promise<
  | {
      id: string;
      userId: string;
      returnTo: string | null;
      expiresAt: Date;
      consumedAt: Date | null;
      user: { id: string; email: string; createdAt: Date };
    }
  | null
> {
  return prisma.magicLinkToken.findFirst({
    where: { tokenHash },
    include: { user: true },
  });
}

/** Mark a magic-link token as consumed by setting `consumedAt`. */
export async function consumeMagicLinkToken(
  prisma: PrismaClient,
  id: string,
  now: Date,
): Promise<void> {
  await prisma.magicLinkToken.update({
    where: { id },
    data: { consumedAt: now },
  });
}

/** Consume (invalidate) all unconsumed magic-link tokens for a user except the given id. */
export async function invalidateOtherMagicLinkTokens(
  prisma: PrismaClient,
  userId: string,
  exceptId: string,
  now: Date,
): Promise<void> {
  await prisma.magicLinkToken.updateMany({
    where: { userId, consumedAt: null, id: { not: exceptId } },
    data: { consumedAt: now },
  });
}

// ── Session ──────────────────────────────────────────────────────────────────

/** Insert a new session record. */
export async function createSession(
  prisma: PrismaClient,
  data: { userId: string; tokenHash: string; expiresAt: Date },
): Promise<void> {
  await prisma.session.create({
    data: {
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
    },
  });
}

/**
 * Find a non-expired session by token hash, with the associated user.
 * Returns null if the session does not exist or has expired.
 */
export async function findSessionByTokenHash(
  prisma: PrismaClient,
  tokenHash: string,
  now: Date,
): Promise<{ id: string; userId: string; user: { id: string; email: string; createdAt: Date; displayName: string | null } } | null> {
  return prisma.session.findFirst({
    where: {
      tokenHash,
      expiresAt: { gt: now },
    },
    include: { user: true },
  });
}

/** Delete a session by token hash (logout). */
export async function deleteSessionByTokenHash(
  prisma: PrismaClient,
  tokenHash: string,
): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash } });
}

/** Delete all sessions that have passed their expiry time (housekeeping). */
export async function deleteExpiredSessions(
  prisma: PrismaClient,
  now: Date,
): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
}
