import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NotificationToggle } from '../NotificationToggle';

describe('NotificationToggle', () => {
  it('has role="switch" and aria-checked reflects "on" prop', () => {
    render(<NotificationToggle id="t1" label="Test toggle" on={true} />);
    const input = screen.getByRole('switch', { name: 'Test toggle' });
    expect(input).toHaveAttribute('aria-checked', 'true');
  });

  it('aria-checked is false when on=false', () => {
    render(<NotificationToggle id="t2" label="Off toggle" on={false} />);
    const input = screen.getByRole('switch', { name: 'Off toggle' });
    expect(input).toHaveAttribute('aria-checked', 'false');
  });

  it('disabled prevents onChange from being called', () => {
    const onChange = vi.fn();
    render(<NotificationToggle id="t3" label="Disabled" on={false} disabled onChange={onChange} />);
    const input = screen.getByRole('switch', { name: 'Disabled' });
    fireEvent.click(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('onChange is called when not disabled', () => {
    const onChange = vi.fn();
    render(<NotificationToggle id="t4" label="Enabled" on={false} onChange={onChange} />);
    const input = screen.getByRole('switch', { name: 'Enabled' });
    fireEvent.click(input);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
