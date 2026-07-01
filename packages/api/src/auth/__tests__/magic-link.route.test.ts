import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../app.js';
import type { AuthDeps } from '../service.js';
import type { AuthConfig } from '../config.js';
import type { Mailer } from '../mailer.js';
import { hashToken } from '../crypto.js';

// ── Fixed test constants ──────────────────────────────────────────────────────

const FIXED_NOW = new Date('2026-01-01T00:00:00Z');
const TEST_EMAIL = 'reader@example.com';
const TEST_TOKEN = 'magic-token-fixed-value-32bytes____';
const MAGIC_TTL_MS = 30 * 60_000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;

const TEST_CONFIG: AuthConfig = {
  secret: 'test-secret-fixed',
  cookieSecure: false,
  codeTtlMs: 10 * 60_000,
  magicLinkTtlMs: MAGIC_TTL_MS,
  sessionTtlMs: SESSION_TTL_MS,
  rateWindowMs: 15 * 60_000,
  maxCodesPerWindow: 5,
  maxVerifyAttempts: 5,
  resendApiKey: null,
  fromEmail: 'Knyhovo <test@example.com>',
  linkBaseUrl: 'https://knyhovo.test',
};

// ── Fake Mailer ───────────────────────────────────────────────────────────────

class FakeMailer implements Mailer {
  public lastEmail: string | null = null;
  public lastMagicLinkUrl: string | null = null;
  public lastCode: string | null = null;

  async sendMagicLink(email: string, url: string): Promise<void> {
    this.lastEmail = email;
    this.lastMagicLinkUrl = url;
  }
  async sendLoginCode(email: string, code: string): Promise<void> {
    this.lastEmail = email;
    this.lastCode = code;
  }
}

// ── Fake Prisma (in-memory) ─────────────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  createdAt: Date;
}
interface MagicTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  returnTo: string | null;
  expiresAt: Date;
  consumedAt: Date | null;
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
let _magic: MagicTokenRow[] = [];
let _sessions: SessionRow[] = [];
let _idCounter = 0;
function nextId(): string {
  return `fake-id-${++_idCounter}`;
}

function makeFakePrisma(): PrismaClient {
  const db = {
    user: {
      upsert: vi.fn(async ({ where, create }: { where: { email: string }; create: { email: string } }) => {
        let user = _users.find((u) => u.email === where.email);
        if (!user) {
          user = { id: nextId(), email: create.email, createdAt: FIXED_NOW };
          _users.push(user);
        }
        return user;
      }),
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) =>
        _users.find((u) => u.email === where.email) ?? null,
      ),
    },
    magicLinkToken: {
      count: vi.fn(async ({ where }: { where: { userId: string; createdAt?: { gte: Date } } }) =>
        _magic.filter((t) => {
          if (t.userId !== where.userId) return false;
          if (where.createdAt?.gte && t.createdAt < where.createdAt.gte) return false;
          return true;
        }).length,
      ),
      create: vi.fn(
        async ({ data }: { data: { userId: string; tokenHash: string; returnTo: string | null; expiresAt: Date } }) => {
          const row: MagicTokenRow = {
            id: nextId(),
            userId: data.userId,
            tokenHash: data.tokenHash,
            returnTo: data.returnTo,
            expiresAt: data.expiresAt,
            consumedAt: null,
            createdAt: FIXED_NOW,
          };
          _magic.push(row);
          return row;
        },
      ),
      findFirst: vi.fn(async ({ where, include }: { where: { tokenHash: string }; include?: { user?: boolean } }) => {
        const row = _magic.find((t) => t.tokenHash === where.tokenHash);
        if (!row) return null;
        if (include?.user) {
          const user = _users.find((u) => u.id === row.userId);
          return { ...row, user: user ?? null };
        }
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { consumedAt?: Date } }) => {
        const row = _magic.find((t) => t.id === where.id);
        if (!row) throw new Error(`MagicLinkToken not found: ${where.id}`);
        if (data.consumedAt !== undefined) row.consumedAt = data.consumedAt;
        return row;
      }),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { userId: string; consumedAt: null; id?: { not: string } };
          data: { consumedAt?: Date };
        }) => {
          for (const row of _magic) {
            if (row.userId !== where.userId) continue;
            if (row.consumedAt !== null) continue;
            if (where.id?.not && row.id === where.id.not) continue;
            if (data.consumedAt !== undefined) row.consumedAt = data.consumedAt;
          }
          return { count: 0 };
        },
      ),
    },
    session: {
      create: vi.fn(async ({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
        const row: SessionRow = {
          id: nextId(),
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          createdAt: FIXED_NOW,
        };
        _sessions.push(row);
        return row;
      }),
      findFirst: vi.fn(
        async ({ where, include }: { where: { tokenHash: string; expiresAt: { gt: Date } }; include?: { user?: boolean } }) => {
          const session = _sessions.find((s) => s.tokenHash === where.tokenHash && s.expiresAt > where.expiresAt.gt);
          if (!session) return null;
          if (include?.user) {
            const user = _users.find((u) => u.id === session.userId);
            return { ...session, user: user ?? null };
          }
          return session;
        },
      ),
      deleteMany: vi.fn(async ({ where }: { where: { tokenHash: string } | { expiresAt: { lt: Date } } }) => {
        if ('tokenHash' in where) {
          _sessions = _sessions.filter((s) => s.tokenHash !== where.tokenHash);
        } else if ('expiresAt' in where) {
          _sessions = _sessions.filter((s) => s.expiresAt >= where.expiresAt.lt);
        }
        return { count: 0 };
      }),
    },
  };
  return db as unknown as PrismaClient;
}

