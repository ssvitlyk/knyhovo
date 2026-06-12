import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../app.js';
import type { AuthDeps } from '../service.js';
import type { AuthConfig } from '../config.js';
import type { Mailer } from '../mailer.js';
import { hashCode, hashToken } from '../crypto.js';

// ── Fixed test constants ──────────────────────────────────────────────────────

const TEST_SECRET = 'test-secret-fixed';
const FIXED_NOW = new Date('2026-01-01T00:00:00Z');
const TEST_EMAIL = 'test@example.com';
const TEST_CODE = '123456';
const TEST_TOKEN = 'test-token-abc-fixed-32bytes-padded__';
const CODE_TTL_MS = 10 * 60_000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;

const TEST_CONFIG: AuthConfig = {
  secret: TEST_SECRET,
  cookieSecure: false,
  codeTtlMs: CODE_TTL_MS,
  sessionTtlMs: SESSION_TTL_MS,
  rateWindowMs: 15 * 60_000,
  maxCodesPerWindow: 5,
  maxVerifyAttempts: 5,
};

// ── Fake Mailer ───────────────────────────────────────────────────────────────

class FakeMailer implements Mailer {
  public lastEmail: string | null = null;
  public lastCode: string | null = null;

  async sendLoginCode(email: string, code: string): Promise<void> {
    this.lastEmail = email;
    this.lastCode = code;
  }
}

// ── Fake Prisma ───────────────────────────────────────────────────────────────
// Stateful in-memory store to keep tests deterministic without a real DB.

interface UserRow {
  id: string;
  email: string;
  createdAt: Date;
}

interface LoginCodeRow {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  attempts: number;
  createdAt: Date;
}

interface SessionRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

let _users: UserRow[] = [];
let _loginCodes: LoginCodeRow[] = [];
let _sessions: SessionRow[] = [];
let _idCounter = 0;
function nextId(): string {
  return `fake-id-${++_idCounter}`;
}

function makeFakePrisma(): PrismaClient {
  const db = {
    user: {
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: { email: string };
          update: object;
          create: { email: string };
        }) => {
          let user = _users.find((u) => u.email === where.email);
          if (!user) {
            user = { id: nextId(), email: create.email, createdAt: FIXED_NOW };
            _users.push(user);
          }
          return user;
        },
      ),
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) => {
        return _users.find((u) => u.email === where.email) ?? null;
      }),
    },
    loginCode: {
      count: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; createdAt?: { gte: Date } };
        }) => {
          return _loginCodes.filter((lc) => {
            if (lc.userId !== where.userId) return false;
            if (where.createdAt?.gte && lc.createdAt < where.createdAt.gte) return false;
            return true;
          }).length;
        },
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: { userId: string; codeHash: string; expiresAt: Date };
        }) => {
          const row: LoginCodeRow = {
            id: nextId(),
            userId: data.userId,
            codeHash: data.codeHash,
            expiresAt: data.expiresAt,
            consumedAt: null,
            attempts: 0,
            createdAt: FIXED_NOW,
          };
          _loginCodes.push(row);
          return row;
        },
      ),
      findFirst: vi.fn(
        async ({
          where,
          orderBy,
        }: {
          where: { userId: string; consumedAt: null };
          orderBy?: { createdAt?: 'desc' };
        }) => {
          let codes = _loginCodes.filter(
            (lc) => lc.userId === where.userId && lc.consumedAt === null,
          );
          if (orderBy?.createdAt === 'desc') {
            codes = [...codes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          }
          return codes[0] ?? null;
        },
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { attempts?: { increment: number }; consumedAt?: Date };
        }) => {
          const lc = _loginCodes.find((l) => l.id === where.id);
          if (!lc) throw new Error(`LoginCode not found: ${where.id}`);
          if (data.attempts?.increment !== undefined) {
            lc.attempts += data.attempts.increment;
          }
          if (data.consumedAt !== undefined) {
            lc.consumedAt = data.consumedAt;
          }
          return lc;
        },
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { userId: string; consumedAt: null; id?: { not: string } };
          data: { consumedAt?: Date };
        }) => {
          for (const lc of _loginCodes) {
            if (lc.userId !== where.userId) continue;
            if (lc.consumedAt !== null) continue;
            if (where.id?.not && lc.id === where.id.not) continue;
            if (data.consumedAt !== undefined) lc.consumedAt = data.consumedAt;
          }
          return { count: 0 };
        },
      ),
    },
    session: {
      create: vi.fn(
        async ({
          data,
        }: {
          data: { userId: string; tokenHash: string; expiresAt: Date };
        }) => {
          const row: SessionRow = {
            id: nextId(),
            userId: data.userId,
            tokenHash: data.tokenHash,
            expiresAt: data.expiresAt,
            createdAt: FIXED_NOW,
          };
          _sessions.push(row);
          return row;
        },
      ),
      findFirst: vi.fn(
        async ({
          where,
          include,
        }: {
          where: { tokenHash: string; expiresAt: { gt: Date } };
          include?: { user?: boolean };
        }) => {
          const session = _sessions.find(
            (s) => s.tokenHash === where.tokenHash && s.expiresAt > where.expiresAt.gt,
          );
          if (!session) return null;
          if (include?.user) {
            const user = _users.find((u) => u.id === session.userId);
            return { ...session, user: user ?? null };
          }
          return session;
        },
      ),
      deleteMany: vi.fn(
        async ({
          where,
        }: {
          where:
            | { tokenHash: string }
            | { expiresAt: { lt: Date } };
        }) => {
          if ('tokenHash' in where) {
            _sessions = _sessions.filter((s) => s.tokenHash !== where.tokenHash);
          } else if ('expiresAt' in where) {
            _sessions = _sessions.filter((s) => s.expiresAt >= where.expiresAt.lt);
          }
          return { count: 0 };
        },
      ),
    },
  };
  return db as unknown as PrismaClient;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDeps(overrides: Partial<AuthDeps> = {}): {
  deps: AuthDeps;
  prisma: PrismaClient;
  mailer: FakeMailer;
} {
  const mailer = new FakeMailer();
  const prisma = makeFakePrisma();
  const deps: AuthDeps = {
    prisma,
    mailer,
    config: TEST_CONFIG,
    now: () => FIXED_NOW,
    generateCode: () => TEST_CODE,
    generateToken: () => TEST_TOKEN,
    ...overrides,
  };
  return { deps, prisma, mailer };
}

