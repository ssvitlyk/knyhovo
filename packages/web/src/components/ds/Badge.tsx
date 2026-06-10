import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeTone = 'accent' | 'green' | 'blue' | 'neutral' | 'solid';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: BadgeTone;
  readonly children: ReactNode;
}

/**
 * Knyhovo DS Badge — emits the frozen `.kn-badge` classes.
 * Mirrors the reference `components/display/Badge.jsx`.
 */
export function Badge({ tone = 'accent', className = '', children, ...rest }: BadgeProps): React.JSX.Element {
  const classes = ['kn-badge', `kn-badge--${tone}`, className].filter(Boolean).join(' ');
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
