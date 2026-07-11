import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { SortControls } from '../SortControls';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  push.mockClear();
  vi.stubGlobal('scrollTo', vi.fn());
});

/** Both the desktop chips and the mobile dropdown render in jsdom (CSS hides one); scope to the chips group. */
function chips(container: HTMLElement): HTMLElement {
  return container.querySelector('.results__sort-chips') as HTMLElement;
}

/** Scope to the mobile dropdown wrapper. */
function dropdown(container: HTMLElement): HTMLElement {
  return container.querySelector('.results__sort-dd') as HTMLElement;
}

describe('SortControls', () => {
  it('renders the three frozen chip options', () => {
    const { container } = render(<SortControls query="кобзар" sort="price_asc" />);
    const group = chips(container);
    expect(within(group).getByRole('button', { name: 'Найдешевші спочатку' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Найпопулярніші' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Новинки' })).toBeInTheDocument();
  });

  it('marks the active chip from the sort prop', () => {
    const { container } = render(<SortControls query="кобзар" sort="popular" />);
    const group = chips(container);
    const active = within(group).getByRole('button', { name: 'Найпопулярніші' });
    expect(active).toHaveAttribute('data-selected', 'true');
    expect(active).toHaveAttribute('aria-current', 'true');
    const inactive = within(group).getByRole('button', { name: 'Новинки' });
    expect(inactive).toHaveAttribute('data-selected', 'false');
    expect(inactive).not.toHaveAttribute('aria-current');
  });

  it('selecting a non-default chip navigates with sort and no page param', () => {
    const { container } = render(<SortControls query="кобзар" sort="price_asc" />);
    fireEvent.click(within(chips(container)).getByRole('button', { name: 'Новинки' }));
    expect(push).toHaveBeenCalledWith('/search?q=%D0%BA%D0%BE%D0%B1%D0%B7%D0%B0%D1%80&sort=newest');
    expect(push.mock.calls[0][0]).not.toContain('page=');
  });

  it('selecting the default option omits the sort param', () => {
    const { container } = render(<SortControls query="кобзар" sort="popular" />);
    fireEvent.click(within(chips(container)).getByRole('button', { name: 'Найдешевші спочатку' }));
    expect(push).toHaveBeenCalledWith('/search?q=%D0%BA%D0%BE%D0%B1%D0%B7%D0%B0%D1%80');
  });

  it('opens the mobile dropdown, lists options and selects one', () => {
    const { container } = render(<SortControls query="кобзар" sort="price_asc" />);
    const dd = dropdown(container);
    const trigger = within(dd).getByRole('button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const listbox = within(dd).getByRole('listbox');
    expect(within(listbox).getAllByRole('option')).toHaveLength(3);

    fireEvent.click(within(listbox).getByRole('option', { name: /Найпопулярніші/ }));
    expect(push).toHaveBeenCalledWith('/search?q=%D0%BA%D0%BE%D0%B1%D0%B7%D0%B0%D1%80&sort=popular');
    expect(within(dd).queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes the dropdown on Escape', () => {
    const { container } = render(<SortControls query="кобзар" sort="price_asc" />);
    const dd = dropdown(container);
    fireEvent.click(within(dd).getByRole('button'));
    expect(within(dd).getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(within(dd).queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes the dropdown on outside click', () => {
    const { container } = render(
      <div>
        <div data-testid="outside" />
        <SortControls query="кобзар" sort="price_asc" />
      </div>,
    );
    const dd = dropdown(container);
    fireEvent.click(within(dd).getByRole('button'));
    expect(within(dd).getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(within(dd).queryByRole('listbox')).not.toBeInTheDocument();
  });
});
