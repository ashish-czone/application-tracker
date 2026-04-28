import type { Metadata } from 'next';
import Link from 'next/link';
import { Reveal, Stagger } from '@domains/agency-ui/portals/customer';
import { Section } from '@/components/layout/Section';
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
      <Section spacing="roomy" containerSize="default" className="text-center">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-[hsl(var(--muted-foreground))] mb-6">
            Selected work
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-[-0.02em] leading-[1.05] mb-6">
            Recent projects, shipped.
          </h1>
          <p className="text-lg md:text-xl text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
            A curated sample. We ship under NDA as often as not — ask us about the work you can&rsquo;t
            see here.
          </p>
        </Reveal>
      </Section>

      {industries.length > 0 && (
        <div className="mx-auto w-full max-w-6xl px-6 md:px-10">
          <Reveal>
            <div className="flex flex-wrap items-center gap-2 pb-2">
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
          </Reveal>
        </div>
      )}

      <Section spacing="default" containerSize="default">
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
          <Stagger className="grid gap-x-6 gap-y-14 md:grid-cols-2" step={0.08}>
            {studies.map((study) => (
              <CaseStudyCard key={study.id} study={study} />
            ))}
          </Stagger>
        )}
      </Section>

      <Section spacing="default" containerSize="default">
        <Reveal>
          <div className="rounded-3xl bg-[hsl(var(--surface-muted))] px-8 py-14 md:px-14 md:py-20 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] mb-3">
                Your next project?
              </h2>
              <p className="text-[hsl(var(--muted-foreground))]">
                We take a handful of new engagements each quarter. The good ones start with a call.
              </p>
            </div>
            <Link
              href="/contact"
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

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium bg-[hsl(var(--foreground))] text-[hsl(var(--background))]'
          : 'inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-muted))] transition-colors'
      }
    >
      {label}
    </Link>
  );
}

function CaseStudyCard({ study }: { study: PublicCaseStudy }) {
  return (
    <Link href={`/work/${study.slug}`} className="group flex flex-col gap-5">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-[hsl(var(--muted))]">
        {study.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={study.heroImageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <div aria-hidden className="h-full w-full bg-[hsl(var(--muted))]" />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium tracking-[0.2em] uppercase text-[hsl(var(--muted-foreground))]">
          {study.client}
          {study.industry ? ` · ${study.industry}` : ''}
        </span>
        <h3 className="text-2xl md:text-3xl font-semibold tracking-[-0.01em] leading-tight">
          {study.title}
        </h3>
        <span
          aria-hidden
          className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--foreground))]"
        >
          <span className="underline underline-offset-4 decoration-transparent group-hover:decoration-[hsl(var(--foreground))]">
            Read case study
          </span>
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </Link>
  );
}

async function collectIndustries(): Promise<string[]> {
  // Pulls the full list (small N for now) so industry chips reflect what's
  // actually published. Cheap because the public list endpoint is cached.
  const all = await fetchCaseStudies();
  const seen = new Set<string>();
  for (const c of all) {
    if (c.industry) seen.add(c.industry);
  }
  return Array.from(seen).sort();
}
