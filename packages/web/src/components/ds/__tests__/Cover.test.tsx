import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Cover } from '../Cover';

describe('Cover', () => {
  it('renders an <img> with the given src when src is present', () => {
    const { container } = render(<Cover src="https://example.com/cover.jpg" className="kn-book__cover" />);
    const img = container.querySelector('img.kn-book__cover');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'https://example.com/cover.jpg');
    expect(img).toHaveClass('kn-book__cover');
  });

  it('renders the placeholder div when src is null', () => {
    const { container } = render(<Cover src={null} className="kn-book__cover" />);
    expect(container.querySelector('img')).toBeNull();
    const placeholder = container.querySelector('div.kn-book__cover');
    expect(placeholder).not.toBeNull();
    expect(placeholder).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the placeholder div when src is undefined', () => {
    const { container } = render(<Cover className="kn-book__cover" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('div.kn-book__cover')).not.toBeNull();
  });

  it('shows the placeholder after an error event on the img', () => {
    const { container } = render(<Cover src="https://example.com/broken.jpg" className="kn-book__cover" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();

    fireEvent.error(img!);

    expect(container.querySelector('img')).toBeNull();
    const placeholder = container.querySelector('div.kn-book__cover');
    expect(placeholder).not.toBeNull();
    expect(placeholder).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders placeholderLabel text when provided', () => {
    render(<Cover src={null} className="bd-cover bd-cover--md" placeholderLabel="Обкладинка" />);
    expect(screen.getByText('Обкладинка')).toBeInTheDocument();
  });

  it('renders a span placeholder when placeholderAs="span"', () => {
    const { container } = render(<Cover src={null} className="v1-cover" placeholderAs="span" />);
    expect(container.querySelector('span.v1-cover')).not.toBeNull();
  });
});
