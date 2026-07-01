import type { AuthUserDto } from './types';

const REQUEST_TIMEOUT_MS = 8000;

/** Error thrown when a profile request fails (network, timeout, or non-2xx). */
export class ProfileError extends Error {
  /** HTTP status, or `null` for a transport/timeout failure. */
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'ProfileError';
    this.status = status;
  }
}

/**
 * Update the authenticated user's profile (browser-side).
 * Uses a relative URL so the Next.js `/api/*` rewrite proxies the request.
 * Throws {@link ProfileError} on non-2xx or transport/timeout failures.
 */
export async function updateProfile(body: {
  displayName: string | null;
}): Promise<AuthUserDto> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('/api/profile', {
      method: 'PATCH',
      signal: controller.signal,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ProfileError('Не вдалося оновити профіль.', null);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new ProfileError(
      `Не вдалося оновити профіль (${response.status}).`,
      response.status,
    );
  }

  return (await response.json()) as AuthUserDto;
}
