import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  me,
  requestCode,
  verifyCode,
  logout,
  requestMagicLink,
  verifyMagicLink,
  AuthError,
} from '../auth';
import type { AuthUserDto } from '../types';

const USER: AuthUserDto = {
  id: 'user-1',
  email: 'test@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  displayName: null,
};

function mockFetch(impl: typeof fetch): void {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('me()', () => {
  it('200 → returns user', async () => {
    mockFetch((async () =>
      new Response(JSON.stringify({ user: USER }), { status: 200 })) as typeof fetch);

    const result = await me();
    expect(result).toEqual(USER);
  });

  it('401 → returns null (does not throw)', async () => {
    mockFetch((async () =>
      new Response(JSON.stringify({ error: { code: 'AUTH_REQUIRED', message: 'x' } }), {
        status: 401,
      })) as typeof fetch);

    const result = await me();
    expect(result).toBeNull();
  });

  it('500 → throws AuthError', async () => {
    mockFetch((async () => new Response('{}', { status: 500 })) as typeof fetch);

    await expect(me()).rejects.toMatchObject({ name: 'AuthError', status: 500 });
  });

  it('uses credentials: include', async () => {
    let capturedInit: RequestInit | undefined;
    mockFetch((async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ user: USER }), { status: 200 });
    }) as typeof fetch);

    await me();
    expect(capturedInit?.credentials).toBe('include');
  });
});

describe('verifyCode()', () => {
  it('200 → returns user', async () => {
    mockFetch((async () =>
      new Response(JSON.stringify({ user: USER }), { status: 200 })) as typeof fetch);

    const result = await verifyCode('test@example.com', '123456');
    expect(result).toEqual(USER);
  });

  it('401 → throws AuthError', async () => {
    mockFetch((async () => new Response('{}', { status: 401 })) as typeof fetch);

    await expect(verifyCode('test@example.com', '000000')).rejects.toMatchObject({
      name: 'AuthError',
      status: 401,
    });
  });
});

describe('requestCode()', () => {
  it('posts to the correct URL with credentials: include', async () => {
    let calledUrl = '';
    let capturedInit: RequestInit | undefined;

    mockFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
      calledUrl = String(input);
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch);

    await requestCode('user@example.com');

    expect(calledUrl).toContain('/api/auth/request-code');
    expect(capturedInit?.credentials).toBe('include');
    expect(capturedInit?.method).toBe('POST');
  });

  it('throws AuthError on non-2xx', async () => {
    mockFetch((async () => new Response('{}', { status: 429 })) as typeof fetch);

    await expect(requestCode('x@y.com')).rejects.toMatchObject({ name: 'AuthError', status: 429 });
  });

  it('throws AuthError with null status on network failure', async () => {
    mockFetch((async () => {
      throw new Error('network down');
    }) as typeof fetch);

    const err = await requestCode('x@y.com').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect((err as AuthError).status).toBeNull();
  });
});

describe('requestMagicLink()', () => {
  it('posts email + returnTo to the relative URL with credentials: include', async () => {
    let calledUrl = '';
    let capturedInit: RequestInit | undefined;
    mockFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
      calledUrl = String(input);
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch);

    await requestMagicLink('user@example.com', '/wishlist');

    expect(calledUrl).toContain('/api/auth/magic-link');
    expect(capturedInit?.credentials).toBe('include');
    expect(capturedInit?.method).toBe('POST');
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      email: 'user@example.com',
      returnTo: '/wishlist',
    });
  });

  it('omits returnTo from the body when not provided', async () => {
    let capturedInit: RequestInit | undefined;
    mockFetch((async (_i: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch);

    await requestMagicLink('user@example.com');

    expect(JSON.parse(String(capturedInit?.body))).toEqual({ email: 'user@example.com' });
  });

  it('throws AuthError on non-2xx (e.g. 429)', async () => {
    mockFetch((async () => new Response('{}', { status: 429 })) as typeof fetch);
    await expect(requestMagicLink('x@y.com')).rejects.toMatchObject({
      name: 'AuthError',
      status: 429,
    });
  });
});

describe('verifyMagicLink()', () => {
  it('200 → returns user + returnTo', async () => {
    mockFetch((async () =>
      new Response(JSON.stringify({ user: USER, returnTo: '/wishlist' }), {
        status: 200,
      })) as typeof fetch);

    const result = await verifyMagicLink('tok');
    expect(result).toEqual({ user: USER, returnTo: '/wishlist' });
  });

  it('401 → throws AuthError (invalid/expired/used link)', async () => {
    mockFetch((async () => new Response('{}', { status: 401 })) as typeof fetch);
    await expect(verifyMagicLink('bad')).rejects.toMatchObject({
      name: 'AuthError',
      status: 401,
    });
  });
});

describe('logout()', () => {
  it('calls the logout endpoint with credentials: include', async () => {
    let calledUrl = '';
    let capturedInit: RequestInit | undefined;

    mockFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
      calledUrl = String(input);
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch);

    await logout();

    expect(calledUrl).toContain('/api/auth/logout');
    expect(capturedInit?.credentials).toBe('include');
  });

  it('throws AuthError on non-2xx', async () => {
    mockFetch((async () => new Response('{}', { status: 500 })) as typeof fetch);

    await expect(logout()).rejects.toMatchObject({ name: 'AuthError', status: 500 });
  });
});
