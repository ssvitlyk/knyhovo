/** Single request timeout for every backend call (security rule: explicit timeout, no hidden retries). */
export const REQUEST_TIMEOUT_MS = 8000;

/** Base error for every failed API request (network, timeout, or non-2xx). */
export class ApiError extends Error {
  /** HTTP status, or `null` for a transport/timeout failure. */
  readonly status: number | null;
  /** API error-envelope code (e.g. `COLLECTION_NOT_FOUND`), when the body carried one. */
  readonly code: string | null;

  constructor(message: string, status: number | null, code: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export type ApiErrorCtor = new (
  message: string,
  status: number | null,
  code?: string | null,
) => ApiError;

/**
 * Build a named {@link ApiError} subclass. The name is set explicitly (not via
 * `new.target.name`) so it survives minification and `.name` checks keep working.
 */
export function defineApiError(name: string): ApiErrorCtor {
  return class extends ApiError {
    constructor(message: string, status: number | null, code: string | null = null) {
      super(message, status, code);
      this.name = name;
    }
  };
}

export interface ApiRequestOptions {
  readonly method?: string;
  /** JSON-serialised; sets `Content-Type: application/json`. */
  readonly body?: unknown;
  /** Session cookie forwarded explicitly (server-side fetch has no ambient cookie). */
  readonly cookie?: string;
  readonly cache?: RequestCache;
  readonly credentials?: RequestCredentials;
  readonly redirect?: RequestRedirect;
  /** Error class thrown on failure. Default {@link ApiError}. */
  readonly errorClass?: ApiErrorCtor;
  /** Message for a transport/timeout failure (status `null`). */
  readonly transportMessage: string;
  /** Message for a non-ok response. Default `Request failed (status).` */
  readonly httpMessage?: (status: number) => string;
  /** Prefer the `{ error: { code, message } }` body's message/code on non-ok. */
  readonly envelope?: boolean;
  /** When set, a transport failure is logged as `[tag] transport failure`. */
  readonly logTag?: string;
  /** Statuses that are returned to the caller instead of throwing. */
  readonly passthrough?: (status: number) => boolean;
}

/** Parse the repo-standard error envelope `{ error: { code, message } }`; nulls when absent. */
export async function readErrorEnvelope(
  response: Response,
): Promise<{ code: string | null; message: string | null }> {
  try {
    const body = (await response.json()) as {
      error?: { code?: unknown; message?: unknown };
    };
    return {
      code: typeof body.error?.code === 'string' ? body.error.code : null,
      message: typeof body.error?.message === 'string' ? body.error.message : null,
    };
  } catch {
    return { code: null, message: null };
  }
}

/**
 * fetch with AbortController timeout. Transport/timeout failure →
 * `errorClass(transportMessage, null)`; non-ok (unless passed through) →
 * `errorClass(httpMessage(status), status[, envelope code])`.
 */
export async function apiRequest(url: string, options: ApiRequestOptions): Promise<Response> {
  const ErrorClass = options.errorClass ?? ApiError;

  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.cookie) headers.cookie = options.cookie;

  const init: RequestInit = {
    ...(options.method ? { method: options.method } : {}),
    ...(options.cache ? { cache: options.cache } : {}),
    ...(options.credentials ? { credentials: options.credentials } : {}),
    ...(options.redirect ? { redirect: options.redirect } : {}),
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch (cause) {
    if (options.logTag) console.error(`[${options.logTag}] transport failure`, { url, cause });
    throw new ErrorClass(options.transportMessage, null);
  } finally {
    clearTimeout(timer);
  }

  if (response.ok || options.passthrough?.(response.status)) return response;

  const fallback = options.httpMessage
    ? options.httpMessage(response.status)
    : `Request failed (${response.status}).`;
  if (options.envelope) {
    const envelope = await readErrorEnvelope(response);
    throw new ErrorClass(envelope.message ?? fallback, response.status, envelope.code);
  }
  throw new ErrorClass(fallback, response.status);
}

/** {@link apiRequest} followed by `response.json()`. */
export async function apiJson<T>(url: string, options: ApiRequestOptions): Promise<T> {
  const response = await apiRequest(url, options);
  return (await response.json()) as T;
}
