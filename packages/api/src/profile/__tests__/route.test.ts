import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../app.js';
import type { AuthDeps } from '../../auth/service.js';
import type { AuthConfig } from '../../auth/config.js';
import { hashToken } from '../../auth/crypto.js';

const FIXED_NOW = new Date('2026-07-01T12:00:00.000Z');
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
  displayName: string | null;
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
      update: async ({
        where,
        data,
        select,
      }: {
        where: { id: string };
        data: Partial<UserRow>;
        select?: Record<string, boolean>;
      }) => {
        const u = users.find((r) => r.id === where.id);
        if (!u) throw new Error('not found');
        Object.assign(u, data);
        if (!select) return u;
        // Return only the selected fields
        return Object.fromEntries(
          Object.entries(select)
            .filter(([, v]) => v)
            .map(([k]) => [k, (u as unknown as Record<string, unknown>)[k]]),
        );
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
      displayName: null,
      priceDropEnabled: true,
      backInStockEnabled: true,
      unsubscribedAt: null,
      unsubscribeToken: 'unsub-tok',
    },
  ];
  sessionTokenHash = hashToken(TOKEN);
});

describe('PATCH /api/profile', () => {
  it('401 when unauthenticated', async () => {
    const res = await appWith().inject({
      method: 'PATCH',
      url: '/api/profile',
      payload: { displayName: 'Alice' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('200 and returns updated AuthUserDto with new displayName', async () => {
    const res = await appWith().inject({
      method: 'PATCH',
      url: '/api/profile',
      cookies: { kn_session: TOKEN },
      payload: { displayName: 'Alice' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      id: USER_ID,
      email: 'reader@example.com',
      displayName: 'Alice',
    });
    expect(typeof body.createdAt).toBe('string');
  });

  it('400 when displayName is longer than 40 characters', async () => {
    const res = await appWith().inject({
      method: 'PATCH',
      url: '/api/profile',
      cookies: { kn_session: TOKEN },
      payload: { displayName: 'A'.repeat(41) },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('200 and stores null when displayName is an empty string', async () => {
    const res = await appWith().inject({
      method: 'PATCH',
      url: '/api/profile',
      cookies: { kn_session: TOKEN },
      payload: { displayName: '   ' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ displayName: null });
    expect(users[0]?.displayName).toBeNull();
  });
});
