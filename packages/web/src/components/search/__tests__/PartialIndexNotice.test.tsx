import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PartialIndexNotice } from '../PartialIndexNotice';

describe('PartialIndexNotice', () => {
  it('renders responded and total counts inline', () => {
    render(<PartialIndexNotice responded={2} total={5} />);
    expect(screen.getByText(/2 з 5/)).toBeInTheDocument();
  });

  it('renders the full expected copy', () => {
    render(<PartialIndexNotice responded={2} total={5} />);
    expect(
      screen.getByText(/Показано ціни з 2 з 5 книгарень\. Решта тимчасово недоступні\./),
    ).toBeInTheDocument();
  });

  it('uses role="status" for accessibility', () => {
    render(<PartialIndexNotice responded={1} total={3} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
