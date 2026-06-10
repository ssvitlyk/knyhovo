import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly selected?: boolean;
  readonly iconLeft?: ReactNode;
}

/**
 * Knyhovo DS Chip — emits the frozen `.kn-chip` classes with `data-selected`.
 * Mirrors the reference `components/forms/Chip.jsx`.
 */
export function Chip({
  selected = false,
  iconLeft = null,
  className = '',
  children,
  ...rest
}: ChipProps): React.JSX.Element {
  const classes = ['kn-chip', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={classes} data-selected={selected ? 'true' : 'false'} {...rest}>
      {iconLeft}
      {children}
    </button>
  );
}
