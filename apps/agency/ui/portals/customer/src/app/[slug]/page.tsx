import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageRenderer } from '@domains/agency-ui/blocks';
import { fetchPageBySlug } from '../../lib/api';
import { JsonLd } from '@/components/JsonLd';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3100';

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

  const { page, sections } = result;
  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    url: `${SITE_URL}/${page.slug}`,
    ...(page.metaDescription ? { description: page.metaDescription } : {}),
    ...(page.ogImage ? { primaryImageOfPage: { '@type': 'ImageObject', url: page.ogImage } } : {}),
  };

  return (
    <>
      <JsonLd data={webPage} />
      <PageRenderer sections={sections} />
    </>
  );
}
