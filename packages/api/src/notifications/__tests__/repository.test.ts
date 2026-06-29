import { describe, it, expect, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  unsubscribeByToken,
} from '../repository.js';

const NOW = new Date('2026-06-29T12:00:00.000Z');

interface UserRow {
  id: string;
  priceDropEnabled: boolean;
  backInStockEnabled: boolean;
  unsubscribedAt: Date | null;
  unsubscribeToken: string | null;
}

let users: UserRow[] = [];

function makeFakePrisma(): PrismaClient {
  const db = {
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

function seed(row: Partial<UserRow> & { id: string }): void {
  users.push({
    priceDropEnabled: true,
    backInStockEnabled: true,
    unsubscribedAt: null,
    unsubscribeToken: null,
    ...row,
  });
}

beforeEach(() => {
  users = [];
});

describe('getNotificationPreferences', () => {
  it('returns prefs with unsubscribed=false by default', async () => {
    seed({ id: 'u1' });
    expect(await getNotificationPreferences(makeFakePrisma(), 'u1')).toEqual({
      priceDropEnabled: true,
      backInStockEnabled: true,
      unsubscribed: false,
    });
  });

  it('reflects unsubscribed=true when unsubscribedAt is set', async () => {
    seed({ id: 'u1', unsubscribedAt: NOW });
    expect((await getNotificationPreferences(makeFakePrisma(), 'u1'))?.unsubscribed).toBe(true);
  });

  it('returns null for an unknown user', async () => {
    expect(await getNotificationPreferences(makeFakePrisma(), 'nope')).toBeNull();
  });
});

describe('updateNotificationPreferences', () => {
  it('updates only the provided per-type flags', async () => {
    seed({ id: 'u1' });
    const prefs = await updateNotificationPreferences(makeFakePrisma(), 'u1', { priceDropEnabled: false });
    expect(prefs).toEqual({ priceDropEnabled: false, backInStockEnabled: true, unsubscribed: false });
  });

  it('clears the global opt-out on resubscribe', async () => {
    seed({ id: 'u1', unsubscribedAt: NOW });
    const prefs = await updateNotificationPreferences(makeFakePrisma(), 'u1', { resubscribe: true });
    expect(prefs?.unsubscribed).toBe(false);
    expect(users[0]?.unsubscribedAt).toBeNull();
  });
});

describe('unsubscribeByToken', () => {
  it('sets unsubscribedAt and returns true when the token matches', async () => {
    seed({ id: 'u1', unsubscribeToken: 'tok' });
    const prisma = makeFakePrisma();
    expect(await unsubscribeByToken(prisma, 'tok', NOW)).toBe(true);
    expect(users[0]?.unsubscribedAt).toEqual(NOW);
  });

  it('returns false for an unknown token (no enumeration)', async () => {
    seed({ id: 'u1', unsubscribeToken: 'tok' });
    expect(await unsubscribeByToken(makeFakePrisma(), 'other', NOW)).toBe(false);
  });

  it('is idempotent when already unsubscribed', async () => {
    seed({ id: 'u1', unsubscribeToken: 'tok', unsubscribedAt: NOW });
    expect(await unsubscribeByToken(makeFakePrisma(), 'tok', NOW)).toBe(true);
  });
});
