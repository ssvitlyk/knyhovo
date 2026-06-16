import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlertTarget } from '../AlertTarget';
import type { MoneyDto } from '@/lib/api/types';

const TARGET_PRICE: MoneyDto = { amount: 24000, currency: 'UAH' };
const CURRENT_PRICE: MoneyDto = { amount: 20000, currency: 'UAH' };

describe('AlertTarget', () => {
  it('saved → renders nothing', () => {
    const { container } = render(
      <AlertTarget state="saved" intent="any-drop" targetPrice={TARGET_PRICE} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('watch + any-drop → shows "Книговик напише, щойно ціна впаде."', () => {
    render(<AlertTarget state="watch" intent="any-drop" targetPrice={TARGET_PRICE} />);
    expect(screen.getByText('Книговик напише, щойно ціна впаде.')).toBeTruthy();
  });

  it('watch + below-current → shows target price copy with formatted price', () => {
    render(<AlertTarget state="watch" intent="below-current" targetPrice={TARGET_PRICE} />);
    expect(screen.getByText(/Книговик напише, коли ціна стане/)).toBeTruthy();
    expect(screen.getByText(/240 ₴/)).toBeTruthy();
  });

  it('watch + favourable-price → shows target price copy', () => {
    render(<AlertTarget state="watch" intent="favourable-price" targetPrice={TARGET_PRICE} />);
    expect(screen.getByText(/нижче/)).toBeTruthy();
    expect(screen.getByText(/240 ₴/)).toBeTruthy();
  });

  it('triggered + currentPrice → green variant with current and target prices', () => {
    const { container } = render(
      <AlertTarget
        state="triggered"
        intent="below-current"
        targetPrice={TARGET_PRICE}
        currentPrice={CURRENT_PRICE}
      />,
    );
    expect(container.querySelector('.al-target--green')).toBeTruthy();
    expect(screen.getByText(/Ціна впала до/)).toBeTruthy();
    expect(screen.getByText(/200 ₴/)).toBeTruthy();
    expect(screen.getByText(/240 ₴/)).toBeTruthy();
  });

  it('triggered + no currentPrice → shows simpler "Ціль досягнута" copy', () => {
    const { container } = render(
      <AlertTarget
        state="triggered"
        intent="below-current"
        targetPrice={TARGET_PRICE}
        currentPrice={null}
      />,
    );
    expect(container.querySelector('.al-target--green')).toBeTruthy();
    expect(screen.getByText(/Ціль/)).toBeTruthy();
    expect(screen.getByText(/досягнута/)).toBeTruthy();
  });

  it('paused → shows "Поновіть, щоб Книговик стежив далі."', () => {
    render(<AlertTarget state="paused" intent="any-drop" targetPrice={TARGET_PRICE} />);
    expect(screen.getByText('Поновіть, щоб Книговик стежив далі.')).toBeTruthy();
  });

  it('unavailable → shows "Сповістимо, щойно книга з\'явиться."', () => {
    render(<AlertTarget state="unavailable" intent="any-drop" targetPrice={TARGET_PRICE} />);
    expect(screen.getByText(/Сповістимо, щойно книга з/)).toBeTruthy();
  });
});
