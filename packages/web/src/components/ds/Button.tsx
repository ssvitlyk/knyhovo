import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly iconLeft?: ReactNode;
  readonly iconRight?: ReactNode;
}

/**
 * Knyhovo DS Button — emits the frozen `.kn-btn` classes.
 * Mirrors the reference `components/buttons/Button.jsx`.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  iconLeft = null,
  iconRight = null,
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps): React.JSX.Element {
  const classes = ['kn-btn', `kn-btn--${variant}`, size !== 'md' ? `kn-btn--${size}` : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} {...rest}>
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
