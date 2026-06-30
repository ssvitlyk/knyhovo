import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnsubscribeConfirmation } from '@/components/settings/UnsubscribeConfirmation';

describe('UnsubscribeConfirmation', () => {
  it('renders the confirmation title', () => {
    render(<UnsubscribeConfirmation />);
    expect(
      screen.getByRole('heading', { name: 'Ви відписані від усіх сповіщень' }),
    ).toBeInTheDocument();
  });

  it('renders the return CTA linking home', () => {
    render(<UnsubscribeConfirmation />);
    const cta = screen.getByRole('link', { name: 'Повернутися на головну' });
    expect(cta).toHaveAttribute('href', '/');
  });
});
