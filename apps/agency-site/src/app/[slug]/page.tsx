import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageRenderer } from '@packages/pages-ui-frontend';
import { fetchPageBySlug } from '../../lib/api';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchPageBySlug(slug);
  if (!result) return { title: 'Not found' };
  const { page } = result;
  return {
    title: page.title,
    description: page.metaDescription ?? undefined,
    openGraph: {
      title: page.title,
      description: page.metaDescription ?? undefined,
      images: page.ogImage ? [page.ogImage] : undefined,
      type: 'website',
      url: `/${page.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.metaDescription ?? undefined,
      images: page.ogImage ? [page.ogImage] : undefined,
    },
    alternates: { canonical: `/${page.slug}` },
  };
}

export default async function SlugPage({ params }: RouteParams) {
  const { slug } = await params;
  const result = await fetchPageBySlug(slug);
  if (!result) notFound();
  return <PageRenderer sections={result.sections} />;
}
