import { notFound } from 'next/navigation';
import { PageRenderer } from '@domains/agency-ui/blocks';
import { fetchPageBySlug } from '../lib/api';

/**
 * Home — same as any other page, but served at `/` by loading the "home"
 * slug. Set the admin's home page's slug to "home" (or change this file
 * to point at the slug your site uses).
 */
export default async function HomePage() {
  const result = await fetchPageBySlug('home');
  if (!result) notFound();
  return <PageRenderer sections={result.sections} />;
}
