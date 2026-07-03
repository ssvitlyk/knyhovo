import Link from 'next/link';
import { catalogPath } from '@/lib/collectionsPaths';

export interface BreadcrumbProps {
  readonly title: string;
}

/** Frozen `.cd-crumbs` breadcrumb — Головна / Добірки / current collection title. */
export function Breadcrumb({ title }: BreadcrumbProps): React.JSX.Element {
  return (
    <nav className="cd-crumbs" aria-label="Хлібні крихти">
      <Link href="/">Головна</Link>
      <span className="cd-crumbs__sep">/</span>
      <Link href={catalogPath()}>Добірки</Link>
      <span className="cd-crumbs__sep">/</span>
      <span className="cd-crumbs__current">{title}</span>
    </nav>
  );
}
