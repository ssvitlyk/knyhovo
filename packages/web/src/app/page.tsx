import { redirect } from 'next/navigation';

/** The app currently has a single feature surface — send the root to search. */
export default function HomePage(): never {
  redirect('/search');
}