function makeDeps(overrides: Partial<AuthDeps> = {}): { deps: AuthDeps; mailer: FakeMailer } {
  const mailer = new FakeMailer();
  const prisma = makeFakePrisma();
  const deps: AuthDeps = {
    prisma,
    mailer,
    config: TEST_CONFIG,
    now: () => FIXED_NOW,
    generateCode: () => '123456',
    generateToken: () => TEST_TOKEN,
    ...overrides,
  };
  return { deps, mailer };
}

function appWith(deps: AuthDeps): ReturnType<typeof buildApp> {
  return buildApp(deps.prisma, deps);
}

function cookieFrom(res: { headers: Record<string, unknown> }): string {
  const setCookie = res.headers['set-cookie'];
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : String(setCookie);
  const match = /kn_session=([^;]+)/.exec(cookieStr ?? '');
  return match ? `kn_session=${match[1]}` : '';
}

beforeEach(() => {
  _users = [];
  _magic = [];
  _sessions = [];
  _idCounter = 0;
});

// ── POST /api/auth/magic-link ──────────────────────────────────────────────────

describe('POST /api/auth/magic-link', () => {
  it('creates user + token (hashed, not plaintext) → 200, mailer received clickable link', async () => {
    const { deps, mailer } = makeDeps();
    const app = appWith(deps);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/magic-link',
      payload: { email: TEST_EMAIL, returnTo: '/wishlist' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    expect(mailer.lastEmail).toBe(TEST_EMAIL);
    expect(mailer.lastMagicLinkUrl).toBe('https://knyhovo.test/auth/verify?token=' + encodeURIComponent(TEST_TOKEN));

    expect(_magic).toHaveLength(1);
    expect(_magic[0]?.tokenHash).toBe(hashToken(TEST_TOKEN));
    expect(_magic[0]?.tokenHash).not.toBe(TEST_TOKEN);
    expect(_magic[0]?.returnTo).toBe('/wishlist');
  });

  it('stores null for an unsafe (external) returnTo', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);

    await app.inject({
      method: 'POST',
      url: '/api/auth/magic-link',
      payload: { email: TEST_EMAIL, returnTo: 'https://evil.com' },
    });

    expect(_magic[0]?.returnTo).toBeNull();
  });

  it('returns 429 RATE_LIMITED past the per-window limit', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);

    for (let i = 0; i < 5; i++) {
      await app.inject({ method: 'POST', url: '/api/auth/magic-link', payload: { email: TEST_EMAIL } });
    }
    const res = await app.inject({ method: 'POST', url: '/api/auth/magic-link', payload: { email: TEST_EMAIL } });

    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe('RATE_LIMITED');
  });

  it('returns 400 VALIDATION_ERROR for invalid email', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);

    const res = await app.inject({ method: 'POST', url: '/api/auth/magic-link', payload: { email: 'nope' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

// ── POST /api/auth/verify-link ─────────────────────────────────────────────────

describe('POST /api/auth/verify-link', () => {
  async function seedToken(app: ReturnType<typeof buildApp>, returnTo?: string): Promise<void> {
    await app.inject({
      method: 'POST',
      url: '/api/auth/magic-link',
      payload: returnTo ? { email: TEST_EMAIL, returnTo } : { email: TEST_EMAIL },
    });
  }

  it('valid token → 200 {user, returnTo} + Set-Cookie kn_session (httpOnly), session created', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);
    await seedToken(app, '/settings/notifications');

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-link',
      payload: { token: TEST_TOKEN },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { user: { email: string }; returnTo: string | null };
    expect(body.user.email).toBe(TEST_EMAIL);
    expect(body.returnTo).toBe('/settings/notifications');

    const cookieStr = cookieFrom(res);
    expect(cookieStr).toContain('kn_session=');
    expect(_sessions).toHaveLength(1);
    expect(_sessions[0]?.tokenHash).toBe(hashToken(TEST_TOKEN));

    // The consumed token is marked consumed.
    expect(_magic[0]?.consumedAt).not.toBeNull();
  });

  it('returns returnTo null when none was stored', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);
    await seedToken(app);

    const res = await app.inject({ method: 'POST', url: '/api/auth/verify-link', payload: { token: TEST_TOKEN } });
    expect((res.json() as { returnTo: string | null }).returnTo).toBeNull();
  });

  it('unknown token → 401 AUTH_INVALID_CODE, no cookie', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);

    const res = await app.inject({ method: 'POST', url: '/api/auth/verify-link', payload: { token: 'bogus' } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_INVALID_CODE');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(_sessions).toHaveLength(0);
  });

  it('expired token → 401', async () => {
    const nowFn = vi.fn(() => FIXED_NOW);
    const { deps } = makeDeps({ now: nowFn });
    const app = appWith(deps);
    await seedToken(app);

    nowFn.mockReturnValue(new Date(FIXED_NOW.getTime() + MAGIC_TTL_MS + 1));

    const res = await app.inject({ method: 'POST', url: '/api/auth/verify-link', payload: { token: TEST_TOKEN } });
    expect(res.statusCode).toBe(401);
  });

  it('reused (already-consumed) token → 401 on the second click', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);
    await seedToken(app);

    const first = await app.inject({ method: 'POST', url: '/api/auth/verify-link', payload: { token: TEST_TOKEN } });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({ method: 'POST', url: '/api/auth/verify-link', payload: { token: TEST_TOKEN } });
    expect(second.statusCode).toBe(401);
  });

  it('issued session authenticates GET /api/auth/me', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);
    await seedToken(app);
    const verify = await app.inject({ method: 'POST', url: '/api/auth/verify-link', payload: { token: TEST_TOKEN } });
    const cookie = cookieFrom(verify);

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect((me.json() as { user: { email: string } }).user.email).toBe(TEST_EMAIL);
  });

  it('returns 400 VALIDATION_ERROR for empty token', async () => {
    const { deps } = makeDeps();
    const app = appWith(deps);

    const res = await app.inject({ method: 'POST', url: '/api/auth/verify-link', payload: { token: '' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});
