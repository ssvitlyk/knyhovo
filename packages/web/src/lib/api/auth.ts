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
export async function me(): Promise<AuthUserDto | null> {
  const url = `${apiBaseUrl()}/api/auth/me`;
  const response = await authFetch(url, { method: 'GET' });

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
