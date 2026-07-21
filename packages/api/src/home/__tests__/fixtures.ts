/**
 * Test fixtures for the Home route/service tests. Re-exports the collections
 * fake-prisma helpers (single source of truth for the in-memory DB) and adds
 * the small auth machinery needed to exercise `isWishlisted` decoration —
 * mirroring `collections/__tests__/wishlisted.route.test.ts`.
 */
export {
  emptyDb,
  makeFakePrisma,
  book,
  listing,
  collection,
  itemsFor,
} from '../../collections/__tests__/fake-prisma.js';
export type { FakeDb } from '../../collections/__tests__/fake-prisma.js';

import type { makeFakePrisma } from '../../collections/__tests__/fake-prisma.js';
import type { AuthDeps } from '../../auth/service.js';
import type { AuthConfig } from '../../auth/config.js';
import type { Mailer } from '../../auth/mailer.js';
import { hashToken } from '../../auth/crypto.js';

/** Hash a raw session token the same way the auth layer does (for seeding `db.sessions`). */
export function hashTokenSeed(token: string): string {
  return hashToken(token);
}

class FakeMailer implements Mailer {
  async sendMagicLink(): Promise<void> {}
  async sendLoginCode(): Promise<void> {}
}

/** Minimal AuthDeps for session resolution — sessions are looked up in the fake DB by token hash. */
export function makeAuthDeps(prisma: ReturnType<typeof makeFakePrisma>, now: Date): AuthDeps {
  const config: AuthConfig = {
    secret: 'test-secret',
    cookieSecure: false,
    codeTtlMs: 10 * 60_000,
    magicLinkTtlMs: 30 * 60_000,
    sessionTtlMs: 30 * 24 * 60 * 60_000,
    rateWindowMs: 15 * 60_000,
    maxCodesPerWindow: 5,
    maxVerifyAttempts: 5,
    resendApiKey: null,
    fromEmail: 'Knyhovo <test@example.com>',
    linkBaseUrl: 'https://knyhovo.test',
    allowedEmails: null,
  };
  return {
    prisma,
    mailer: new FakeMailer(),
    config,
    now: () => now,
    generateCode: () => '123456',
    generateToken: () => 'unused-in-read-path',
  };
}
