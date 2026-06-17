import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertBell } from '../AlertBell';
import type { AlertUiState } from '@/lib/alerts';

describe('AlertBell', () => {
  const states: AlertUiState[] = ['saved', 'watch', 'triggered', 'paused', 'unavailable'];

  it.each(states)('state=%s → button has the correct aria-label', (state) => {
    const ARIA_LABELS: Record<AlertUiState, string> = {
      saved: 'Сповістити про ціну',
      watch: 'Змінити сповіщення про ціну',
      triggered: 'Ціль досягнута — змінити сповіщення',
      paused: 'Сповіщення призупинено',
      unavailable: 'Сповіщення недоступні',
    };
    render(<AlertBell state={state} />);
    expect(screen.getByRole('button', { name: ARIA_LABELS[state] })).toBeTruthy();
  });

  it('unavailable → button is disabled', () => {
    render(<AlertBell state="unavailable" />);
    expect(screen.getByRole('button', { name: 'Сповіщення недоступні' })).toBeDisabled();
  });

  it('saved → button is not disabled', () => {
    render(<AlertBell state="saved" />);
    expect(screen.getByRole('button', { name: 'Сповістити про ціну' })).not.toBeDisabled();
  });

  it('watch → button is not disabled', () => {
    render(<AlertBell state="watch" />);
    expect(screen.getByRole('button', { name: 'Змінити сповіщення про ціну' })).not.toBeDisabled();
  });

  it('onClick fires when state is enabled (saved)', () => {
    const onClick = vi.fn();
    render(<AlertBell state="saved" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Сповістити про ціну' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('onClick fires when state is watch', () => {
    const onClick = vi.fn();
    render(<AlertBell state="watch" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Змінити сповіщення про ціну' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('onClick fires when state is triggered', () => {
    const onClick = vi.fn();
    render(<AlertBell state="triggered" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ціль досягнута — змінити сповіщення' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('onClick fires when state is paused', () => {
    const onClick = vi.fn();
    render(<AlertBell state="paused" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Сповіщення призупинено' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
