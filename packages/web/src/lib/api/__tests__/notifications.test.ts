import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  unsubscribe,
  NotificationsError,
} from '../notifications';
import type { NotificationPreferencesDto } from '../types';

const PREFS: NotificationPreferencesDto = {
  priceDropEnabled: true,
  backInStockEnabled: false,
  unsubscribed: false,
};

function mockFetch(impl: typeof fetch): void {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getNotificationPreferences()', () => {
  it('200 → returns DTO', async () => {
    mockFetch((async () =>
      new Response(JSON.stringify(PREFS), { status: 200 })) as typeof fetch);

    const result = await getNotificationPreferences({ cookie: 'kn_session=abc' });
    expect(result).toEqual(PREFS);
  });

  it('401 → returns { unauthorized: true }', async () => {
    mockFetch((async () => new Response('{}', { status: 401 })) as typeof fetch);

    const result = await getNotificationPreferences({ cookie: '' });
    expect(result).toEqual({ unauthorized: true });
  });

  it('500 → throws NotificationsError with status', async () => {
    mockFetch((async () => new Response('{}', { status: 500 })) as typeof fetch);

    await expect(getNotificationPreferences({ cookie: '' })).rejects.toMatchObject({
      name: 'NotificationsError',
      status: 500,
    });
  });

  it('network failure → throws NotificationsError with null status', async () => {
    mockFetch((async () => { throw new Error('network'); }) as typeof fetch);

    const err = await getNotificationPreferences({ cookie: '' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotificationsError);
    expect((err as NotificationsError).status).toBeNull();
  });
});

describe('updateNotificationPreferences()', () => {
  it('sends PATCH with JSON body and credentials:include, 200 → DTO', async () => {
    let capturedInit: RequestInit | undefined;
    mockFetch((async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify(PREFS), { status: 200 });
    }) as typeof fetch);

    const result = await updateNotificationPreferences({ priceDropEnabled: true });
    expect(result).toEqual(PREFS);
    expect(capturedInit?.method).toBe('PATCH');
    expect(capturedInit?.credentials).toBe('include');
    expect(JSON.parse(capturedInit?.body as string)).toEqual({ priceDropEnabled: true });
  });

  it('non-2xx → throws NotificationsError', async () => {
    mockFetch((async () => new Response('{}', { status: 422 })) as typeof fetch);

    await expect(updateNotificationPreferences({ backInStockEnabled: false })).rejects.toMatchObject({
      name: 'NotificationsError',
      status: 422,
    });
  });
});

describe('unsubscribe()', () => {
  it('resolves on 200 ok', async () => {
    mockFetch((async () => new Response('', { status: 200 })) as typeof fetch);
    await expect(unsubscribe('my-token')).resolves.toBeUndefined();
  });

  it('resolves even on failure (never throws)', async () => {
    mockFetch((async () => { throw new Error('network'); }) as typeof fetch);
    await expect(unsubscribe('bad-token')).resolves.toBeUndefined();
  });
});
