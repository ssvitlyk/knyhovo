import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookMeta } from '../BookMeta';

const ALL_LABELS = ['Видавництво', 'ISBN', 'Мова', 'Формат', 'Серія', 'Рік видання'] as const;

describe('BookMeta', () => {
  it('always renders all six metadata rows with the isbn value when provided', () => {
    render(<BookMeta isbn="978-966-01-0001-1" />);

    for (const label of ALL_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('978-966-01-0001-1')).toBeInTheDocument();
    // Five fields have no data in the DTO yet — placeholders, never omitted
    expect(screen.getAllByText('Уточнюємо…')).toHaveLength(5);
  });

  it('renders placeholder dds with bd-meta--missing class when isbn is null', () => {
    render(<BookMeta isbn={null} />);

    const placeholders = screen.getAllByText('Уточнюємо…');
    expect(placeholders).toHaveLength(6);
    for (const dd of placeholders) {
      expect(dd.className).toContain('bd-meta--missing');
    }
  });
});
