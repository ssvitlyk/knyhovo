import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../app.js';
import type { AuthDeps } from '../../auth/service.js';
import type { AuthConfig } from '../../auth/config.js';
import { hashToken } from '../../auth/crypto.js';

const FIXED_NOW = new Date('2026-06-29T12:00:00.000Z');
const TOKEN = 'session-token-fixed';
const USER_ID = 'user-1';

const CONFIG: AuthConfig = {
  secret: 'test-secret',
  cookieSecure: false,
  codeTtlMs: 600_000,
  magicLinkTtlMs: 1_800_000,
  sessionTtlMs: 2_592_000_000,
  rateWindowMs: 900_000,
  maxCodesPerWindow: 5,
  maxVerifyAttempts: 5,
  resendApiKey: null,
  fromEmail: 'Knyhovo <test@example.com>',
  linkBaseUrl: 'https://knyhovo.test',
};

interface UserRow {
  id: string;
  email: string;
  createdAt: Date;
  priceDropEnabled: boolean;
  backInStockEnabled: boolean;
  unsubscribedAt: Date | null;
  unsubscribeToken: string | null;
}

let users: UserRow[] = [];
let sessionTokenHash: string | null = null;

function makeFakePrisma(): PrismaClient {
  const db = {
    session: {
      findFirst: async ({ where }: { where: { tokenHash: string; expiresAt: { gt: Date } } }) => {
        if (sessionTokenHash && where.tokenHash === sessionTokenHash) {
          const user = users.find((u) => u.id === USER_ID);
          if (user) return { id: 's1', userId: user.id, user };
        }
        return null;
      },
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        users.find((u) => u.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<UserRow> }) => {
        const u = users.find((r) => r.id === where.id);
        if (!u) throw new Error('not found');
        Object.assign(u, data);
        return u;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { unsubscribeToken: string };
        data: Partial<UserRow>;
      }) => {
        const matched = users.filter((u) => u.unsubscribeToken === where.unsubscribeToken);
        for (const u of matched) Object.assign(u, data);
        return { count: matched.length };
      },
    },
  };
  return db as unknown as PrismaClient;
}

function makeAuthDeps(prisma: PrismaClient): AuthDeps {
  return {
    prisma,
    mailer: { sendMagicLink: vi.fn(async () => undefined), sendLoginCode: vi.fn(async () => undefined) },
    config: CONFIG,
    now: () => FIXED_NOW,
    generateCode: () => '000000',
    generateToken: () => 'unused',
  };
}

function appWith() {
  const prisma = makeFakePrisma();
  return buildApp(prisma, makeAuthDeps(prisma));
}

beforeEach(() => {
  users = [
    {
      id: USER_ID,
      email: 'reader@example.com',
      createdAt: FIXED_NOW,
      priceDropEnabled: true,
      backInStockEnabled: true,
      unsubscribedAt: null,
      unsubscribeToken: 'unsub-tok',
    },
  ];
  sessionTokenHash = hashToken(TOKEN);
});

describe('GET /api/notifications/preferences', () => {
  it('401 when unauthenticated', async () => {
    const res = await appWith().inject({ method: 'GET', url: '/api/notifications/preferences' });
    expect(res.statusCode).toBe(401);
  });

  it('returns current preferences for an authenticated user', async () => {
    const res = await appWith().inject({
      method: 'GET',
      url: '/api/notifications/preferences',
      cookies: { kn_session: TOKEN },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ priceDropEnabled: true, backInStockEnabled: true, unsubscribed: false });
  });
});

describe('PATCH /api/notifications/preferences', () => {
  it('toggles a per-type flag', async () => {
    const res = await appWith().inject({
      method: 'PATCH',
      url: '/api/notifications/preferences',
      cookies: { kn_session: TOKEN },
      payload: { backInStockEnabled: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ backInStockEnabled: false });
    expect(users[0]?.backInStockEnabled).toBe(false);
  });

  it('400 on an empty body', async () => {
    const res = await appWith().inject({
      method: 'PATCH',
      url: '/api/notifications/preferences',
      cookies: { kn_session: TOKEN },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('401 when unauthenticated', async () => {
    const res = await appWith().inject({
      method: 'PATCH',
      url: '/api/notifications/preferences',
      payload: { priceDropEnabled: false },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/notifications/unsubscribe', () => {
  it('sets the global opt-out and returns an HTML confirmation', async () => {
    const res = await appWith().inject({
      method: 'GET',
      url: '/api/notifications/unsubscribe?token=unsub-tok',
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('відписалися');
    expect(users[0]?.unsubscribedAt).toBeInstanceOf(Date);
  });

  it('returns the same confirmation for an unknown token (no enumeration)', async () => {
    const res = await appWith().inject({
      method: 'GET',
      url: '/api/notifications/unsubscribe?token=does-not-exist',
    });
    expect(res.statusCode).toBe(200);
    expect(users[0]?.unsubscribedAt).toBeNull();
  });

  it('400 when the token is missing', async () => {
    const res = await appWith().inject({ method: 'GET', url: '/api/notifications/unsubscribe' });
    expect(res.statusCode).toBe(400);
  });
});
