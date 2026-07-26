import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertConfig } from '../AlertConfig';
import type { MoneyDto } from '@/lib/api/types';

const CURRENT_PRICE: MoneyDto = { amount: 24000, currency: 'UAH' };

const DEFAULT_PROPS = {
  bookTitle: 'Кобзар',
  currentPrice: CURRENT_PRICE,
  favourablePrice: 20000,
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
};

describe('AlertConfig', () => {
  it('renders 4 intent radio buttons', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
  });

  it('radio labels in order: «Будь-яке зниження», «Нижче за поточну», «Вигідна ціна», «Вказати свою ціну»', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveTextContent('Будь-яке зниження');
    expect(radios[1]).toHaveTextContent('Нижче за поточну');
    expect(radios[2]).toHaveTextContent('Вигідна ціна');
    expect(radios[3]).toHaveTextContent('Вказати свою ціну');
  });

  it('default selected intent is below-current (aria-checked=true)', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole('radio');
    // below-current is 2nd (index 1)
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    expect(radios[2]).toHaveAttribute('aria-checked', 'false');
    expect(radios[3]).toHaveAttribute('aria-checked', 'false');
  });

  it('clicking any-drop sets aria-checked=true on it and false on others', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]); // any-drop
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(radios[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('favourable-price is disabled when favourablePrice is null', () => {
    render(<AlertConfig {...DEFAULT_PROPS} favourablePrice={null} />);
    const radios = screen.getAllByRole('radio');
    const favourable = radios[2];
    expect(favourable).toBeDisabled();
  });

  it('favourable-price disabled → shows «Визначаємо вигідну ціну» copy', () => {
    render(<AlertConfig {...DEFAULT_PROPS} favourablePrice={null} favourableState="collecting" />);
    expect(screen.getByText('Визначаємо вигідну ціну')).toBeTruthy();
  });

  it('favourable-price disabled → shows no price text', () => {
    render(<AlertConfig {...DEFAULT_PROPS} favourablePrice={null} favourableState="collecting" />);
    const radios = screen.getAllByRole('radio');
    expect(radios[2]).not.toHaveTextContent('₴');
  });

  it('favourable-price NOT disabled when favourablePrice is set', () => {
    render(<AlertConfig {...DEFAULT_PROPS} favourablePrice={20000} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[2]).not.toBeDisabled();
  });

  it('favourable-price shows its threshold as "< 200 ₴" text, never the current price', () => {
    render(<AlertConfig {...DEFAULT_PROPS} favourablePrice={20000} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[2]).toHaveTextContent('< 200 ₴');
    expect(radios[2]).not.toHaveTextContent('240 ₴');
  });

  it('below-current shows its threshold as "< 240 ₴" text', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[1]).toHaveTextContent('< 240 ₴');
  });

  it('any-drop and below-current are disabled with «Немає поточної ціни» when currentPrice is null', () => {
    render(<AlertConfig {...DEFAULT_PROPS} currentPrice={null} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toBeDisabled();
    expect(radios[1]).toBeDisabled();
    expect(screen.getAllByText('Немає поточної ціни')).toHaveLength(2);
  });

  it('«Вказати свою ціну» radio is present by default (not a text-link disclosure)', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[3]).toHaveTextContent('Вказати свою ціну');
    // The inline field is not shown until the radio is selected.
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('selecting «Вказати свою ціну» reveals the inline numeric field', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[3]);
    expect(screen.getByRole('textbox', { name: 'Вказати свою ціну' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Підтвердити' })).toBeTruthy();
  });

  it('«Підтвердити» is disabled until a valid amount is typed', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getAllByRole('radio')[3]);
    const confirmBtn = screen.getByRole('button', { name: 'Підтвердити' });
    expect(confirmBtn).toBeDisabled();

    const input = screen.getByRole('textbox', { name: 'Вказати свою ціну' });
    fireEvent.change(input, { target: { value: '199' } });
    expect(confirmBtn).not.toBeDisabled();
  });

  it('«Зберегти» stays disabled for custom-price until the amount is confirmed, then enables', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getAllByRole('radio')[3]);
    const saveBtn = screen.getByRole('button', { name: 'Зберегти' });
    expect(saveBtn).toBeDisabled();

    const input = screen.getByRole('textbox', { name: 'Вказати свою ціну' });
    fireEvent.change(input, { target: { value: '199' } });
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }));

    expect(saveBtn).not.toBeDisabled();
  });

  it('after confirming, the hint reads «Поріг — нижче 199 ₴»', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getAllByRole('radio')[3]);
    fireEvent.change(screen.getByRole('textbox', { name: 'Вказати свою ціну' }), {
      target: { value: '199' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }));

    expect(screen.getByText(/Поріг — нижче 199 ₴/)).toBeTruthy();
  });

  it('submitting custom-price sends intent "custom-price" with the confirmed kopiyky amount', () => {
    const onSubmit = vi.fn();
    render(<AlertConfig {...DEFAULT_PROPS} onSubmit={onSubmit} />);
    fireEvent.click(screen.getAllByRole('radio')[3]);
    fireEvent.change(screen.getByRole('textbox', { name: 'Вказати свою ціну' }), {
      target: { value: '199' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }));
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));

    expect(onSubmit).toHaveBeenCalledWith('custom-price', 19900);
  });

  it('primary submit is disabled when resolvedAmount is null (currentPrice null + below-current)', () => {
    render(<AlertConfig {...DEFAULT_PROPS} currentPrice={null} />);
    // below-current with null currentPrice → resolvedAmount=null → submit disabled
    const submitBtn = screen.getByRole('button', { name: 'Зберегти' });
    expect(submitBtn).toBeDisabled();
  });

  it('primary submit enabled when intent resolves (any-drop with currentPrice)', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    // Switch to any-drop
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]);
    const submitBtn = screen.getByRole('button', { name: 'Зберегти' });
    expect(submitBtn).not.toBeDisabled();
  });

  it('clicking submit calls onSubmit with (intent, currentAmount - 1 kopiyka)', () => {
    const onSubmit = vi.fn();
    render(<AlertConfig {...DEFAULT_PROPS} onSubmit={onSubmit} />);
    // below-current with currentPrice=24000 → resolvedAmount=23999
    const submitBtn = screen.getByRole('button', { name: 'Зберегти' });
    fireEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledWith('below-current', 23999);
  });

  it('create mode → shows «Скасувати» and «Зберегти» in the footer', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: 'Скасувати' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Зберегти' })).toBeTruthy();
  });

  it('edit mode → shows «Прибрати сповіщення» and «Зберегти» buttons', () => {
    render(<AlertConfig {...DEFAULT_PROPS} editing />);
    expect(screen.getByRole('button', { name: 'Зберегти' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Прибрати сповіщення' })).toBeTruthy();
  });

  it('edit mode + onPause → shows «Призупинити сповіщення» button', () => {
    render(<AlertConfig {...DEFAULT_PROPS} editing onPause={vi.fn()} />);
    expect(screen.getByText('Призупинити сповіщення')).toBeTruthy();
  });

  it('edit mode → does NOT show «Скасувати»', () => {
    render(<AlertConfig {...DEFAULT_PROPS} editing />);
    expect(screen.queryByRole('button', { name: 'Скасувати' })).toBeNull();
  });

  it('paused mode → shows «Прибрати сповіщення» and «Поновити сповіщення» buttons', () => {
    render(<AlertConfig {...DEFAULT_PROPS} paused onResume={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Прибрати сповіщення' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Поновити сповіщення' })).toBeTruthy();
  });

  it('paused mode → title is «Сповіщення призупинено»', () => {
    render(<AlertConfig {...DEFAULT_PROPS} paused onResume={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('Сповіщення призупинено')).toBeTruthy();
  });

  it('busy=true → submit button is disabled', () => {
    render(<AlertConfig {...DEFAULT_PROPS} busy />);
    const submitBtn = screen.getByRole('button', { name: 'Зберегти' });
    expect(submitBtn).toBeDisabled();
  });

  it('titleId → applies the id to the config title element', () => {
    render(<AlertConfig {...DEFAULT_PROPS} titleId="cfg-title" />);
    const title = screen.getByText('Коли повідомити про ціну?');
    expect(title.getAttribute('id')).toBe('cfg-title');
  });

  it('header close button (aria-label="Закрити") calls onCancel', () => {
    const onCancel = vi.fn();
    render(<AlertConfig {...DEFAULT_PROPS} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Закрити' }));
    expect(onCancel).toHaveBeenCalledOnce();
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

  it('initialCustomAmount pre-confirms the custom-price field', () => {
    render(<AlertConfig {...DEFAULT_PROPS} initialCustomAmount={19900} initialIntent="custom-price" />);
    expect(screen.getByText(/Поріг — нижче 199 ₴/)).toBeTruthy();
    const saveBtn = screen.getByRole('button', { name: 'Зберегти' });
    expect(saveBtn).not.toBeDisabled();
  });
});
