import type { Metadata } from 'next';
import Link from 'next/link';
import { Reveal, Stagger } from '@domains/agency-ui/portals/customer';
import { fetchCaseStudies, type PublicCaseStudy } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Selected work',
  description:
    'A curated sample of recent client work across web, mobile, AI, Shopify, and growth engagements.',
};

interface RouteParams {
  searchParams: Promise<{ industry?: string }>;
}

export default async function WorkIndexPage({ searchParams }: RouteParams) {
  const { industry: filter } = await searchParams;
  const studies = await fetchCaseStudies({ industry: filter });
  const industries = await collectIndustries();

  return (
    <>
      <section className="w-full bg-hero-gradient border-b border-[hsl(var(--border))]">
        <div className="mx-auto max-w-5xl px-6 md:px-10 pt-20 md:pt-28 pb-14 md:pb-20 flex flex-col items-center text-center gap-6">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1 text-mono">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]"
              />
              Selected work · {studies.length} case studies
            </span>
          </Reveal>
          <Reveal delay={0.06}>
            <h1 className="text-display max-w-3xl">Recent projects, shipped.</h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="text-lead max-w-2xl">
              A curated sample. We ship under NDA as often as not — ask us about the work you
              can&rsquo;t see here.
            </p>
          </Reveal>
        </div>
      </section>

      {industries.length > 0 && (
        <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]">
          <div className="mx-auto w-full max-w-6xl px-6 md:px-10 py-4 flex flex-wrap items-center gap-2">
            <span className="text-eyebrow mr-2">[ filter ]</span>
            <FilterChip href="/work" active={!filter} label="All" />
            {industries.map((value) => (
              <FilterChip
                key={value}
                href={`/work?industry=${encodeURIComponent(value)}`}
                active={filter === value}
                label={value}
              />
            ))}
          </div>
        </div>
      )}

      <section className="w-full py-16 md:py-24 border-b border-[hsl(var(--border))]">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          {studies.length === 0 ? (
            <Reveal>
              <div className="py-16 text-center">
                <p className="text-[hsl(var(--muted-foreground))] mb-6">
                  No case studies match this filter yet.
                </p>
                <Link
                  href="/work"
                  className="text-sm font-medium underline underline-offset-4 hover:no-underline"
                >
                  Clear filter
                </Link>
              </div>
            </Reveal>
          ) : (
            <Stagger className="grid gap-6 md:gap-8 sm:grid-cols-2" step={0.06}>
              {studies.map((study) => (
                <CaseStudyCard key={study.id} study={study} />
              ))}
            </Stagger>
          )}
        </div>
      </section>

      <section className="w-full bg-[hsl(var(--muted))] py-20 md:py-28">
        <Reveal className="mx-auto max-w-3xl px-6 md:px-10">
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-10 md:p-14 text-center flex flex-col gap-6 items-center shadow-sm">
            <h2 className="text-headline max-w-2xl">Your next project starts here.</h2>
            <p className="text-lead max-w-xl">
              We take on a handful of new engagements each quarter. The good ones start with a
              30-minute call.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground))]/90 transition-colors"
              >
                Start a project
                <span aria-hidden className="text-base leading-none">→</span>
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
              >
                See services
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'inline-flex items-center rounded-full px-3 py-1 text-mono bg-[hsl(var(--foreground))] text-[hsl(var(--background))]'
          : 'inline-flex items-center rounded-full px-3 py-1 text-mono border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:border-[hsl(var(--foreground))] transition-colors'
      }
    >
      {label}
    </Link>
  );
}

function CaseStudyCard({ study }: { study: PublicCaseStudy }) {
  const meta: string[] = [];
  if (study.industry) meta.push(study.industry);
  if (study.year) meta.push(String(study.year));

  return (
    <Link
      href={`/work/${study.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))]">
        {study.heroImageUrl ? (
          <img
            src={study.heroImageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <div aria-hidden className="h-full w-full bg-[hsl(var(--muted))]" />
        )}
      </div>
      <div className="flex flex-col gap-3 p-6 md:p-7">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-mono text-[hsl(var(--accent))]">{study.client}</span>
          {meta.length > 0 && (
            <>
              <span aria-hidden className="text-mono text-[hsl(var(--border))]">·</span>
              <span className="text-mono text-[hsl(var(--muted-foreground))]">
                {meta.join(' · ')}
              </span>
            </>
          )}
        </div>
        <h3 className="text-xl md:text-2xl font-semibold tracking-[-0.02em] leading-snug">
          {study.title}
        </h3>
        <span
          aria-hidden
          className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--foreground))]"
        >
          Read case study
          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </span>
      </div>
    </Link>
  );
}

async function collectIndustries(): Promise<string[]> {
  const all = await fetchCaseStudies();
  const seen = new Set<string>();
  for (const c of all) {
    if (c.industry) seen.add(c.industry);
  }
  return Array.from(seen).sort();
}
