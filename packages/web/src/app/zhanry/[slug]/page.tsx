import type { Metadata } from 'next';
import {
  buildDetailsMetadata,
  CollectionDetailsPage,
  type DetailsSearchParams,
} from '@/components/collections/CollectionDetailsPage';

interface PageProps {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<DetailsSearchParams>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildDetailsMetadata(slug, 'zhanry');
}

/** `/zhanry/[slug]` — a genre (taxonomic collection) via the shared frozen Details template. */
export default async function Page({ params, searchParams }: PageProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  return CollectionDetailsPage({ slug, base: 'zhanry', searchParams: await searchParams });
}
