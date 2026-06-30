import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NotificationsPanel } from '../NotificationsPanel';
import type { NotificationPreferencesDto } from '@/lib/api/types';

// Mock the api module
vi.mock('@/lib/api/notifications', () => ({
  updateNotificationPreferences: vi.fn(),
}));

// Mock AlertToast portal (jsdom has no document.body portal target issues)
vi.mock('@/components/alerts/AlertToast', () => ({
  AlertToast: ({ children }: { children: React.ReactNode }) => (
    <div role="status">{children}</div>
  ),
}));

import { updateNotificationPreferences } from '@/lib/api/notifications';
const mockUpdate = vi.mocked(updateNotificationPreferences);

const SUBSCRIBED: NotificationPreferencesDto = {
  priceDropEnabled: true,
  backInStockEnabled: true,
  unsubscribed: false,
};

const UNSUBSCRIBED: NotificationPreferencesDto = {
  priceDropEnabled: false,
  backInStockEnabled: false,
  unsubscribed: true,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('NotificationsPanel (subscribed)', () => {
  it('renders both cards and the helper text', () => {
    render(<NotificationsPanel initial={SUBSCRIBED} />);
    expect(screen.getByText('Сповіщення про зниження ціни')).toBeInTheDocument();
    expect(screen.getByText('Повернення в наявність')).toBeInTheDocument();
    expect(screen.getByText('Зміни зберігаються автоматично')).toBeInTheDocument();
  });

  it('toggling priceDrop calls updateNotificationPreferences with the changed field', async () => {
    mockUpdate.mockResolvedValueOnce({ ...SUBSCRIBED, priceDropEnabled: false });
    render(<NotificationsPanel initial={SUBSCRIBED} />);

    const toggle = screen.getByRole('switch', { name: 'Сповіщення про зниження ціни' });
    fireEvent.click(toggle);

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ priceDropEnabled: false }));
  });

  it('shows toast on success', async () => {
    mockUpdate.mockResolvedValueOnce(SUBSCRIBED);
    render(<NotificationsPanel initial={SUBSCRIBED} />);

    const toggle = screen.getByRole('switch', { name: 'Повернення в наявність' });
    fireEvent.click(toggle);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Налаштування збережено'));
  });

  it('disables both controls while in-flight', async () => {
    let resolve!: (v: NotificationPreferencesDto) => void;
    mockUpdate.mockImplementationOnce(() => new Promise<NotificationPreferencesDto>((r) => { resolve = r; }));

    render(<NotificationsPanel initial={SUBSCRIBED} />);

    const toggle = screen.getByRole('switch', { name: 'Сповіщення про зниження ціни' });
    fireEvent.click(toggle);

    // Both should be disabled while saving
    const switches = screen.getAllByRole('switch');
    for (const sw of switches) {
      expect(sw).toBeDisabled();
    }

    resolve(SUBSCRIBED);
  });

  it('reverts toggle and shows error note on PATCH failure', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('fail'));
    render(<NotificationsPanel initial={SUBSCRIBED} />);

    const toggle = screen.getByRole('switch', { name: 'Сповіщення про зниження ціни' });
    fireEvent.click(toggle);

    await waitFor(() =>
      expect(screen.getByText('Не вдалося зберегти налаштування. Спробуйте ще раз.')).toBeInTheDocument(),
    );
    // Toggle should be reverted back to checked
    expect(toggle).toBeChecked();
  });
});

describe('NotificationsPanel (unsubscribed)', () => {
  it('shows neutral badge and disabled cards, does not call PATCH', async () => {
    render(<NotificationsPanel initial={UNSUBSCRIBED} />);

    expect(screen.getByText('Ви відписані від усіх сповіщень')).toBeInTheDocument();
    const switches = screen.getAllByRole('switch');
    for (const sw of switches) {
      expect(sw).toBeDisabled();
    }

    // Should not call update
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
