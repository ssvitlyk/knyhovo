import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  REQUEST_TIMEOUT_MS,
  apiJson,
  apiRequest,
  defineApiError,
  readErrorEnvelope,
} from '../http';

const TestError = defineApiError('TestError');

function mockFetch(impl: typeof fetch): ReturnType<typeof vi.fn> {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('defineApiError()', () => {
  it('builds named subclasses that are instanceof ApiError and Error', () => {
    const err = new TestError('boom', 418, 'TEAPOT');
    expect(err).toBeInstanceOf(TestError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('TestError');
    expect(err.message).toBe('boom');
    expect(err.status).toBe(418);
    expect(err.code).toBe('TEAPOT');
  });

  it('defaults code to null', () => {
    expect(new TestError('x', null).code).toBeNull();
    expect(new ApiError('x', 500).name).toBe('ApiError');
  });
});

describe('readErrorEnvelope()', () => {
  it('reads code and message', async () => {
    const res = new Response(JSON.stringify({ error: { code: 'C', message: 'M' } }));
    expect(await readErrorEnvelope(res)).toEqual({ code: 'C', message: 'M' });
  });

  it('returns nulls for non-string fields or missing envelope', async () => {
    const res = new Response(JSON.stringify({ error: { code: 1, message: 2 } }));
    expect(await readErrorEnvelope(res)).toEqual({ code: null, message: null });
    expect(await readErrorEnvelope(new Response('{}'))).toEqual({ code: null, message: null });
  });

  it('returns nulls for an unparsable body', async () => {
    expect(await readErrorEnvelope(new Response('<html>'))).toEqual({ code: null, message: null });
  });
});

describe('apiRequest()', () => {
  it('returns the response on 2xx and omits optional init keys', async () => {
    const fn = mockFetch((async () => new Response('{}', { status: 200 })) as typeof fetch);
    const res = await apiRequest('/x', { transportMessage: 'T' });
    expect(res.status).toBe(200);
    const init = fn.mock.calls[0][1] as RequestInit;
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('serialises body as JSON, forwards cookie and passes init options', async () => {
    const fn = mockFetch((async () => new Response('{}')) as typeof fetch);
    await apiRequest('/x', {
      method: 'POST',
      body: { a: 1 },
      cookie: 'kn=1',
      cache: 'no-store',
      credentials: 'include',
      redirect: 'manual',
      transportMessage: 'T',
    });
    const init = fn.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', cookie: 'kn=1' });
    expect(init.cache).toBe('no-store');
    expect(init.credentials).toBe('include');
    expect(init.redirect).toBe('manual');
  });

  it('maps a transport failure to errorClass(transportMessage, null) and logs when tagged', async () => {
    mockFetch((async () => {
      throw new Error('down');
    }) as typeof fetch);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const err = await apiRequest('/x', {
      errorClass: TestError,
      transportMessage: 'unreachable',
      logTag: 'tag',
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TestError);
    expect((err as ApiError).message).toBe('unreachable');
    expect((err as ApiError).status).toBeNull();
    expect(spy).toHaveBeenCalledWith('[tag] transport failure', expect.objectContaining({ url: '/x' }));
  });

  it('does not log without a logTag and defaults to ApiError', async () => {
    mockFetch((async () => {
      throw new Error('down');
    }) as typeof fetch);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const err = await apiRequest('/x', { transportMessage: 'u' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(spy).not.toHaveBeenCalled();
  });

  it('maps non-ok to httpMessage(status)', async () => {
    mockFetch((async () => new Response('{}', { status: 503 })) as typeof fetch);
    await expect(
      apiRequest('/x', {
        errorClass: TestError,
        transportMessage: 'u',
        httpMessage: (s) => `bad ${s}`,
      }),
    ).rejects.toMatchObject({ name: 'TestError', message: 'bad 503', status: 503, code: null });
  });

  it('uses a generic message when httpMessage is omitted', async () => {
    mockFetch((async () => new Response('{}', { status: 500 })) as typeof fetch);
    await expect(apiRequest('/x', { transportMessage: 'u' })).rejects.toMatchObject({
      message: 'Request failed (500).',
    });
  });

  it('prefers the envelope message/code when envelope is on, else falls back', async () => {
    mockFetch((async () =>
      new Response(JSON.stringify({ error: { code: 'NOPE', message: 'Server says no' } }), {
        status: 422,
      })) as typeof fetch);
    await expect(
      apiRequest('/x', { errorClass: TestError, envelope: true, transportMessage: 'u' }),
    ).rejects.toMatchObject({ message: 'Server says no', status: 422, code: 'NOPE' });

    mockFetch((async () => new Response('<html>', { status: 502 })) as typeof fetch);
    await expect(
      apiRequest('/x', {
        errorClass: TestError,
        envelope: true,
        transportMessage: 'u',
        httpMessage: (s) => `fallback ${s}`,
      }),
    ).rejects.toMatchObject({ message: 'fallback 502', status: 502, code: null });
  });

  it('returns passthrough statuses instead of throwing', async () => {
    mockFetch((async () => new Response('{}', { status: 401 })) as typeof fetch);
    const res = await apiRequest('/x', {
      transportMessage: 'u',
      passthrough: (s) => s === 401,
    });
    expect(res.status).toBe(401);
  });

  it('aborts the request after REQUEST_TIMEOUT_MS', async () => {
    vi.useFakeTimers();
    mockFetch(((_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as typeof fetch);
    const pending = apiRequest('/x', { errorClass: TestError, transportMessage: 'timeout' }).catch(
      (e: unknown) => e,
    );
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    const err = await pending;
    expect(err).toBeInstanceOf(TestError);
    expect((err as ApiError).message).toBe('timeout');
  });
});

describe('apiJson()', () => {
  it('parses the JSON body', async () => {
    mockFetch((async () => new Response('{"a":1}')) as typeof fetch);
    expect(await apiJson<{ a: number }>('/x', { transportMessage: 'u' })).toEqual({ a: 1 });
  });

  it('propagates errors', async () => {
    mockFetch((async () => new Response('{}', { status: 404 })) as typeof fetch);
    await expect(apiJson('/x', { transportMessage: 'u' })).rejects.toMatchObject({ status: 404 });
  });
});
