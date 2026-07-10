import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookMeta } from '../BookMeta';
import type { BookMetaProps } from '../BookMeta';

const ALL_LABELS = ['Видавництво', 'ISBN', 'Мова', 'Формат', 'Серія', 'Рік видання'] as const;

const ALL_NULL: BookMetaProps = {
  isbn: null,
  publisher: null,
  language: null,
  format: null,
  series: null,
  publicationYear: null,
};

describe('BookMeta', () => {
  it('renders all six rows with their values when every field is provided', () => {
    render(
      <BookMeta
        isbn="978-966-01-0001-1"
        publisher="Vivat"
        language="Українська"
        format="Тверда"
        series="Навіки Токіо"
        publicationYear={2023}
      />,
    );

    for (const label of ALL_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('978-966-01-0001-1')).toBeInTheDocument();
    expect(screen.getByText('Vivat')).toBeInTheDocument();
    expect(screen.getByText('Українська')).toBeInTheDocument();
    expect(screen.getByText('Тверда')).toBeInTheDocument();
    expect(screen.getByText('Навіки Токіо')).toBeInTheDocument();
    expect(screen.getByText('2023')).toBeInTheDocument();
    expect(screen.queryByText('Уточнюємо…')).not.toBeInTheDocument();
  });

  it('degrades per field: missing values show the placeholder, present ones render', () => {
    render(<BookMeta {...ALL_NULL} isbn="978-966-01-0001-1" />);

    for (const label of ALL_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('978-966-01-0001-1')).toBeInTheDocument();
    // Five fields have no data — placeholders, rows never omitted
    expect(screen.getAllByText('Уточнюємо…')).toHaveLength(5);
  });

  it('renders placeholder dds with bd-meta--missing class when everything is null', () => {
    render(<BookMeta {...ALL_NULL} />);

    const placeholders = screen.getAllByText('Уточнюємо…');
    expect(placeholders).toHaveLength(6);
    for (const dd of placeholders) {
      expect(dd.className).toContain('bd-meta--missing');
    }
  });
});
