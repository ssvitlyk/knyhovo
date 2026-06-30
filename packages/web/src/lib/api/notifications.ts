import type { NotificationPreferencesDto } from './types';

const REQUEST_TIMEOUT_MS = 8000;

/** Error thrown when a notifications request fails (network, timeout, or non-2xx). */
export class NotificationsError extends Error {
  /** HTTP status, or `null` for a transport/timeout failure. */
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'NotificationsError';
    this.status = status;
  }
}

function apiBaseUrl(): string {
  return process.env.API_BASE_URL ?? 'http://localhost:3000';
}

/**
 * Fetch the authenticated user's notification preferences (server-side).
 * Returns `{ unauthorized: true }` sentinel on 401.
 * Throws {@link NotificationsError} on other non-2xx or transport/timeout failures.
 */
export async function getNotificationPreferences({
  cookie,
}: {
  cookie: string;
}): Promise<NotificationPreferencesDto | { unauthorized: true }> {
  const url = `${apiBaseUrl()}/api/notifications/preferences`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { cookie },
    });
  } catch {
    throw new NotificationsError('Не вдалося звʼязатися з сервісом сповіщень.', null);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) return { unauthorized: true };

  if (!response.ok) {
    throw new NotificationsError(
      `Сервіс сповіщень повернув помилку (${response.status}).`,
      response.status,
    );
  }

  return (await response.json()) as NotificationPreferencesDto;
}

/**
 * Update the authenticated user's notification preferences (browser-side).
 * Uses a relative URL so the Next.js `/api/*` rewrite proxies the request.
 * Throws {@link NotificationsError} on non-2xx or transport/timeout failures.
 */
export async function updateNotificationPreferences(body: {
  priceDropEnabled?: boolean;
  backInStockEnabled?: boolean;
}): Promise<NotificationPreferencesDto> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('/api/notifications/preferences', {
      method: 'PATCH',
      signal: controller.signal,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new NotificationsError('Не вдалося оновити налаштування сповіщень.', null);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new NotificationsError(
      `Не вдалося оновити налаштування сповіщень (${response.status}).`,
      response.status,
    );
  }

  return (await response.json()) as NotificationPreferencesDto;
}

/**
 * Perform the global email unsubscribe via the backend token (server-side).
 * Calls `GET /api/notifications/unsubscribe?token=…`. Resolves silently on
 * any outcome — never throws to the page (the confirmation screen is always shown).
 */
export async function unsubscribe(token: string): Promise<void> {
  const url = `${apiBaseUrl()}/api/notifications/unsubscribe?token=${encodeURIComponent(token)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch {
    // Intentional: side-effect may have succeeded even if the response fails.
    // The confirmation screen is always shown.
  } finally {
    clearTimeout(timer);
  }
}
