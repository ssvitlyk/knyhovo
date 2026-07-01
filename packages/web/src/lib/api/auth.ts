import type { AuthUserDto } from './types';

const REQUEST_TIMEOUT_MS = 8000;

/** Error thrown when an auth request fails (network, timeout, or non-2xx, except 401 from me()). */
export class AuthError extends Error {
  /** HTTP status, or `null` for a transport/timeout failure. */
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

function apiBaseUrl(): string {
  return process.env.API_BASE_URL ?? 'http://localhost:3000';
}

async function authFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: controller.signal,
      credentials: 'include',
    });
  } catch {
    throw new AuthError('Unable to reach auth service.', null);
  } finally {
    clearTimeout(timer);
  }

  return response;
}

/** Result of a successful Magic Link verification. */
export interface VerifyLinkResult {
  readonly user: AuthUserDto;
  /** Validated internal path to redirect to, or `null` for the default landing. */
  readonly returnTo: string | null;
}

/**
 * Request a Magic Link email for `email` — the primary web login flow.
 * Runs browser-side: uses a relative `/api/*` URL so the Next.js rewrite proxies
 * it (same-origin), and the session cookie is later set on the web origin.
 * `returnTo` is the page to land on after login (validated server-side).
 * Throws {@link AuthError} on transport error or non-2xx response.
 */
export async function requestMagicLink(email: string, returnTo?: string | null): Promise<void> {
  const response = await authFetch('/api/auth/magic-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(returnTo ? { email, returnTo } : { email }),
  });

  if (!response.ok) {
    throw new AuthError(`Magic link request failed (${response.status}).`, response.status);
  }
}

/**
 * Verify a Magic Link token, authenticating the session (cookie set by the API).
 * Runs browser-side with a relative URL. Returns the user and the sanitised
 * returnTo path. Throws {@link AuthError} on transport error or non-2xx response
 * (a 401 means the link is invalid/expired/used).
 */
export async function verifyMagicLink(token: string): Promise<VerifyLinkResult> {
  const response = await authFetch('/api/auth/verify-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new AuthError(`Verify link failed (${response.status}).`, response.status);
  }

  return (await response.json()) as VerifyLinkResult;
}

/**
 * Request a 6-digit OTP login code for `email`.
 * Throws {@link AuthError} on transport error or non-2xx response.
 */
export async function requestCode(email: string): Promise<void> {
  const url = `${apiBaseUrl()}/api/auth/request-code`;
  const response = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new AuthError(`Request code failed (${response.status}).`, response.status);
  }
}

/**
 * Verify a 6-digit OTP code and authenticate the user.
 * Returns the authenticated user on success.
 * Throws {@link AuthError} on transport error or non-2xx response.
 */
export async function verifyCode(email: string, code: string): Promise<AuthUserDto> {
  const url = `${apiBaseUrl()}/api/auth/verify-code`;
  const response = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });

  if (!response.ok) {
    throw new AuthError(`Verify code failed (${response.status}).`, response.status);
  }

  const body = (await response.json()) as { user: AuthUserDto };
  return body.user;
}

/**
 * Return the currently authenticated user, or `null` if not authenticated.
 * Unlike other auth functions, a 401 response is returned as `null` rather
 * than throwing, so callers can use this as a lightweight session check.
 */
export async function me(cookie?: string): Promise<AuthUserDto | null> {
  const url = `${apiBaseUrl()}/api/auth/me`;
  // When called from a Server Component, forward the session cookie explicitly
  // (server-side fetch has no ambient browser cookie). Client calls omit it.
  const init: RequestInit = cookie
    ? { method: 'GET', headers: { cookie } }
    : { method: 'GET' };
  const response = await authFetch(url, init);

  if (response.status === 401) return null;

  if (!response.ok) {
    throw new AuthError(`me() failed (${response.status}).`, response.status);
  }

  const body = (await response.json()) as { user: AuthUserDto };
  return body.user;
}

/**
 * Log the current user out by clearing their session.
 * Throws {@link AuthError} on transport error or non-2xx response.
 */
export async function logout(): Promise<void> {
  const url = `${apiBaseUrl()}/api/auth/logout`;
  const response = await authFetch(url, { method: 'POST' });

  if (!response.ok) {
    throw new AuthError(`Logout failed (${response.status}).`, response.status);
  }
}
