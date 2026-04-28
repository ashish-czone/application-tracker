import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Reveal } from '@domains/agency-ui/portals/customer';
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

  const meta: string[] = [study.client];
  if (study.industry) meta.push(study.industry);
  if (study.year) meta.push(String(study.year));

  return (
    <>
      <JsonLd data={buildCaseStudyJsonLd(study)} />

      <section className="w-full bg-hero-gradient border-b border-[hsl(var(--border))]">
        <div className="mx-auto max-w-4xl px-6 md:px-10 pt-12 md:pt-16 pb-16 md:pb-20 flex flex-col gap-8">
          <Reveal>
            <Link
              href="/work"
              className="inline-flex items-center gap-1.5 text-mono text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors w-fit"
            >
              <span aria-hidden>←</span>
              All work
            </Link>
          </Reveal>
          <Reveal delay={0.05}>
            <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1 text-mono w-fit">
              {meta.join(' · ')}
            </span>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="text-display max-w-3xl">{study.title}</h1>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="text-lead max-w-2xl">{study.summary}</p>
          </Reveal>
        </div>
      </section>

      {study.heroImageUrl && (
        <div className="border-b border-[hsl(var(--border))]">
          <div className="mx-auto w-full max-w-5xl px-6 md:px-10 py-10 md:py-14">
            <Reveal>
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] shadow-sm">
                <img src={study.heroImageUrl} alt="" className="h-full w-full object-cover" />
              </div>
            </Reveal>
          </div>
        </div>
      )}

      {study.body && (
        <section className="w-full py-20 md:py-28 border-b border-[hsl(var(--border))]">
          <Reveal>
            <div className="mx-auto max-w-2xl px-6 md:px-10 flex flex-col gap-6 text-lg leading-[1.75] text-[hsl(var(--foreground))]">
              {splitParagraphs(study.body).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      {study.results && (
        <section className="w-full bg-[hsl(var(--muted))] py-20 md:py-28 border-b border-[hsl(var(--border))]">
          <Reveal className="mx-auto max-w-5xl px-6 md:px-10 flex flex-col gap-10">
            <header className="flex flex-col gap-3 max-w-2xl">
              <span className="text-eyebrow">[ outcomes ]</span>
              <h2 className="text-headline">Results</h2>
            </header>
            <ul className="grid gap-px bg-[hsl(var(--border))] rounded-xl overflow-hidden border border-[hsl(var(--border))] sm:grid-cols-2">
              {splitResults(study.results).map((line, i) => (
                <li key={i} className="bg-[hsl(var(--background))] p-6 md:p-7 flex flex-col gap-2">
                  <span className="text-mono text-[hsl(var(--accent))]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-base text-[hsl(var(--foreground))] leading-relaxed">{line}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>
      )}

      <section className="w-full py-20 md:py-28">
        <Reveal className="mx-auto max-w-3xl px-6 md:px-10">
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-10 md:p-14 text-center flex flex-col gap-6 items-center shadow-sm">
            <h2 className="text-headline max-w-2xl">
              {study.ctaText ?? 'Have a similar project in mind?'}
            </h2>
            <p className="text-lead max-w-xl">
              We take on a handful of new engagements each quarter. The good ones start with a call.
            </p>
            <Link
              href={study.ctaHref ?? '/contact'}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground))]/90 transition-colors"
            >
              Start a project
              <span aria-hidden className="text-base leading-none">→</span>
            </Link>
          </div>
        </Reveal>
      </section>
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
