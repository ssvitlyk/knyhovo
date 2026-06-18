import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CorrectionNotice } from '../CorrectionNotice';

describe('CorrectionNotice', () => {
  it('renders the corrected query text', () => {
    render(<CorrectionNotice original="гаррі потер" corrected="гаррі поттер" />);
    expect(screen.getByText(/гаррі поттер/)).toBeInTheDocument();
  });

  it('reversible action link points to /search with the original query and exact=1', () => {
    render(<CorrectionNotice original="гаррі потер" corrected="гаррі поттер" />);
    const link = screen.getByRole('link', { name: /гаррі потер/ });
    expect(link.getAttribute('href')).toBe(
      `/search?q=${encodeURIComponent('гаррі потер')}&exact=1`,
    );
  });

  it('encodes special characters in the original query', () => {
    render(<CorrectionNotice original="a b&c" corrected="abc" />);
    const link = screen.getByRole('link', { name: /a b&c/ });
    expect(link.getAttribute('href')).toBe(
      `/search?q=${encodeURIComponent('a b&c')}&exact=1`,
    );
  });
});
