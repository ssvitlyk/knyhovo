import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { renderBadge } from '../renderBadge';

describe('renderBadge', () => {
  it('null / undefined → nothing', () => {
    expect(renderBadge(null)).toBeNull();
    expect(renderBadge(undefined)).toBeNull();
  });

  it('green → «Найкраща ціна» (green tone)', () => {
    const { container } = render(<>{renderBadge('green')}</>);
    const badge = container.querySelector('.kn-badge');
    expect(badge?.textContent).toBe('Найкраща ціна');
    expect(badge?.classList.contains('kn-badge--green')).toBe(true);
  });

  it('solid:-16% → discount (solid tone)', () => {
    const { container } = render(<>{renderBadge('solid:-16%')}</>);
    const badge = container.querySelector('.kn-badge');
    expect(badge?.textContent).toBe('-16%');
    expect(badge?.classList.contains('kn-badge--solid')).toBe(true);
  });

  it('accent:Новинка → new (accent tone)', () => {
    const { container } = render(<>{renderBadge('accent:Новинка')}</>);
    const badge = container.querySelector('.kn-badge');
    expect(badge?.textContent).toBe('Новинка');
    expect(badge?.classList.contains('kn-badge--accent')).toBe(true);
  });
});
