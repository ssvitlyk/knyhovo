/**
 * Unit tests for the notification_deliveries repository (W4b PR1).
 *
 * Uses a small stateful in-memory fake of the Prisma `notificationDelivery`
 * delegate that honours exactly the query shapes the repository issues.
 * Deterministic: fixed clock, no randomness.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  enqueueDelivery,
  findDueDeliveries,
  markDeliverySent,
  markDeliveryFailed,
  markDeliverySkipped,
  countUserDeliveriesSince,
} from '../notification-delivery.repository.js';

const NOW = new Date('2026-06-29T12:00:00.000Z');

interface Row {
  id: string;
  alertId: string;
  userId: string;
  canonicalBookId: string;
  type: 'PRICE_DROP' | 'BACK_IN_STOCK';
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  triggerPriceAmount: number | null;
  dedupKey: string;
  attempts: number;
  nextAttemptAt: Date | null;
  lastError: string | null;
  providerMessageId: string | null;
  createdAt: Date;
  sentAt: Date | null;
  updatedAt: Date;
}

let store: Row[] = [];
let idSeq = 0;

function pick<T extends object>(row: Row, select: Record<string, boolean>): T {
  const out: Record<string, unknown> = {};
  const source = row as unknown as Record<string, unknown>;
  for (const key of Object.keys(select)) out[key] = source[key];
  return out as T;
}

function makeFakePrisma(): PrismaClient {
  const db = {
    notificationDelivery: {
      findUnique: async ({
        where,
        select,
      }: {
        where: { dedupKey?: string; id?: string };
        select?: Record<string, boolean>;
      }) => {
        const row = store.find(
          (r) =>
            (where.dedupKey != null && r.dedupKey === where.dedupKey) ||
            (where.id != null && r.id === where.id),
        );
        if (!row) return null;
        return select ? pick(row, select) : row;
      },

      upsert: async ({
        where,
        create,
        select,
      }: {
        where: { dedupKey: string };
        create: Partial<Row>;
        update: Partial<Row>;
        select?: Record<string, boolean>;
      }) => {
        let row = store.find((r) => r.dedupKey === where.dedupKey);
        if (!row) {
          row = {
            id: `del-${++idSeq}`,
            alertId: create.alertId!,
            userId: create.userId!,
            canonicalBookId: create.canonicalBookId!,
            type: create.type!,
            status: create.status ?? 'PENDING',
            triggerPriceAmount: create.triggerPriceAmount ?? null,
            dedupKey: where.dedupKey,
            attempts: 0,
            nextAttemptAt: null,
            lastError: null,
            providerMessageId: null,
            createdAt: NOW,
            sentAt: null,
            updatedAt: NOW,
          };
          store.push(row);
        }
        return select ? pick(row, select) : row;
      },

      findMany: async ({
        where,
        orderBy,
        take,
        select,
      }: {
        where: {
          status?: { in: string[] };
          attempts?: { lt: number };
          OR?: Array<{ nextAttemptAt: null | { lte: Date } }>;
        };
        orderBy?: { createdAt: 'asc' | 'desc' };
        take?: number;
        select?: Record<string, boolean>;
      }) => {
        let rows = store.filter((r) => {
          if (where.status && !where.status.in.includes(r.status)) return false;
          if (where.attempts && !(r.attempts < where.attempts.lt)) return false;
          if (where.OR) {
            const due = where.OR.some((cond) => {
              if (cond.nextAttemptAt === null) return r.nextAttemptAt === null;
              return r.nextAttemptAt != null && r.nextAttemptAt <= cond.nextAttemptAt.lte;
            });
            if (!due) return false;
          }
          return true;
        });
        if (orderBy?.createdAt === 'asc') {
          rows = rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
        if (take != null) rows = rows.slice(0, take);
        return select ? rows.map((r) => pick(r, select)) : rows;
      },

      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Row>;
      }) => {
        const row = store.find((r) => r.id === where.id);
        if (!row) throw new Error(`no row ${where.id}`);
        Object.assign(row, data, { updatedAt: NOW });
        return row;
      },

      count: async ({
        where,
      }: {
        where: { userId: string; status: string; createdAt: { gte: Date } };
      }) =>
        store.filter(
          (r) =>
            r.userId === where.userId &&
            r.status === where.status &&
            r.createdAt >= where.createdAt.gte,
        ).length,
    },
  };
  return db as unknown as PrismaClient;
}

function seed(row: Partial<Row> & { id: string; dedupKey: string }): void {
  store.push({
    alertId: 'a1',
    userId: 'u1',
    canonicalBookId: 'b1',
    type: 'PRICE_DROP',
    status: 'PENDING',
    triggerPriceAmount: 1000,
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
    providerMessageId: null,
    createdAt: NOW,
    sentAt: null,
    updatedAt: NOW,
    ...row,
  });
}

beforeEach(() => {
  store = [];
  idSeq = 0;
});

describe('enqueueDelivery', () => {
  it('inserts a new PENDING delivery and reports created=true', async () => {
    const prisma = makeFakePrisma();
    const res = await enqueueDelivery(prisma, {
      dedupKey: 'a1:price:900',
      alertId: 'a1',
      userId: 'u1',
      canonicalBookId: 'b1',
      type: 'PRICE_DROP',
      triggerPriceAmount: 900,
    });
    expect(res.created).toBe(true);
    expect(store).toHaveLength(1);
    expect(store[0]?.status).toBe('PENDING');
    expect(store[0]?.dedupKey).toBe('a1:price:900');
  });

  it('is idempotent: same dedupKey does not duplicate and reports created=false', async () => {
    const prisma = makeFakePrisma();
    const input = {
      dedupKey: 'a1:price:900',
      alertId: 'a1',
      userId: 'u1',
      canonicalBookId: 'b1',
      type: 'PRICE_DROP' as const,
      triggerPriceAmount: 900,
    };
    const first = await enqueueDelivery(prisma, input);
    const second = await enqueueDelivery(prisma, input);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);
    expect(store).toHaveLength(1);
  });
});

describe('findDueDeliveries', () => {
  it('returns PENDING and FAILED rows under the attempt cap, oldest first', async () => {
    seed({ id: 'd1', dedupKey: 'k1', status: 'PENDING', createdAt: new Date('2026-06-29T10:00:00Z') });
    seed({ id: 'd2', dedupKey: 'k2', status: 'FAILED', attempts: 1, createdAt: new Date('2026-06-29T09:00:00Z') });
    const prisma = makeFakePrisma();
    const due = await findDueDeliveries(prisma, NOW, 3, 10);
    expect(due.map((d) => d.id)).toEqual(['d2', 'd1']);
  });

  it('excludes rows at or above the attempt cap', async () => {
    seed({ id: 'd1', dedupKey: 'k1', status: 'FAILED', attempts: 3 });
    const prisma = makeFakePrisma();
    expect(await findDueDeliveries(prisma, NOW, 3, 10)).toHaveLength(0);
  });

  it('excludes SENT and SKIPPED rows', async () => {
    seed({ id: 'd1', dedupKey: 'k1', status: 'SENT' });
    seed({ id: 'd2', dedupKey: 'k2', status: 'SKIPPED' });
    const prisma = makeFakePrisma();
    expect(await findDueDeliveries(prisma, NOW, 3, 10)).toHaveLength(0);
  });

  it('respects nextAttemptAt: future backoff is excluded, due/past is included', async () => {
    seed({ id: 'future', dedupKey: 'k1', status: 'FAILED', attempts: 1, nextAttemptAt: new Date('2026-06-29T12:30:00Z') });
    seed({ id: 'past', dedupKey: 'k2', status: 'FAILED', attempts: 1, nextAttemptAt: new Date('2026-06-29T11:30:00Z') });
    const prisma = makeFakePrisma();
    const due = await findDueDeliveries(prisma, NOW, 3, 10);
    expect(due.map((d) => d.id)).toEqual(['past']);
  });

  it('honours the limit', async () => {
    seed({ id: 'd1', dedupKey: 'k1', createdAt: new Date('2026-06-29T08:00:00Z') });
    seed({ id: 'd2', dedupKey: 'k2', createdAt: new Date('2026-06-29T09:00:00Z') });
    seed({ id: 'd3', dedupKey: 'k3', createdAt: new Date('2026-06-29T10:00:00Z') });
    const prisma = makeFakePrisma();
    const due = await findDueDeliveries(prisma, NOW, 3, 2);
    expect(due.map((d) => d.id)).toEqual(['d1', 'd2']);
  });
});

describe('mark* helpers', () => {
  it('markDeliverySent sets SENT and clears retry markers', async () => {
    seed({ id: 'd1', dedupKey: 'k1', status: 'FAILED', attempts: 1, lastError: 'boom', nextAttemptAt: NOW });
    const prisma = makeFakePrisma();
    await markDeliverySent(prisma, 'd1', { providerMessageId: 'resend-123', sentAt: NOW });
    const row = store.find((r) => r.id === 'd1')!;
    expect(row.status).toBe('SENT');
    expect(row.providerMessageId).toBe('resend-123');
    expect(row.sentAt).toEqual(NOW);
    expect(row.lastError).toBeNull();
    expect(row.nextAttemptAt).toBeNull();
  });

  it('markDeliveryFailed records error, attempts and nextAttemptAt', async () => {
    seed({ id: 'd1', dedupKey: 'k1', status: 'PENDING' });
    const prisma = makeFakePrisma();
    const retryAt = new Date('2026-06-29T12:01:00Z');
    await markDeliveryFailed(prisma, 'd1', { lastError: '503', attempts: 1, nextAttemptAt: retryAt });
    const row = store.find((r) => r.id === 'd1')!;
    expect(row.status).toBe('FAILED');
    expect(row.lastError).toBe('503');
    expect(row.attempts).toBe(1);
    expect(row.nextAttemptAt).toEqual(retryAt);
  });

  it('markDeliverySkipped sets SKIPPED with the error', async () => {
    seed({ id: 'd1', dedupKey: 'k1', status: 'PENDING' });
    const prisma = makeFakePrisma();
    await markDeliverySkipped(prisma, 'd1', { lastError: '400 invalid recipient' });
    const row = store.find((r) => r.id === 'd1')!;
    expect(row.status).toBe('SKIPPED');
    expect(row.lastError).toBe('400 invalid recipient');
  });
});

describe('countUserDeliveriesSince', () => {
  it('counts only SENT deliveries for the user within the window', async () => {
    seed({ id: 'd1', dedupKey: 'k1', userId: 'u1', status: 'SENT', createdAt: new Date('2026-06-29T11:00:00Z') });
    seed({ id: 'd2', dedupKey: 'k2', userId: 'u1', status: 'SENT', createdAt: new Date('2026-06-28T11:00:00Z') }); // before window
    seed({ id: 'd3', dedupKey: 'k3', userId: 'u1', status: 'PENDING', createdAt: new Date('2026-06-29T11:30:00Z') }); // not sent
    seed({ id: 'd4', dedupKey: 'k4', userId: 'u2', status: 'SENT', createdAt: new Date('2026-06-29T11:00:00Z') }); // other user
    const prisma = makeFakePrisma();
    const since = new Date('2026-06-29T00:00:00Z');
    expect(await countUserDeliveriesSince(prisma, 'u1', since)).toBe(1);
  });
});
