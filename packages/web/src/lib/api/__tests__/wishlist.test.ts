import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  getWishlistStatus,
  WishlistError,
} from '../wishlist';
import type { WishlistResponseDto } from '../types';

const WISHLIST_RESPONSE: WishlistResponseDto = {
  items: [
    {
      book: {
        id: 'book-1',
        title: 'Кобзар',
        author: 'Тарас Шевченко',
        isbn: null,
        coverUrl: null,
        lowestPrice: { amount: 24500, currency: 'UAH' },
        offersCount: 2,
        providers: [
          {
            provider: 'yakaboo',
            price: { amount: 24500, currency: 'UAH' },
            availability: 'in-stock',
            url: 'https://yakaboo.ua/book',
            lastSeenAt: '2026-06-13T08:00:00.000Z',
          },
        ],
      },
      createdAt: '2026-06-10T10:00:00.000Z',
    },
  ],
};

function mockFetch(impl: typeof fetch): void {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/* ── getWishlist ────────────────────────────────────────────────────────────── */
describe('getWishlist()', () => {
  it('200 → returns wishlist response', async () => {
    mockFetch((async () =>
      new Response(JSON.stringify(WISHLIST_RESPONSE), { status: 200 })) as typeof fetch);

    const result = await getWishlist({ cookie: 'kn_session=abc' });
    expect(result).toEqual(WISHLIST_RESPONSE);
  });

  it('401 → returns { unauthorized: true } sentinel (does not throw)', async () => {
    mockFetch((async () =>
      new Response(JSON.stringify({ error: 'AUTH_REQUIRED' }), { status: 401 })) as typeof fetch);

    const result = await getWishlist({ cookie: '' });
    expect(result).toEqual({ unauthorized: true });
  });

  it('500 → throws WishlistError with status', async () => {
    mockFetch((async () => new Response('{}', { status: 500 })) as typeof fetch);

    await expect(getWishlist({ cookie: '' })).rejects.toMatchObject({
      name: 'WishlistError',
      status: 500,
    });
  });

  it('network failure → throws WishlistError with null status', async () => {
    mockFetch((async () => {
      throw new Error('network down');
    }) as typeof fetch);

    const err = await getWishlist({ cookie: '' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WishlistError);
    expect((err as WishlistError).status).toBeNull();
  });

  it('forwards the cookie header server-side', async () => {
    let capturedHeaders: HeadersInit | undefined;
    mockFetch((async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify(WISHLIST_RESPONSE), { status: 200 });
    }) as typeof fetch);

    await getWishlist({ cookie: 'kn_session=xyz' });
    expect((capturedHeaders as Record<string, string>)['cookie']).toBe('kn_session=xyz');
  });
});

/* ── addToWishlist ──────────────────────────────────────────────────────────── */
describe('addToWishlist()', () => {
  it('200 → resolves without throwing', async () => {
    mockFetch((async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch);

    await expect(addToWishlist('book-1')).resolves.toBeUndefined();
  });

  it('401 → throws WishlistError with status 401', async () => {
    mockFetch((async () => new Response('{}', { status: 401 })) as typeof fetch);

    await expect(addToWishlist('book-1')).rejects.toMatchObject({
      name: 'WishlistError',
      status: 401,
    });
  });

  it('non-2xx → throws WishlistError', async () => {
    mockFetch((async () => new Response('{}', { status: 400 })) as typeof fetch);

    await expect(addToWishlist('bad-uuid')).rejects.toMatchObject({
      name: 'WishlistError',
      status: 400,
    });
  });

  it('uses credentials:include and sends bookId in body', async () => {
    let capturedInit: RequestInit | undefined;
    mockFetch((async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch);

    await addToWishlist('book-42');
    expect(capturedInit?.credentials).toBe('include');
    expect(capturedInit?.method).toBe('POST');
    expect(JSON.parse(capturedInit?.body as string)).toEqual({ bookId: 'book-42' });
  });
});

/* ── removeFromWishlist ─────────────────────────────────────────────────────── */
describe('removeFromWishlist()', () => {
  it('200 → resolves without throwing', async () => {
    mockFetch((async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch);

    await expect(removeFromWishlist('book-1')).resolves.toBeUndefined();
  });

  it('non-2xx → throws WishlistError', async () => {
    mockFetch((async () => new Response('{}', { status: 404 })) as typeof fetch);

    await expect(removeFromWishlist('book-1')).rejects.toMatchObject({
      name: 'WishlistError',
      status: 404,
    });
  });

  it('uses credentials:include and DELETE method', async () => {
    let capturedInit: RequestInit | undefined;
    let capturedUrl = '';
    mockFetch((async (url: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch);

    await removeFromWishlist('book-99');
    expect(capturedUrl).toContain('/api/wishlist/book-99');
    expect(capturedInit?.credentials).toBe('include');
    expect(capturedInit?.method).toBe('DELETE');
  });
});

/* ── getWishlistStatus ──────────────────────────────────────────────────────── */
describe('getWishlistStatus()', () => {
  it('200 inWishlist:true → returns true', async () => {
    mockFetch((async () =>
      new Response(JSON.stringify({ inWishlist: true }), { status: 200 })) as typeof fetch);

    const result = await getWishlistStatus({ bookId: 'book-1', cookie: 'kn_session=abc' });
    expect(result).toBe(true);
  });

  it('200 inWishlist:false → returns false', async () => {
    mockFetch((async () =>
      new Response(JSON.stringify({ inWishlist: false }), { status: 200 })) as typeof fetch);

    const result = await getWishlistStatus({ bookId: 'book-1', cookie: 'kn_session=abc' });
    expect(result).toBe(false);
  });

  it('401 → returns false (degrade gracefully)', async () => {
    mockFetch((async () =>
      new Response(JSON.stringify({ error: 'AUTH_REQUIRED' }), { status: 401 })) as typeof fetch);

    const result = await getWishlistStatus({ bookId: 'book-1', cookie: '' });
    expect(result).toBe(false);
  });

  it('500 → returns false (degrade gracefully)', async () => {
    mockFetch((async () => new Response('{}', { status: 500 })) as typeof fetch);

    const result = await getWishlistStatus({ bookId: 'book-1', cookie: '' });
    expect(result).toBe(false);
  });

  it('network error → returns false (degrade gracefully)', async () => {
    mockFetch((async () => {
      throw new Error('network down');
    }) as typeof fetch);

    const result = await getWishlistStatus({ bookId: 'book-1', cookie: '' });
    expect(result).toBe(false);
  });
});
