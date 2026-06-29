import { KSD_GRAPHQL_ENDPOINT } from './constants.js';

/** A single GraphQL error from the response `errors` array. */
export interface GraphqlError {
  readonly message: string;
  readonly path?: ReadonlyArray<string | number>;
}

/** Envelope returned by every KSD GraphQL request. */
export interface GraphqlResponse<T = unknown> {
  readonly data?: T | null;
  readonly errors?: GraphqlError[];
}

/** Minimal interface for sending a GraphQL request. Injected into the scraper. */
export interface GraphqlClient {
  request(
    query: string,
    variables: Record<string, unknown> | undefined,
    timeoutMs: number,
  ): Promise<GraphqlResponse>;
}

/** Options accepted by {@link HttpGraphqlClient}. All have sensible defaults. */
export interface HttpGraphqlClientOptions {
  /** GraphQL endpoint URL. Defaults to {@link KSD_GRAPHQL_ENDPOINT}. */
  endpoint?: string;
  /** `fetch` implementation. Defaults to the global `fetch`. Inject for tests. */
  fetchImpl?: typeof fetch;
  /** How many extra attempts to make after the first one. Default: 2. */
  maxRetries?: number;
  /** Base back-off delay in ms used for 429 retry (doubles each attempt). Default: 500. */
  backoffBaseMs?: number;
  /** Sleep helper — injectable so tests can avoid real delays. Default: real setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Dependency-free GraphQL client that POSTs JSON to the KSD endpoint.
 *
 * - Timeout is enforced via `AbortController` + `setTimeout`.
 * - HTTP 429 is retried up to `maxRetries` times using `Retry-After` (or exponential
 *   back-off). All other non-ok responses throw immediately.
 * - The `fetchImpl`, `sleep`, and `endpoint` options are injectable so unit tests can
 *   drive every code path without real network I/O.
 */
export class HttpGraphqlClient implements GraphqlClient {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: HttpGraphqlClientOptions = {}) {
    this.endpoint = options.endpoint ?? KSD_GRAPHQL_ENDPOINT;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.maxRetries = options.maxRetries ?? 2;
    this.backoffBaseMs = options.backoffBaseMs ?? 500;
    this.sleep = options.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  }

  async request(
    query: string,
    variables: Record<string, unknown> | undefined,
    timeoutMs: number,
  ): Promise<GraphqlResponse> {
    const body = JSON.stringify({ query, variables });

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (response.status === 429) {
        if (attempt >= this.maxRetries) {
          throw new Error(`HTTP 429 ${response.statusText}`);
        }
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSec = retryAfterHeader !== null ? Number(retryAfterHeader) : NaN;
        const delayMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? retryAfterSec * 1000
          : this.backoffBaseMs * 2 ** attempt;
        await this.sleep(delayMs);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as GraphqlResponse;
    }

    // Should be unreachable — the loop always either returns or throws.
    throw new Error(`HTTP 429 Too Many Requests`);
  }
}
