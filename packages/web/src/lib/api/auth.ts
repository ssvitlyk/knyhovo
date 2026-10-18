import { apiBaseUrl } from './env';
import { apiJson, apiRequest, defineApiError, type ApiRequestOptions } from './http';
import type { AuthUserDto } from './types';

/** Error thrown when an auth request fails (network, timeout, or non-2xx, except 401 from me()). */
export class AuthError extends defineApiError('AuthError') {}

const TRANSPORT_MESSAGE = 'Unable to reach auth service.';

function authOptions(
  httpMessage: (status: number) => string,
  options: Pick<ApiRequestOptions, 'method' | 'body' | 'cookie' | 'passthrough'> = {},
): ApiRequestOptions {
  return {
    ...options,
    credentials: 'include',
    errorClass: AuthError,
    transportMessage: TRANSPORT_MESSAGE,
    httpMessage,
  };
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
  await apiRequest(
    '/api/auth/magic-link',
    authOptions((status) => `Magic link request failed (${status}).`, {
      method: 'POST',
      body: returnTo ? { email, returnTo } : { email },
    }),
  );
}

/**
 * Verify a Magic Link token, authenticating the session (cookie set by the API).
 * Runs browser-side with a relative URL. Returns the user and the sanitised
 * returnTo path. Throws {@link AuthError} on transport error or non-2xx response
 * (a 401 means the link is invalid/expired/used).
 */
export async function verifyMagicLink(token: string): Promise<VerifyLinkResult> {
  return apiJson<VerifyLinkResult>(
    '/api/auth/verify-link',
    authOptions((status) => `Verify link failed (${status}).`, {
      method: 'POST',
      body: { token },
    }),
  );
}

/**
 * Return the currently authenticated user, or `null` if not authenticated.
 * Unlike other auth functions, a 401 response is returned as `null` rather
 * than throwing, so callers can use this as a lightweight session check.
 * Server-side only: the session cookie must be forwarded explicitly via `cookie`
 * (server-side fetch has no ambient browser cookie).
 */
export async function me(cookie?: string): Promise<AuthUserDto | null> {
  const response = await apiRequest(
    `${apiBaseUrl()}/api/auth/me`,
    authOptions((status) => `me() failed (${status}).`, {
      method: 'GET',
      cookie,
      passthrough: (status) => status === 401,
    }),
  );

  if (response.status === 401) return null;

  const body = (await response.json()) as { user: AuthUserDto };
  return body.user;
}

/**
 * Log the current user out by clearing their session.
 * Runs browser-side (called from a client component): uses a relative `/api/*`
 * URL so the Next.js rewrite proxies it same-origin.
 * Throws {@link AuthError} on transport error or non-2xx response.
 */
export async function logout(): Promise<void> {
  await apiRequest(
    '/api/auth/logout',
    authOptions((status) => `Logout failed (${status}).`, { method: 'POST' }),
  );
}
