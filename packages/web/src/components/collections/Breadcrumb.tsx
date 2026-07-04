import Link from 'next/link';
/** Frozen breadcrumb for the Collection Details template: Головна / Добірки / {name}. */
export function Breadcrumb({ title }: { readonly title: string }): React.JSX.Element {
  return (
    <nav className="cd-crumbs" aria-label="Хлібні крихти">
      <Link href="/">Головна</Link>
      <span className="cd-crumbs__sep">/</span>
      <Link href="/dobirky">Добірки</Link>
      <span className="cd-crumbs__sep">/</span>
      <span className="cd-crumbs__current">{title}</span>
    </nav>
  );
}
