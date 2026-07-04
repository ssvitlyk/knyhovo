import type { MetadataRoute } from 'next';
import { listCollections } from '@/lib/api/collections';
import { collectionPath } from '@/lib/collections/labels';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Sitemap: static routes + every active collection (taxonomic → /zhanry/:slug,
 * the rest → /dobirky/:slug per Collections PRD Part 09). Collection lookup
 * failures degrade to the static routes so a down API never breaks the build.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = ['/', '/search', '/dobirky'].map((path) => ({
    url: `${SITE_URL}${path}`,
  }));

  try {
    const { collections } = await listCollections();
    const collectionRoutes: MetadataRoute.Sitemap = collections
      .filter((c) => c.isActive)
      .map((c) => ({
        url: `${SITE_URL}${collectionPath(c)}`,
        lastModified: c.updatedAt,
      }));
    return [...staticRoutes, ...collectionRoutes];
  } catch {
    return staticRoutes;
  }
}
