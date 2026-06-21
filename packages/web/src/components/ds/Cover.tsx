'use client';
import { useState } from 'react';

export interface CoverProps {
  readonly src?: string | null;
  readonly alt?: string;
  readonly className: string;
  readonly placeholderAs?: 'div' | 'span';
  readonly placeholderLabel?: string;
  readonly loading?: 'lazy' | 'eager';
}

export function Cover({
  src,
  alt = '',
  className,
  placeholderAs = 'div',
  placeholderLabel,
  loading = 'lazy',
}: CoverProps): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        className={className}
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }
  const Tag = placeholderAs;
  return (
    <Tag className={className} aria-hidden="true">
      {placeholderLabel ? <span>{placeholderLabel}</span> : null}
    </Tag>
  );
}
