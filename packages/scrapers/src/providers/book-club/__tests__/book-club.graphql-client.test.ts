import { describe, it, expect, vi } from 'vitest';
import { HttpGraphqlClient } from '../graphql-client.js';

function makeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 429 ? 'Too Many Requests' : 'Error',
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    json: async () => body,
  } as unknown as Response;
}

describe('HttpGraphqlClient', () => {
  it('POSTs correct JSON body and headers to the endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, { data: {} }));
    const client = new HttpGraphqlClient({ fetchImpl, endpoint: 'https://example.com/graphql' });

    await client.request('{ catalogProducts { meta } }', undefined, 5000);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.com/graphql');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string) as { query: string; variables: unknown };
    expect(body.query).toBe('{ catalogProducts { meta } }');
    expect(body.variables).toBeUndefined();
  });

  it('passes variables when provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, { data: {} }));
    const client = new HttpGraphqlClient({ fetchImpl, endpoint: 'https://example.com/graphql' });

    await client.request('{ x }', { page: 1 }, 5000);

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { variables: unknown };
    expect(body.variables).toEqual({ page: 1 });
  });

  it('returns the parsed JSON body on success', async () => {
    const payload = { data: { catalogProducts: { meta: { has_more_pages: false } } } };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = new HttpGraphqlClient({ fetchImpl });

    const result = await client.request('{}', undefined, 5000);

    expect(result).toEqual(payload);
  });

  it('throws on non-2xx, non-429 status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(500, null));
    const client = new HttpGraphqlClient({ fetchImpl });

    await expect(client.request('{}', undefined, 5000)).rejects.toThrow('HTTP 500');
  });

  it('throws on 404', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(404, null));
    const client = new HttpGraphqlClient({ fetchImpl });

    await expect(client.request('{}', undefined, 5000)).rejects.toThrow('HTTP 404');
  });

  it('aborts and rejects when the timeout fires', async () => {
    const fetchImpl = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init.signal as AbortSignal;
        if (signal.aborted) {
          reject(new DOMException('aborted', 'AbortError'));
          return;
        }
        signal.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });

    const client = new HttpGraphqlClient({ fetchImpl, maxRetries: 0 });

    // The promise should reject; we don't care about the exact message since
    // the AbortController fires almost immediately (timeoutMs=1).
    await expect(client.request('{}', undefined, 1)).rejects.toThrow();
  });

  it('retries on 429 and succeeds on next attempt', async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(429, null, { 'retry-after': '1' }))
      .mockResolvedValueOnce(makeResponse(200, { data: { ok: true } }));

    const client = new HttpGraphqlClient({ fetchImpl, maxRetries: 2, sleep });

    const result = await client.request('{}', undefined, 5000);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(1000); // Retry-After: 1 → 1000ms
    expect(result).toEqual({ data: { ok: true } });
  });

  it('uses backoff when Retry-After header is absent', async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(429, null))
      .mockResolvedValueOnce(makeResponse(200, { data: {} }));

    const client = new HttpGraphqlClient({ fetchImpl, maxRetries: 2, backoffBaseMs: 100, sleep });

    await client.request('{}', undefined, 5000);

    expect(sleep).toHaveBeenCalledWith(100); // backoffBaseMs * 2^0 = 100
  });

  it('throws after exhausting all 429 retries', async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(429, null));

    const client = new HttpGraphqlClient({ fetchImpl, maxRetries: 2, sleep });

    await expect(client.request('{}', undefined, 5000)).rejects.toThrow('HTTP 429');
    // 1 initial + 2 retries = 3 calls
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});