function appWith(deps: AuthDeps): ReturnType<typeof buildApp> {
  const { prisma } = deps;
  return buildApp(prisma, deps);
}

beforeEach(() => {
  _users = [];
  _loginCodes = [];
  _sessions = [];
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/request-code', () => {
  it('creates user + login code (hashed, not plaintext) → 200 {ok:true}, mailer received code', async () => {
    const { deps, mailer } = makeDeps();
    const app = appWith(deps);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-code',
      payload: { email: TEST_EMAIL },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(mailer.lastEmail).toBe(TEST_EMAIL);
    expect(mailer.lastCode).toBe(TEST_CODE);

    // The stored hash must not be the plaintext code
    expect(_loginCodes).toHaveLength(1);
    expect(_loginCodes[0]?.codeHash).not.toBe(TEST_CODE);
    expect(_loginCodes[0]?.codeHash).toBe(hashCode(TEST_CODE, TEST_SECRET));
    expect(_users).toHaveLength(1);
    expect(_users[0]?.email).toBe(TEST_EMAIL);
  });

  it('accepts email with uppercase letters and normalises to lowercase', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);

    await app.inject({
      method: 'POST',
      url: '/api/auth/request-code',
      payload: { email: 'User@EXAMPLE.COM' },
    });

    expect(_users[0]?.email).toBe('user@example.com');
  });

  it('does not duplicate user on second request-code call', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);

    await app.inject({
      method: 'POST',
      url: '/api/auth/request-code',
      payload: { email: TEST_EMAIL },
    });
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/auth/request-code',
      payload: { email: TEST_EMAIL },
    });

    expect(res2.statusCode).toBe(200);
    expect(_users).toHaveLength(1);
    expect(_loginCodes).toHaveLength(2);
  });

  it('returns 429 RATE_LIMITED when limit exceeded', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);

    // Issue 5 codes (the limit)
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/request-code',
        payload: { email: TEST_EMAIL },
      });
    }

    // 6th should be rate-limited
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-code',
      payload: { email: TEST_EMAIL },
    });

    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe('RATE_LIMITED');
  });

  it('counts consumed/invalidated codes in the rate window', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);

    // Request 3 codes
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/request-code',
        payload: { email: TEST_EMAIL },
      });
    }

    // Manually mark them consumed to simulate prior verify flows
    for (const lc of _loginCodes) {
      lc.consumedAt = FIXED_NOW;
    }

    // Should still count the 3 consumed codes + 2 more = 5 = limit
    for (let i = 0; i < 2; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/request-code',
        payload: { email: TEST_EMAIL },
      });
    }

    // 6th should be rate-limited (3 consumed + 2 new = 5 total, so 6th hits limit)
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-code',
      payload: { email: TEST_EMAIL },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe('RATE_LIMITED');
  });

  it('returns 400 VALIDATION_ERROR for invalid email', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-code',
      payload: { email: 'not-an-email' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/verify-code', () => {
  async function seedUserWithCode(app: ReturnType<typeof buildApp>): Promise<void> {
    await app.inject({
      method: 'POST',
      url: '/api/auth/request-code',
      payload: { email: TEST_EMAIL },
    });
  }

  it('correct code → 200 {user} + Set-Cookie kn_session (httpOnly), session created', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);
    await seedUserWithCode(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-code',
      payload: { email: TEST_EMAIL, code: TEST_CODE },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { user: { id: string; email: string; createdAt: string } };
    expect(body.user.email).toBe(TEST_EMAIL);
    expect(body.user.createdAt).toBe(FIXED_NOW.toISOString());

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    expect(cookieStr).toContain('kn_session=');
    expect(cookieStr).toContain('HttpOnly');

    expect(_sessions).toHaveLength(1);
    expect(_sessions[0]?.tokenHash).toBe(hashToken(TEST_TOKEN));
  });

  it('wrong code → 401 AUTH_INVALID_CODE, no cookie', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);
    await seedUserWithCode(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-code',
      payload: { email: TEST_EMAIL, code: '000000' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_INVALID_CODE');
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeUndefined();
    expect(_sessions).toHaveLength(0);
  });

  it('expired code → 401 AUTH_INVALID_CODE', async () => {
    // Request code at FIXED_NOW, then verify with now > expiresAt
    const nowFn = vi.fn(() => FIXED_NOW);
    const { deps } = makeDeps({ now: nowFn });
    const app = appWith(deps);
    await seedUserWithCode(app);

    // Advance clock past TTL
    const expiredNow = new Date(FIXED_NOW.getTime() + CODE_TTL_MS + 1);
    nowFn.mockReturnValue(expiredNow);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-code',
      payload: { email: TEST_EMAIL, code: TEST_CODE },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_INVALID_CODE');
  });

  it('consumed/reused code → 401', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);
    await seedUserWithCode(app);

    // First verify succeeds
    await app.inject({
      method: 'POST',
      url: '/api/auth/verify-code',
      payload: { email: TEST_EMAIL, code: TEST_CODE },
    });

    // Manually un-consume so findActiveLoginCode finds it again but consumedAt is set
    // (In reality findActiveLoginCode filters consumedAt: null so it won't find it)
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-code',
      payload: { email: TEST_EMAIL, code: TEST_CODE },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_INVALID_CODE');
  });

  it('after >5 attempts → 401, code invalidated', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);
    await seedUserWithCode(app);

    // 5 wrong attempts — each increments attempts; 5th attempt (attempts goes from 4→5, >= maxVerifyAttempts=5 triggers invalidation)
    for (let i = 0; i < 5; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-code',
        payload: { email: TEST_EMAIL, code: '000000' },
      });
      expect(r.statusCode).toBe(401);
    }

    // The code should now be consumed/invalidated
    const lc = _loginCodes[0];
    expect(lc?.consumedAt).not.toBeNull();

    // Even with correct code, no active code should be found
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-code',
      payload: { email: TEST_EMAIL, code: TEST_CODE },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 VALIDATION_ERROR for non-6-digit code', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-code',
      payload: { email: TEST_EMAIL, code: 'abc' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for bad email', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-code',
      payload: { email: 'bad', code: TEST_CODE },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/auth/me', () => {
  async function loginAndGetCookie(app: ReturnType<typeof buildApp>): Promise<string> {
    await app.inject({
      method: 'POST',
      url: '/api/auth/request-code',
      payload: { email: TEST_EMAIL },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-code',
      payload: { email: TEST_EMAIL, code: TEST_CODE },
    });
    const setCookie = res.headers['set-cookie'];
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : String(setCookie);
    // Extract "kn_session=<value>" part
    const match = /kn_session=([^;]+)/.exec(cookieStr ?? '');
    return match ? `kn_session=${match[1]}` : '';
  }

  it('valid cookie → 200 {user}', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);
    const cookie = await loginAndGetCookie(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { user: { email: string } };
    expect(body.user.email).toBe(TEST_EMAIL);
  });

  it('no cookie → 401 AUTH_REQUIRED', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);

    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_REQUIRED');
  });

  it('invalid token → 401 AUTH_REQUIRED', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: 'kn_session=bogus-token' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_REQUIRED');
  });

  it('expired session → 401 AUTH_REQUIRED', async () => {
    const nowFn = vi.fn(() => FIXED_NOW);
    const { deps } = makeDeps({ now: nowFn });
    const app = appWith(deps);
    const cookie = await loginAndGetCookie(app);

    // Advance clock past session TTL
    nowFn.mockReturnValue(new Date(FIXED_NOW.getTime() + SESSION_TTL_MS + 1));

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_REQUIRED');
  });
});

describe('POST /api/auth/logout', () => {
  async function loginAndGetCookie(app: ReturnType<typeof buildApp>): Promise<string> {
    await app.inject({
      method: 'POST',
      url: '/api/auth/request-code',
      payload: { email: TEST_EMAIL },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-code',
      payload: { email: TEST_EMAIL, code: TEST_CODE },
    });
    const setCookie = res.headers['set-cookie'];
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : String(setCookie);
    const match = /kn_session=([^;]+)/.exec(cookieStr ?? '');
    return match ? `kn_session=${match[1]}` : '';
  }

  it('logout → clears cookie + session deleted; subsequent me → 401', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);
    const cookie = await loginAndGetCookie(app);

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie },
    });

    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json()).toEqual({ ok: true });

    // Session should be deleted
    expect(_sessions).toHaveLength(0);

    // Subsequent me should return 401
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });
    expect(meRes.statusCode).toBe(401);
  });

  it('logout without session → 200 (idempotent)', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
