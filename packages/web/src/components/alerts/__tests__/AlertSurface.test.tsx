import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlertSurface } from '../AlertSurface';

function makeMatchMedia(matches: boolean): typeof window.matchMedia {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  // Default to desktop
  window.matchMedia = makeMatchMedia(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AlertSurface', () => {
  it('open=false → renders nothing', () => {
    const { container } = render(
      <AlertSurface open={false} onClose={vi.fn()}>
        <div>content</div>
      </AlertSurface>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('desktop (matches=false) → renders .al-pop with role="dialog"', async () => {
    window.matchMedia = makeMatchMedia(false);
    render(
      <AlertSurface open onClose={vi.fn()}>
        <div>desktop content</div>
      </AlertSurface>,
    );

    await waitFor(() => {
      expect(document.querySelector('.al-pop[role="dialog"]')).toBeTruthy();
    });
  });

  it('desktop → aria-modal="true" on the dialog', async () => {
    window.matchMedia = makeMatchMedia(false);
    render(
      <AlertSurface open onClose={vi.fn()}>
        <div>content</div>
      </AlertSurface>,
    );

    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog).toBeTruthy();
      expect(dialog?.getAttribute('aria-modal')).toBe('true');
    });
  });

  it('mobile (matches=true) → renders .al-sheet via portal in document.body', async () => {
    window.matchMedia = makeMatchMedia(true);
    render(
      <AlertSurface open onClose={vi.fn()}>
        <div>mobile content</div>
      </AlertSurface>,
    );

    await waitFor(() => {
      expect(document.querySelector('.al-sheet[role="dialog"]')).toBeTruthy();
    });
  });

  it('mobile → renders .al-overlay__scrim', async () => {
    window.matchMedia = makeMatchMedia(true);
    render(
      <AlertSurface open onClose={vi.fn()}>
        <div>mobile content</div>
      </AlertSurface>,
    );

    await waitFor(() => {
      expect(document.querySelector('.al-overlay__scrim')).toBeTruthy();
    });
  });

  it('mobile → clicking scrim calls onClose', async () => {
    window.matchMedia = makeMatchMedia(true);
    const onClose = vi.fn();
    render(
      <AlertSurface open onClose={onClose}>
        <div>mobile content</div>
      </AlertSurface>,
    );

    await waitFor(() => {
      expect(document.querySelector('.al-overlay__scrim')).toBeTruthy();
    });

    fireEvent.click(document.querySelector('.al-overlay__scrim')!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Escape key → calls onClose', async () => {
    window.matchMedia = makeMatchMedia(false);
    const onClose = vi.fn();
    render(
      <AlertSurface open onClose={onClose}>
        <div>content</div>
      </AlertSurface>,
    );

    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('children are rendered inside the dialog', async () => {
    window.matchMedia = makeMatchMedia(false);
    render(
      <AlertSurface open onClose={vi.fn()}>
        <span>унікальний контент</span>
      </AlertSurface>,
    );

    await waitFor(() => {
      expect(screen.getByText('унікальний контент')).toBeTruthy();
    });
  });
});
