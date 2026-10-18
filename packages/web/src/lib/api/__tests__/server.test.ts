import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ toString: (): string => 'kn_session=abc' })),
}));
vi.mock('../auth', () => ({ me: vi.fn() }));
vi.mock('../wishlist', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../wishlist')>()),
  getWishlist: vi.fn(),
}));

import { me } from '../auth';
import { getWishlist } from '../wishlist';
import {
  getBookAlertContextCached,
  getCookieHeader,
  getSessionUser,
  getWishlistCached,
} from '../server';
import type { AlertDto, WishlistResponseDto } from '../types';

const ALERT = { mode: 'any-drop' } as unknown as AlertDto;
const WISHLIST = {
  items: [{ book: { id: 'b1' }, alert: ALERT }],
} as unknown as WishlistResponseDto;

beforeEach(() => {
  vi.mocked(me).mockReset();
  vi.mocked(getWishlist).mockReset();
});

describe('getCookieHeader()', () => {
  it('serialises the request cookies', async () => {
    expect(await getCookieHeader()).toBe('kn_session=abc');
  });
});

describe('getSessionUser()', () => {
  it('delegates to me() with the cookie', async () => {
    vi.mocked(me).mockResolvedValue(null);
    expect(await getSessionUser('c=1')).toBeNull();
    expect(me).toHaveBeenCalledWith('c=1');
  });
});

describe('getWishlistCached()', () => {
  it('delegates to getWishlist({ cookie })', async () => {
    vi.mocked(getWishlist).mockResolvedValue(WISHLIST);
    expect(await getWishlistCached('c=1')).toBe(WISHLIST);
    expect(getWishlist).toHaveBeenCalledWith({ cookie: 'c=1' });
  });
});

describe('getBookAlertContextCached()', () => {
  it('finds the book in the wishlist', async () => {
    vi.mocked(getWishlist).mockResolvedValue(WISHLIST);
    expect(await getBookAlertContextCached({ bookId: 'b1', cookie: 'c' })).toEqual({
      inWishlist: true,
      alert: ALERT,
    });
  });

  it('falls back when the book is absent, unauthorized, or the fetch throws', async () => {
    const fallback = { inWishlist: false, alert: null };
    vi.mocked(getWishlist).mockResolvedValueOnce(WISHLIST);
    expect(await getBookAlertContextCached({ bookId: 'other', cookie: 'c2' })).toEqual(fallback);
    vi.mocked(getWishlist).mockResolvedValueOnce({ unauthorized: true });
    expect(await getBookAlertContextCached({ bookId: 'b1', cookie: 'c3' })).toEqual(fallback);
    vi.mocked(getWishlist).mockRejectedValueOnce(new Error('x'));
    expect(await getBookAlertContextCached({ bookId: 'b1', cookie: 'c4' })).toEqual(fallback);
  });
});
