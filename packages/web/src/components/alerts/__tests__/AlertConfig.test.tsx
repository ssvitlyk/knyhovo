import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertConfig } from '../AlertConfig';
import type { AlertModePreviewDto, MoneyDto } from '@/lib/api/types';

const CURRENT_PRICE: MoneyDto = { amount: 24000, currency: 'UAH' };

const PREVIEW: readonly AlertModePreviewDto[] = [
  {
    mode: 'any-drop',
    available: true,
    threshold: { amount: 24000, currency: 'UAH' },
    proof: null,
    reason: null,
  },
  {
    mode: 'good-price',
    available: true,
    threshold: { amount: 20000, currency: 'UAH' },
    proof: 'дешевше, ніж у 80 % днів за пів року',
    reason: null,
  },
  {
    mode: 'my-price',
    available: true,
    threshold: null,
    proof: null,
    reason: null,
  },
];

const DEFAULT_PROPS = {
  bookTitle: 'Кобзар',
  currentPrice: CURRENT_PRICE,
  preview: PREVIEW,
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
};

describe('AlertConfig', () => {
  it('renders exactly 3 mode radio cards, in preview order', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveTextContent('Будь-яке зниження');
    expect(radios[1]).toHaveTextContent('Вигідна ціна');
    expect(radios[2]).toHaveTextContent('Моя ціна');
  });

  it('default selected mode is the first available preview entry (any-drop)', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(radios[1]).toHaveAttribute('aria-checked', 'false');
    expect(radios[2]).toHaveAttribute('aria-checked', 'false');
  });

  it('any-drop shows the static «Щойно ціна впаде» description and no threshold', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveTextContent('Щойно ціна впаде');
    expect(radios[0]).not.toHaveTextContent('₴');
  });

  it('good-price shows its threshold as "< 200 ₴" and its own proof string verbatim', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[1]).toHaveTextContent('< 200 ₴');
    expect(radios[1]).toHaveTextContent('дешевше, ніж у 80 % днів за пів року');
  });

  it('clicking good-price selects it and deselects any-drop', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]);
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
  });

  /* ── unavailable card ─────────────────────────────────────────────────── */
  it('an unavailable entry renders disabled, shows its reason instead of a description, and no threshold', () => {
    const preview: readonly AlertModePreviewDto[] = [
      PREVIEW[0],
      { mode: 'good-price', available: false, threshold: null, proof: null, reason: 'Збираємо історію цін' },
      PREVIEW[2],
    ];
    render(<AlertConfig {...DEFAULT_PROPS} preview={preview} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[1]).toHaveAttribute('aria-disabled', 'true');
    expect(radios[1]).toHaveTextContent('Збираємо історію цін');
    expect(radios[1]).not.toHaveTextContent('₴');
  });

  it('an unavailable entry cannot be selected by clicking', () => {
    const preview: readonly AlertModePreviewDto[] = [
      PREVIEW[0],
      { mode: 'good-price', available: false, threshold: null, proof: null, reason: 'Збираємо історію цін' },
      PREVIEW[2],
    ];
    render(<AlertConfig {...DEFAULT_PROPS} preview={preview} />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]);
    expect(radios[1]).toHaveAttribute('aria-checked', 'false');
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
  });

  /* ── my-price confirm-gating ──────────────────────────────────────────── */
  it('selecting «Моя ціна» reveals the inline numeric field', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getAllByRole('radio')[2]);
    expect(screen.getByRole('textbox', { name: 'Моя ціна' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Підтвердити' })).toBeTruthy();
  });

  it('«Підтвердити» is disabled until a valid amount is typed, then enables', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getAllByRole('radio')[2]);
    const confirmBtn = screen.getByRole('button', { name: 'Підтвердити' });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Моя ціна' }), { target: { value: '199' } });
    expect(confirmBtn).not.toBeDisabled();
  });

  it('«Зберегти» stays disabled for my-price until the amount is confirmed, then enables', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getAllByRole('radio')[2]);
    const saveBtn = screen.getByRole('button', { name: 'Зберегти' });
    expect(saveBtn).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Моя ціна' }), { target: { value: '199' } });
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }));

    expect(saveBtn).not.toBeDisabled();
  });

  it('after confirming, shows «Поріг — нижче 199 ₴»', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getAllByRole('radio')[2]);
    fireEvent.change(screen.getByRole('textbox', { name: 'Моя ціна' }), { target: { value: '199' } });
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }));

    expect(screen.getByText(/Поріг — нижче 199 ₴/)).toBeTruthy();
  });

  it('switching mode away and back preserves the typed (unconfirmed) my-price value', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[2]);
    fireEvent.change(screen.getByRole('textbox', { name: 'Моя ціна' }), { target: { value: '199' } });

    // Switch to any-drop, then back to my-price.
    fireEvent.click(radios[0]);
    fireEvent.click(radios[2]);

    expect(screen.getByRole('textbox', { name: 'Моя ціна' })).toHaveValue('199');
  });

  it('Enter inside the my-price field confirms it, not save', () => {
    const onSubmit = vi.fn();
    render(<AlertConfig {...DEFAULT_PROPS} onSubmit={onSubmit} />);
    fireEvent.click(screen.getAllByRole('radio')[2]);
    const input = screen.getByRole('textbox', { name: 'Моя ціна' });
    fireEvent.change(input, { target: { value: '199' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText(/Поріг — нижче 199 ₴/)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submitting my-price sends mode "my-price" with the confirmed kopiyky threshold', () => {
    const onSubmit = vi.fn();
    render(<AlertConfig {...DEFAULT_PROPS} onSubmit={onSubmit} />);
    fireEvent.click(screen.getAllByRole('radio')[2]);
    fireEvent.change(screen.getByRole('textbox', { name: 'Моя ціна' }), { target: { value: '199' } });
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }));
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));

    expect(onSubmit).toHaveBeenCalledWith('my-price', { amount: 19900, currency: 'UAH' });
  });

  it('submitting any-drop sends only the mode, no threshold argument', () => {
    const onSubmit = vi.fn();
    render(<AlertConfig {...DEFAULT_PROPS} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));
    expect(onSubmit).toHaveBeenCalledWith('any-drop');
  });

  it('initialThresholdAmount pre-fills and pre-confirms the my-price field', () => {
    render(
      <AlertConfig
        {...DEFAULT_PROPS}
        initialMode="my-price"
        initialThresholdAmount={19900}
      />,
    );
    expect(screen.getByText(/Поріг — нижче 199 ₴/)).toBeTruthy();
    const saveBtn = screen.getByRole('button', { name: 'Зберегти' });
    expect(saveBtn).not.toBeDisabled();
  });

  /* ── error rendering (realistic 422/409 server message) ──────────────── */
  it('errorNote renders the server message verbatim (e.g. a 422 THRESHOLD_NOT_BELOW_CURRENT sentence)', () => {
    render(
      <AlertConfig
        {...DEFAULT_PROPS}
        errorNote={<div role="alert">Ціна має бути нижчою за поточну.</div>}
      />,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Ціна має бути нижчою за поточну.')).toBeTruthy();
  });

  it('errorNote renders a 409 INSUFFICIENT_HISTORY sentence verbatim', () => {
    render(
      <AlertConfig
        {...DEFAULT_PROPS}
        errorNote={<div role="alert">Ще збираємо історію цін для цієї книги.</div>}
      />,
    );
    expect(screen.getByText('Ще збираємо історію цін для цієї книги.')).toBeTruthy();
  });

  /* ── modes: create / edit / paused ────────────────────────────────────── */
  it('create mode → shows «Скасувати» and «Зберегти» in the footer', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: 'Скасувати' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Зберегти' })).toBeTruthy();
  });

  it('edit mode → shows a quiet «Прибрати сповіщення» text action and «Зберегти»', () => {
    render(<AlertConfig {...DEFAULT_PROPS} editing />);
    expect(screen.getByRole('button', { name: 'Зберегти' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Прибрати сповіщення' })).toBeTruthy();
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

  /* ── keyboard ─────────────────────────────────────────────────────────── */
  it('ArrowDown/ArrowUp move the selection between modes', () => {
    render(<AlertConfig {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole('radio');
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowDown' });
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(group, { key: 'ArrowUp' });
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('ArrowDown skips a disabled entry', () => {
    const preview: readonly AlertModePreviewDto[] = [
      PREVIEW[0],
      { mode: 'good-price', available: false, threshold: null, proof: null, reason: 'Збираємо історію цін' },
      PREVIEW[2],
    ];
    render(<AlertConfig {...DEFAULT_PROPS} preview={preview} />);
    const radios = screen.getAllByRole('radio');
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowDown' });
    expect(radios[2]).toHaveAttribute('aria-checked', 'true');
  });

  it('Enter on the radiogroup saves (when not focused inside the my-price input)', () => {
    const onSubmit = vi.fn();
    render(<AlertConfig {...DEFAULT_PROPS} onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('any-drop');
  });
});
