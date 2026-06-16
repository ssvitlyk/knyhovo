import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlertChip } from '../AlertChip';
import type { AlertChipState } from '../AlertChip';

describe('AlertChip', () => {
  it('watch → label "Стежимо за ціною"', () => {
    render(<AlertChip state="watch" />);
    expect(screen.getByText('Стежимо за ціною')).toBeTruthy();
  });

  it('triggered → label "Ціль досягнута"', () => {
    render(<AlertChip state="triggered" />);
    expect(screen.getByText('Ціль досягнута')).toBeTruthy();
  });

  it('paused → label "Призупинено"', () => {
    render(<AlertChip state="paused" />);
    expect(screen.getByText('Призупинено')).toBeTruthy();
  });

  it('unavailable → label "Сповіщення недоступні"', () => {
    render(<AlertChip state="unavailable" />);
    expect(screen.getByText('Сповіщення недоступні')).toBeTruthy();
  });

  const cssSuffixes: Array<[AlertChipState, string]> = [
    ['watch', 'al-chip--watch'],
    ['triggered', 'al-chip--trig'],
    ['paused', 'al-chip--paused'],
    ['unavailable', 'al-chip--unavail'],
  ];

  it.each(cssSuffixes)('state=%s → has class %s', (state, expectedClass) => {
    const { container } = render(<AlertChip state={state} />);
    const el = container.querySelector(`.${expectedClass}`);
    expect(el).toBeTruthy();
  });

  it.each(cssSuffixes)('state=%s → span has base class al-chip', (state) => {
    const { container } = render(<AlertChip state={state} />);
    expect(container.querySelector('.al-chip')).toBeTruthy();
  });
});
