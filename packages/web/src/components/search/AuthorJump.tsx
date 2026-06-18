import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ds/Badge';

export interface AuthorJumpProps {
  readonly author: string;
}

/**
 * W7a Author Jump — renders a prominent card above results when the search
 * page detects an exact author-name match. The component itself is stateless:
 * the page decides whether to mount it; this component just renders.
 * Scoped to author search only — there is no dedicated author landing page
 * (that is planned for W7b).
 */
export function AuthorJump({ author }: AuthorJumpProps): React.JSX.Element {
  return (
    <Link
      className="si-jump"
      href={`/search?q=${encodeURIComponent(author)}`}
      aria-label={`Усі книги автора ${author}`}
    >
      <Badge tone="neutral">Автор</Badge>
      <span className="si-jump__name">{author}</span>
      <span className="si-jump__hint">Переглянути всі книги автора</span>
      <ChevronRight className="si-jump__chevron" aria-hidden />
    </Link>
  );
}
