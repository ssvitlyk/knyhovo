import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookMeta } from '../BookMeta';

describe('BookMeta', () => {
  it('renders the isbn value and the ISBN dt when isbn is provided', () => {
    render(<BookMeta isbn="978-966-01-0001-1" />);

    expect(screen.getByText('ISBN')).toBeInTheDocument();
    expect(screen.getByText('978-966-01-0001-1')).toBeInTheDocument();
  });

  it('renders a placeholder dd with bd-meta--missing class when isbn is null', () => {
    render(<BookMeta isbn={null} />);

    const placeholder = screen.getByText('Уточнюємо…');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder.className).toContain('bd-meta--missing');
  });
});
