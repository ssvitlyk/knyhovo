import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAlert, pauseAlert, removeAlert, AlertError } from '../priceAlerts';

function mockFetch(impl: typeof fetch): void {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/* ── setAlert ───────────────────────────────────────────────────────────────── */
describe('setAlert()', () => {
  it('200 → resolves without throwing', async () => {
    mockFetch((async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch);
    await expect(
      setAlert('book-1', 'below-current', { amount: 24000, currency: 'UAH' }),
    ).resolves.toBeUndefined();
  });

  it('sends PUT to /api/wishlist/:bookId/alert with intent + targetPrice body', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    mockFetch((async (url: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch);

    await setAlert('book-42', 'below-current', { amount: 24000, currency: 'UAH' });

    expect(capturedUrl).toContain('/api/wishlist/book-42/alert');
    expect(capturedInit?.method).toBe('PUT');
    expect(capturedInit?.credentials).toBe('include');
    const body = JSON.parse(capturedInit?.body as string) as unknown;
    expect(body).toEqual({
      intent: 'below-current',
      targetPrice: { amount: 24000, currency: 'UAH' },
    });
  });

  it('encodes bookId in the URL', async () => {
    let capturedUrl = '';
    mockFetch((async (url: RequestInfo | URL) => {
      capturedUrl = String(url);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch);

    await setAlert('book with spaces', 'any-drop', { amount: 10000, currency: 'UAH' });
    expect(capturedUrl).toContain('book%20with%20spaces');
  });

  it('non-2xx → throws AlertError with the HTTP status', async () => {
    mockFetch((async () => new Response('{}', { status: 422 })) as typeof fetch);

    await expect(
      setAlert('book-1', 'any-drop', { amount: 24000, currency: 'UAH' }),
    ).rejects.toMatchObject({ name: 'AlertError', status: 422 });
  });

  it('401 → throws AlertError with status 401', async () => {
    mockFetch((async () => new Response('{}', { status: 401 })) as typeof fetch);

    await expect(
      setAlert('book-1', 'any-drop', { amount: 24000, currency: 'UAH' }),
    ).rejects.toMatchObject({ name: 'AlertError', status: 401 });
  });

  it('transport error → throws AlertError with status null', async () => {
    mockFetch((async () => {
      throw new Error('network down');
    }) as typeof fetch);

    const err = await setAlert('book-1', 'any-drop', { amount: 24000, currency: 'UAH' }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(AlertError);
    expect((err as AlertError).status).toBeNull();
  });
});

/* ── pauseAlert ─────────────────────────────────────────────────────────────── */
describe('pauseAlert()', () => {
  it('200 → resolves without throwing', async () => {
    mockFetch((async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch);
    await expect(pauseAlert('book-1', true)).resolves.toBeUndefined();
  });

  it('sends PATCH with { paused: true }', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    mockFetch((async (url: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch);

    await pauseAlert('book-1', true);
    expect(capturedUrl).toContain('/api/wishlist/book-1/alert');
    expect(capturedInit?.method).toBe('PATCH');
    expect(capturedInit?.credentials).toBe('include');
    expect(JSON.parse(capturedInit?.body as string)).toEqual({ paused: true });
  });

  it('sends PATCH with { paused: false } for resume', async () => {
    let capturedInit: RequestInit | undefined;
    mockFetch((async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch);

    await pauseAlert('book-1', false);
    expect(JSON.parse(capturedInit?.body as string)).toEqual({ paused: false });
  });

  it('non-2xx → throws AlertError with status', async () => {
    mockFetch((async () => new Response('{}', { status: 404 })) as typeof fetch);

    await expect(pauseAlert('book-1', true)).rejects.toMatchObject({
      name: 'AlertError',
      status: 404,
    });
  });

  it('transport error → throws AlertError with status null', async () => {
    mockFetch((async () => {
      throw new Error('network down');
    }) as typeof fetch);

    const err = await pauseAlert('book-1', true).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AlertError);
    expect((err as AlertError).status).toBeNull();
  });
});

/* ── removeAlert ────────────────────────────────────────────────────────────── */
describe('removeAlert()', () => {
  it('200 → resolves without throwing', async () => {
    mockFetch((async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch);
    await expect(removeAlert('book-1')).resolves.toBeUndefined();
  });

  it('sends DELETE to /api/wishlist/:bookId/alert with credentials:include', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    mockFetch((async (url: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch);

    await removeAlert('book-5');
    expect(capturedUrl).toContain('/api/wishlist/book-5/alert');
    expect(capturedInit?.method).toBe('DELETE');
    expect(capturedInit?.credentials).toBe('include');
  });

  it('non-2xx → throws AlertError with status', async () => {
    mockFetch((async () => new Response('{}', { status: 500 })) as typeof fetch);

    await expect(removeAlert('book-1')).rejects.toMatchObject({
      name: 'AlertError',
      status: 500,
    });
  });

  it('transport error → throws AlertError with status null', async () => {
    mockFetch((async () => {
      throw new Error('network down');
    }) as typeof fetch);

    const err = await removeAlert('book-1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AlertError);
    expect((err as AlertError).status).toBeNull();
  });
});

/* ── AlertError ─────────────────────────────────────────────────────────────── */
describe('AlertError', () => {
  it('name is "AlertError"', () => {
    const err = new AlertError('test', 400);
    expect(err.name).toBe('AlertError');
  });

  it('exposes status', () => {
    expect(new AlertError('test', 404).status).toBe(404);
    expect(new AlertError('test', null).status).toBeNull();
  });

  it('is an instance of Error', () => {
    expect(new AlertError('test', 400)).toBeInstanceOf(Error);
  });
});
