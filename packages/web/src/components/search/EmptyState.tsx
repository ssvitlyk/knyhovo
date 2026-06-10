'use client';

import { useRouter } from 'next/navigation';
import { Chip } from '@/components/ds/Chip';
import { POPULAR_QUERIES } from './constants';

export interface EmptyStateProps {
  readonly title?: string;
  readonly text?: string;
}

/**
 * Frozen empty state — theme-swapped mascot illustration, headline, supporting
 * text, and popular-query chips that start a new search. Defaults to the frozen
 * "not found" copy; the page passes a softer prompt for the initial no-query view.
 */
export function EmptyState({
  title = 'Книгу не знайдено',
  text = 'Спробуйте іншу назву або ISBN.',
}: EmptyStateProps): React.JSX.Element {
  const router = useRouter();
  return (
    <div className="kn-empty">
      <img className="kn-empty__mascot kn-empty__mascot--light" src="/mascot/mascot-magnifier.png" alt="" />
      <img className="kn-empty__mascot kn-empty__mascot--dark" src="/mascot/mascot-lantern.png" alt="" />
      <h3 className="kn-empty__title">{title}</h3>
      <p className="kn-empty__text">{text}</p>
      <div className="kn-empty__chips">
        <span className="kn-empty__chips-label">Популярні запити:</span>
        {POPULAR_QUERIES.map((q) => (
          <Chip key={q} onClick={() => router.push(`/search?q=${encodeURIComponent(q)}`)}>
            {q}
          </Chip>
        ))}
      </div>
    </div>
  );
}
