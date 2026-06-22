import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Description } from '../Description';

const LONG_TEXT = 'Lorem ipsum '.repeat(50);

describe('Description', () => {
  it('renders the description text', () => {
    render(<Description text="Збірка поетичних творів." />);
    expect(screen.getByText('Збірка поетичних творів.')).toBeInTheDocument();
  });

  it('applies the clamped class initially (before expanding)', () => {
    const { container } = render(<Description text={LONG_TEXT} />);
    const p = container.querySelector('p.bd-desc__text');
    expect(p).not.toBeNull();
    // Initially unexpanded → clamped class should be present
    expect(p).toHaveClass('bd-desc__text--clamped');
  });

  it('wraps text in bd-desc container', () => {
    const { container } = render(<Description text="Test" />);
    expect(container.querySelector('.bd-desc')).not.toBeNull();
  });

  it('toggle button does not render in jsdom (no layout overflow detection)', () => {
    // jsdom cannot compute real layout (scrollHeight === clientHeight === 0),
    // so overflow detection always returns false and the toggle button is not rendered.
    // We verify the clamped class is applied and no toggle button exists.
    const { container } = render(<Description text={LONG_TEXT} />);

    // In jsdom: no overflow detected → no toggle button
    expect(screen.queryByRole('button', { name: /Показати все/ })).not.toBeInTheDocument();

    // The paragraph still has the clamped modifier class applied
    const p = container.querySelector('p');
    expect(p).toHaveClass('bd-desc__text--clamped');
  });
});
