import { describe, it, expect, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';
import type { AuthDeps } from '../service.js';
import { SESSION_COOKIE } from '../cookie.js';
import { hashToken } from '../crypto.js';
import { requireUser, optionalUser } from '../guard.js';
import { UnauthorizedError } from '../../errors.js';

const NOW = new Date('2026-01-01T00:00:00Z');
const USER = { id: 'u1', email: 'a@b.c', createdAt: NOW, displayName: null };

function makeDeps(found: boolean): { deps: AuthDeps; findFirst: ReturnType<typeof vi.fn> } {
  const findFirst = vi.fn(async () => (found ? { id: 's1', userId: 'u1', user: USER } : null));
  const deps = { prisma: { session: { findFirst } }, now: () => NOW } as unknown as AuthDeps;
  return { deps, findFirst };
}

function req(cookies?: Record<string, string>): FastifyRequest {
  return { cookies } as unknown as FastifyRequest;
}

describe('requireUser', () => {
  it('returns the user for a valid session cookie', async () => {
    const { deps, findFirst } = makeDeps(true);
    await expect(requireUser(deps, req({ [SESSION_COOKIE]: 'tok' }))).resolves.toEqual(USER);
    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({ where: { tokenHash: hashToken('tok') } });
  });

  it('throws UnauthorizedError when the cookie is missing (no DB lookup)', async () => {
    const { deps, findFirst } = makeDeps(true);
    await expect(requireUser(deps, req({}))).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(requireUser(deps, req(undefined))).rejects.toBeInstanceOf(UnauthorizedError);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError when the session is unknown/expired', async () => {
    const { deps } = makeDeps(false);
    await expect(requireUser(deps, req({ [SESSION_COOKIE]: 'tok' }))).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});

describe('optionalUser', () => {
  it('returns null without lookup when deps are undefined', async () => {
    await expect(optionalUser(undefined, req({ [SESSION_COOKIE]: 'tok' }))).resolves.toBeNull();
  });

  it('returns null for guests', async () => {
    const { deps } = makeDeps(true);
    await expect(optionalUser(deps, req({}))).resolves.toBeNull();
  });

  it('returns null for an unknown session', async () => {
    const { deps } = makeDeps(false);
    await expect(optionalUser(deps, req({ [SESSION_COOKIE]: 'tok' }))).resolves.toBeNull();
  });

  it('returns the user for a valid session', async () => {
    const { deps } = makeDeps(true);
    await expect(optionalUser(deps, req({ [SESSION_COOKIE]: 'tok' }))).resolves.toEqual(USER);
  });
});
