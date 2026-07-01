import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsNav } from '../SettingsNav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings/notifications',
}));

describe('SettingsNav', () => {
  it('Сповіщення item has aria-current="page"', () => {
    render(<SettingsNav />);
    const link = screen.getByRole('link', { name: 'Сповіщення' });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('Профіль is a link to /settings/profile', () => {
    render(<SettingsNav />);
    const link = screen.getByRole('link', { name: 'Профіль' });
    expect(link).toHaveAttribute('href', '/settings/profile');
  });

  it('Безпека та вхід is aria-disabled (rendered as span)', () => {
    render(<SettingsNav />);
    const item = screen.getByText('Безпека та вхід');
    expect(item.tagName).toBe('SPAN');
    expect(item).toHaveAttribute('aria-disabled', 'true');
  });
});
