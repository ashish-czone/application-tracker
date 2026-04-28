import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Reveal } from '@domains/agency-ui/portals/customer';
import { Section } from '@/components/layout/Section';
import { JsonLd } from '@/components/JsonLd';
import { fetchCaseStudyBySlug, type PublicCaseStudy } from '@/lib/api';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3100';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const study = await fetchCaseStudyBySlug(slug);
  if (!study) return { title: 'Not found' };
  return {
    title: study.title,
    description: study.summary,
    openGraph: {
      title: study.title,
      description: study.summary,
      images: study.heroImageUrl ? [study.heroImageUrl] : undefined,
      type: 'article',
      url: `/work/${study.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: study.title,
      description: study.summary,
      images: study.heroImageUrl ? [study.heroImageUrl] : undefined,
    },
    alternates: { canonical: `/work/${study.slug}` },
  };
}

export default async function CaseStudyDetailPage({ params }: RouteParams) {
  const { slug } = await params;
  const study = await fetchCaseStudyBySlug(slug);
  if (!study) notFound();

  return (
    <>
      <JsonLd data={buildCaseStudyJsonLd(study)} />

      <Section spacing="default" containerSize="default">
        <Reveal>
          <Link
            href="/work"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <span aria-hidden>←</span>
            All work
          </Link>
        </Reveal>
      </Section>

      <Section spacing="default" containerSize="default">
        <Reveal>
          <div className="flex flex-col gap-5 max-w-3xl">
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-[hsl(var(--muted-foreground))]">
              {study.client}
              {study.industry ? ` · ${study.industry}` : ''}
              {study.year ? ` · ${study.year}` : ''}
            </p>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-[-0.02em] leading-[1.05]">
              {study.title}
            </h1>
            <p className="text-lg md:text-xl text-[hsl(var(--muted-foreground))]">
              {study.summary}
            </p>
          </div>
        </Reveal>
      </Section>

      {study.heroImageUrl && (
        <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
          <Reveal>
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl bg-[hsl(var(--muted))]">
              <img
                src={study.heroImageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          </Reveal>
        </div>
      )}

      {study.body && (
        <Section spacing="roomy" containerSize="narrow">
          <Reveal>
            <div className="flex flex-col gap-6 text-lg leading-[1.7] text-[hsl(var(--foreground))]">
              {splitParagraphs(study.body).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </Reveal>
        </Section>
      )}

      {study.results && (
        <Section spacing="default" tone="muted" containerSize="default">
          <Reveal>
            <div className="flex flex-col gap-8 max-w-4xl">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em]">Results</h2>
              <ul className="grid gap-6 md:grid-cols-2">
                {splitResults(study.results).map((line, i) => (
                  <li
                    key={i}
                    className="rounded-2xl bg-[hsl(var(--background))] p-6 border border-[hsl(var(--border))]"
                  >
                    <p className="text-base text-[hsl(var(--foreground))]">{line}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </Section>
      )}

      <Section spacing="default" containerSize="default">
        <Reveal>
          <div className="rounded-3xl bg-[hsl(var(--surface-muted))] px-8 py-14 md:px-14 md:py-20 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] mb-3">
                {study.ctaText ?? 'Have a similar project in mind?'}
              </h2>
              <p className="text-[hsl(var(--muted-foreground))]">
                We take on a handful of new engagements each quarter. The good ones start with a call.
              </p>
            </div>
            <Link
              href={study.ctaHref ?? '/contact'}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:opacity-90 transition-opacity self-start md:self-auto"
            >
              Start a project
              <span aria-hidden>→</span>
            </Link>
          </div>
        </Reveal>
      </Section>
    </>
  );
}

function splitParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function splitResults(results: string): string[] {
  return results
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean);
}

function buildCaseStudyJsonLd(study: PublicCaseStudy) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: study.title,
    description: study.summary,
    url: `${SITE_URL}/work/${study.slug}`,
    ...(study.heroImageUrl ? { image: study.heroImageUrl } : {}),
    ...(study.publishedAt ? { datePublished: study.publishedAt } : {}),
    ...(study.industry ? { about: study.industry } : {}),
    creator: {
      '@type': 'Organization',
      name: study.client,
    },
  };
}
