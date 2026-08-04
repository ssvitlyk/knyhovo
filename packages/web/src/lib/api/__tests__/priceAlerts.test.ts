import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAlert, pauseAlert, removeAlert, AlertError } from '../priceAlerts';
import type { AlertDto } from '../types';

function mockFetch(impl: typeof fetch): void {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const RESOLVED_ALERT: AlertDto = {
  state: 'armed',
  mode: 'any-drop',
  threshold: { amount: 24000, currency: 'UAH' },
  baseline: { amount: 24000, currency: 'UAH' },
  thresholdProof: null,
  pausedAt: null,
  notifiedAt: null,
};

/* ── setAlert ───────────────────────────────────────────────────────────────── */
describe('setAlert()', () => {
  it('200 → resolves with the alert the server returned', async () => {
    mockFetch((async () =>
      new Response(JSON.stringify({ alert: RESOLVED_ALERT }), { status: 200 })) as typeof fetch);
    await expect(setAlert('book-1', 'any-drop')).resolves.toEqual(RESOLVED_ALERT);
  });

  it('sends PUT to /api/wishlist/:bookId/alert with { mode } when no threshold given', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    mockFetch((async (url: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify({ alert: RESOLVED_ALERT }), { status: 200 });
    }) as typeof fetch);

    await setAlert('book-42', 'any-drop');

    expect(capturedUrl).toContain('/api/wishlist/book-42/alert');
    expect(capturedInit?.method).toBe('PUT');
    expect(capturedInit?.credentials).toBe('include');
    const body = JSON.parse(capturedInit?.body as string) as unknown;
    expect(body).toEqual({ mode: 'any-drop' });
  });

  it('sends { mode, threshold } when a threshold is given (my-price)', async () => {
    let capturedInit: RequestInit | undefined;
    mockFetch((async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ alert: RESOLVED_ALERT }), { status: 200 });
    }) as typeof fetch);

    await setAlert('book-1', 'my-price', { amount: 19900, currency: 'UAH' });

    const body = JSON.parse(capturedInit?.body as string) as unknown;
    expect(body).toEqual({ mode: 'my-price', threshold: { amount: 19900, currency: 'UAH' } });
  });

  it('encodes bookId in the URL', async () => {
    let capturedUrl = '';
    mockFetch((async (url: RequestInfo | URL) => {
      capturedUrl = String(url);
      return new Response(JSON.stringify({ alert: RESOLVED_ALERT }), { status: 200 });
    }) as typeof fetch);

    await setAlert('book with spaces', 'any-drop');
    expect(capturedUrl).toContain('book%20with%20spaces');
  });

  it('non-2xx with a parsable {error} body → throws AlertError using the server message + code verbatim', async () => {
    mockFetch((async () =>
      new Response(
        JSON.stringify({
          error: { code: 'THRESHOLD_NOT_BELOW_CURRENT', message: 'Ціна має бути нижчою за поточну.' },
        }),
        { status: 422 },
      )) as typeof fetch);

    const err = await setAlert('book-1', 'my-price', { amount: 30000, currency: 'UAH' }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(AlertError);
    expect((err as AlertError).message).toBe('Ціна має бути нижчою за поточну.');
    expect((err as AlertError).code).toBe('THRESHOLD_NOT_BELOW_CURRENT');
    expect((err as AlertError).status).toBe(422);
  });

  it('409 INSUFFICIENT_HISTORY → throws AlertError with that code', async () => {
    mockFetch((async () =>
      new Response(
        JSON.stringify({ error: { code: 'INSUFFICIENT_HISTORY', message: 'Збираємо історію цін.' } }),
        { status: 409 },
      )) as typeof fetch);

    const err = await setAlert('book-1', 'good-price').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AlertError);
    expect((err as AlertError).code).toBe('INSUFFICIENT_HISTORY');
    expect((err as AlertError).status).toBe(409);
  });

  it('non-2xx with an unparsable body → falls back to a generic message with null code', async () => {
    mockFetch((async () => new Response('not json', { status: 500 })) as typeof fetch);

    const err = await setAlert('book-1', 'any-drop').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AlertError);
    expect((err as AlertError).status).toBe(500);
    expect((err as AlertError).code).toBeNull();
    expect((err as AlertError).message).toContain('500');
  });

  it('transport error → throws AlertError with status null and code null', async () => {
    mockFetch((async () => {
      throw new Error('network down');
    }) as typeof fetch);

    const err = await setAlert('book-1', 'any-drop').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AlertError);
    expect((err as AlertError).status).toBeNull();
    expect((err as AlertError).code).toBeNull();
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

  it('non-2xx with a parsable {error} body → throws AlertError using the server message', async () => {
    mockFetch((async () =>
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Не знайдено.' } }), {
        status: 404,
      })) as typeof fetch);

    const err = await pauseAlert('book-1', true).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AlertError);
    expect((err as AlertError).message).toBe('Не знайдено.');
    expect((err as AlertError).status).toBe(404);
  });

  it('non-2xx with an unparsable body → falls back to a generic message', async () => {
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

  it('exposes status and code', () => {
    expect(new AlertError('test', 404, 'SOME_CODE').status).toBe(404);
    expect(new AlertError('test', 404, 'SOME_CODE').code).toBe('SOME_CODE');
    expect(new AlertError('test', null).status).toBeNull();
    expect(new AlertError('test', null).code).toBeNull();
  });

  it('is an instance of Error', () => {
    expect(new AlertError('test', 400)).toBeInstanceOf(Error);
  });
});
