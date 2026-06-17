import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AlertToast } from '../AlertToast';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AlertToast', () => {
  it('renders children after mount', async () => {
    const onDismiss = vi.fn();
    render(<AlertToast onDismiss={onDismiss}>Сповіщення увімкнено</AlertToast>);

    // Flush useEffect that sets mounted=true
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByText('Сповіщення увімкнено')).toBeTruthy();
  });

  it('has role="status" on the toast wrap', async () => {
    const onDismiss = vi.fn();
    render(<AlertToast onDismiss={onDismiss}>Привіт</AlertToast>);

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('calls onDismiss after default durationMs (4000ms)', async () => {
    const onDismiss = vi.fn();
    render(<AlertToast onDismiss={onDismiss}>Тест</AlertToast>);

    // Flush mount effect
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(onDismiss).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('calls onDismiss after custom durationMs', async () => {
    const onDismiss = vi.fn();
    render(
      <AlertToast onDismiss={onDismiss} durationMs={1500}>
        Тест
      </AlertToast>,
    );

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    await act(async () => {
      vi.advanceTimersByTime(1499);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('renders a manual dismiss button with an accessible name', async () => {
    const onDismiss = vi.fn();
    render(<AlertToast onDismiss={onDismiss}>Тест</AlertToast>);

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByRole('button', { name: 'Сховати сповіщення' })).toBeTruthy();
  });

  it('clicking the dismiss button calls onDismiss before auto-dismiss', async () => {
    const onDismiss = vi.fn();
    render(<AlertToast onDismiss={onDismiss}>Тест</AlertToast>);

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Сховати сповіщення' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('does not call onDismiss before durationMs elapses', async () => {
    const onDismiss = vi.fn();
    render(<AlertToast onDismiss={onDismiss}>Тест</AlertToast>);

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    await act(async () => {
      vi.advanceTimersByTime(3999);
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
