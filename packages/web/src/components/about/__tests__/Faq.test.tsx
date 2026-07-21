import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { Faq } from '../Faq';

const QUESTIONS = [
  'Як часто оновлюються ціни?',
  'Чи продає Knyhovo книги?',
  'Як працюють бажанки?',
  'Як працюють сповіщення?',
  'Чому ціна відрізняється від тієї, що я бачу в книгарні?',
  'Чи можна відстежувати книгу без реєстрації?',
  'Чому деяких книг ще немає?',
  'Чому деякі книги без опису або історії цін?',
];

describe('Faq', () => {
  it('renders all 8 questions', () => {
    render(<Faq />);
    for (const q of QUESTIONS) {
      expect(screen.getByRole('button', { name: new RegExp(escapeRegExp(q)) })).toBeTruthy();
    }
  });

  it('first item is open by default, others closed', () => {
    render(<Faq />);
    const buttons = QUESTIONS.map((q) => screen.getByRole('button', { name: new RegExp(escapeRegExp(q)) }));
    expect(buttons[0]?.getAttribute('aria-expanded')).toBe('true');
    for (const btn of buttons.slice(1)) {
      expect(btn.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('clicking a closed item opens it and collapses item 0 (single-open)', () => {
    render(<Faq />);
    const item0 = screen.getByRole('button', { name: new RegExp(escapeRegExp(QUESTIONS[0]!)) });
    const item2 = screen.getByRole('button', { name: new RegExp(escapeRegExp(QUESTIONS[2]!)) });
    fireEvent.click(item2);
    expect(item2.getAttribute('aria-expanded')).toBe('true');
    expect(item0.getAttribute('aria-expanded')).toBe('false');
  });

  it('clicking the currently-open item collapses all', () => {
    render(<Faq />);
    const item0 = screen.getByRole('button', { name: new RegExp(escapeRegExp(QUESTIONS[0]!)) });
    expect(item0.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(item0);
    expect(item0.getAttribute('aria-expanded')).toBe('false');
  });
});

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
