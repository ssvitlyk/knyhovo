import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertConfig } from '../AlertConfig';
import type { MoneyDto } from '@/lib/api/types';

const CURRENT_PRICE: MoneyDto = { amount: 24000, currency: 'UAH' };

const DEFAULT_PROPS = {
  bookTitle: 'Кобзар',
  currentPrice: CURRENT_PRICE,
  typicalRangeMin: 20000,
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
};

describe('AlertConfig', () => {
  it('renders 3 intent radio buttons', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('radio labels: «Будь-яке зниження», «Нижче за поточну», «Вигідна ціна»', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    expect(screen.getByText('Будь-яке зниження')).toBeTruthy();
    expect(screen.getByText('Нижче за поточну')).toBeTruthy();
    expect(screen.getByText('Вигідна ціна')).toBeTruthy();
  });

  it('default selected intent is below-current (aria-checked=true)', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole('radio');
    // below-current is 2nd (index 1)
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    expect(radios[2]).toHaveAttribute('aria-checked', 'false');
  });

  it('clicking any-drop sets aria-checked=true on it and false on others', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]); // any-drop
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(radios[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('favourable-price is disabled when typicalRangeMin is null', () => {
    render(<AlertConfig {...DEFAULT_PROPS} typicalRangeMin={null} />);
    const radios = screen.getAllByRole('radio');
    const favourable = radios[2];
    expect(favourable).toBeDisabled();
  });

  it('favourable-price disabled → shows «Збираємо історію цін…» copy', () => {
    render(<AlertConfig {...DEFAULT_PROPS} typicalRangeMin={null} />);
    expect(screen.getByText('Збираємо історію цін…')).toBeTruthy();
  });

  it('favourable-price NOT disabled when typicalRangeMin is set', () => {
    render(<AlertConfig {...DEFAULT_PROPS} typicalRangeMin={20000} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[2]).not.toBeDisabled();
  });

  it('custom-price: «Вказати свою ціну» button is shown by default', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    expect(screen.getByText('Вказати свою ціну')).toBeTruthy();
  });

  it('clicking «Вказати свою ціну» opens the numeric input', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByText('Вказати свою ціну'));
    expect(screen.getByRole('textbox', { name: 'Власна ціна' })).toBeTruthy();
  });

  it('primary submit is disabled when resolvedAmount is null (currentPrice null + below-current)', () => {
    render(<AlertConfig {...DEFAULT_PROPS} currentPrice={null} />);
    // below-current with null currentPrice → resolvedAmount=null → submit disabled
    const submitBtn = screen.getByRole('button', { name: 'Увімкнути сповіщення' });
    expect(submitBtn).toBeDisabled();
  });

  it('primary submit enabled when intent resolves (any-drop with currentPrice)', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    // Switch to any-drop
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]);
    const submitBtn = screen.getByRole('button', { name: 'Увімкнути сповіщення' });
    expect(submitBtn).not.toBeDisabled();
  });

  it('clicking submit calls onSubmit with (intent, resolvedAmount in kopiyky)', () => {
    const onSubmit = vi.fn();
    render(<AlertConfig {...DEFAULT_PROPS} onSubmit={onSubmit} />);
    // below-current with currentPrice=24000 → resolvedAmount=24000
    const submitBtn = screen.getByRole('button', { name: 'Увімкнути сповіщення' });
    fireEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledWith('below-current', 24000);
  });

  it('edit mode → shows «Зберегти» and «Прибрати» buttons', () => {
    render(<AlertConfig {...DEFAULT_PROPS} editing />);
    expect(screen.getByRole('button', { name: 'Зберегти' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Прибрати' })).toBeTruthy();
  });

  it('edit mode + onPause → shows «Призупинити сповіщення» button', () => {
    render(<AlertConfig {...DEFAULT_PROPS} editing onPause={vi.fn()} />);
    expect(screen.getByText('Призупинити сповіщення')).toBeTruthy();
  });

  it('edit mode → does NOT show «Скасувати»', () => {
    render(<AlertConfig {...DEFAULT_PROPS} editing />);
    expect(screen.queryByRole('button', { name: 'Скасувати' })).toBeNull();
  });

  it('create mode → shows «Увімкнути сповіщення» and «Скасувати»', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: 'Увімкнути сповіщення' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Скасувати' })).toBeTruthy();
  });

  it('paused mode → shows «Поновити сповіщення» button', () => {
    render(<AlertConfig {...DEFAULT_PROPS} paused onResume={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Поновити сповіщення' })).toBeTruthy();
  });

  it('paused mode → title is «Сповіщення призупинено»', () => {
    render(<AlertConfig {...DEFAULT_PROPS} paused onResume={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('Сповіщення призупинено')).toBeTruthy();
  });

  it('busy=true → submit button is disabled', () => {
    render(<AlertConfig {...DEFAULT_PROPS} busy />);
    const submitBtn = screen.getByRole('button', { name: 'Увімкнути сповіщення' });
    expect(submitBtn).toBeDisabled();
  });

  it('titleId → applies the id to the config title element', () => {
    render(<AlertConfig {...DEFAULT_PROPS} titleId="cfg-title" />);
    const title = screen.getByText('Коли повідомити про ціну?');
    expect(title.getAttribute('id')).toBe('cfg-title');
  });

  it('custom-price disclosure → shows «× Скасувати» that closes the input', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByText('Вказати свою ціну'));
    expect(screen.getByRole('textbox', { name: 'Власна ціна' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Скасувати власну ціну' }));
    // Disclosure collapses back to the «Вказати свою ціну» link.
    expect(screen.queryByRole('textbox', { name: 'Власна ціна' })).toBeNull();
    expect(screen.getByText('Вказати свою ціну')).toBeTruthy();
  });

  it('errorNote → renders the provided node', () => {
    render(
      <AlertConfig
        {...DEFAULT_PROPS}
        errorNote={<div role="alert">Помилка мережі</div>}
      />,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Помилка мережі')).toBeTruthy();
  });
});
