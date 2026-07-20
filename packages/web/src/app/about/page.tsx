import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { me } from '@/lib/api/auth';
import { AboutHero } from '@/components/about/AboutHero';
import { HowItWorks } from '@/components/about/HowItWorks';
import { WhyKnyhovo } from '@/components/about/WhyKnyhovo';
import { Features } from '@/components/about/Features';
import { Faq } from '@/components/about/Faq';
import { EndCta } from '@/components/about/EndCta';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Про Knyhovo · Порівняння цін на книги',
  description:
    'Knyhovo стежить за цінами на книги у книгарнях України й підказує, де та коли купити найвигідніше.',
  alternates: { canonical: '/about', languages: { uk: '/about' } },
};

export default async function AboutPage(): Promise<React.JSX.Element> {
  // Auth-aware feature cards: resolve the session once (same pattern as
  // SiteHeader). Any failure (API down/timeout) degrades to guest, so the
  // static content still renders. This is the only reason the page reads
  // cookies — every route here is already server-rendered per request.
  let authenticated = false;
  try {
    const cookie = (await cookies()).toString();
    authenticated = (await me(cookie)) != null;
  } catch {
    authenticated = false;
  }

  return (
    <main className="ab-main ab-page">
      <AboutHero />
      <HowItWorks />
      <WhyKnyhovo />
      <Features authenticated={authenticated} />
      <Faq />
      <EndCta />
    </main>
  );
}
