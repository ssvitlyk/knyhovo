import { Badge } from '@/components/ds/Badge';
import type { HomeBadge } from './content';

/**
 * Maps a curated {@link HomeBadge} spec to the frozen DS `<Badge>`.
 * Frozen BookCard hierarchy (max one per card): green «Найкраща ціна» →
 * `solid:-N%` discount → `accent:Новинка`. Mirrors `homepage.jsx` `renderBadge`.
 */
export function renderBadge(spec: HomeBadge | null | undefined): React.JSX.Element | null {
  if (!spec) return null;
  if (spec === 'green') return <Badge tone="green">Найкраща ціна</Badge>;
  if (spec.startsWith('solid:')) return <Badge tone="solid">{spec.slice('solid:'.length)}</Badge>;
  if (spec.startsWith('accent:')) return <Badge tone="accent">{spec.slice('accent:'.length)}</Badge>;
  return null;
}
