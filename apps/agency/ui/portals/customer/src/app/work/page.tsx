import type { Metadata } from 'next';
import Link from 'next/link';
import { Reveal, Stagger, SectionLabel } from '@domains/agency-ui/portals/customer';
import { fetchCaseStudies, type PublicCaseStudy } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Selected work',
  description:
    'A curated sample of recent client work across web, mobile, AI, Shopify, and growth engagements.',
};

interface RouteParams {
  searchParams: Promise<{ industry?: string }>;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export default async function WorkIndexPage({ searchParams }: RouteParams) {
  const { industry: filter } = await searchParams;
  const studies = await fetchCaseStudies({ industry: filter });
  const industries = await collectIndustries();
  const totalLabel = pad(studies.length);

  return (
    <>
      <section className="w-full pt-16 md:pt-24 pb-12 md:pb-16">
        <div className="mx-auto max-w-7xl px-6 md:px-10 flex flex-col gap-10">
          <Reveal>
            <div className="flex items-baseline justify-between gap-6">
              <SectionLabel
                number="01"
                label="Selected work"
                meta={`${studies.length} case studies`}
              />
              <span className="hidden md:inline text-xs font-semibold tracking-[0.22em] uppercase text-[hsl(var(--muted-foreground))]">
                {filter ? `Filtered: ${filter}` : 'All industries'}
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="text-display max-w-[14ch]">Recent projects, shipped.</h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="text-lg md:text-xl text-[hsl(var(--muted-foreground))] leading-[1.55] max-w-xl">
              A curated sample. We ship under NDA as often as not — ask us about the work you
              can&rsquo;t see here.
            </p>
          </Reveal>
        </div>
      </section>

      {industries.length > 0 && (
        <div className="mx-auto w-full max-w-7xl px-6 md:px-10 pb-2">
          <Reveal>
            <div className="flex flex-wrap items-center gap-2 border-y border-[hsl(var(--hairline))] py-4">
              <span className="text-xs font-semibold tracking-[0.22em] uppercase text-[hsl(var(--muted-foreground))] mr-2">
                Filter —
              </span>
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

      <section className="w-full py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
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
            <Stagger className="grid gap-x-8 gap-y-20 md:grid-cols-2" step={0.08}>
              {studies.map((study, i) => (
                <CaseStudyCard key={study.id} study={study} index={i} totalLabel={totalLabel} />
              ))}
            </Stagger>
          )}
        </div>
      </section>

      <section className="w-full bg-[hsl(var(--surface-inverse))] text-[hsl(var(--surface-inverse-foreground))]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24 md:py-32 flex flex-col gap-10">
          <Reveal>
            <SectionLabel number="02" label="What's next" />
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="text-display max-w-[14ch]">Your next project starts here.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:opacity-90 transition-opacity"
              >
                Start a project
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium border border-[hsl(var(--surface-inverse-foreground))]/30 text-[hsl(var(--surface-inverse-foreground))] hover:bg-[hsl(var(--surface-inverse-foreground))]/10 transition-colors"
              >
                See services
              </Link>
            </div>
          </Reveal>
        </div>
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
          ? 'inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold tracking-[0.16em] uppercase bg-[hsl(var(--foreground))] text-[hsl(var(--background))]'
          : 'inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold tracking-[0.16em] uppercase text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors'
      }
    >
      {label}
    </Link>
  );
}

function CaseStudyCard({
  study,
  index,
  totalLabel,
}: {
  study: PublicCaseStudy;
  index: number;
  totalLabel: string;
}) {
  const meta: string[] = [];
  if (study.industry) meta.push(study.industry);
  if (study.year) meta.push(String(study.year));

  return (
    <Link href={`/work/${study.slug}`} className="group flex flex-col gap-6 cursor-pointer">
      <div className="relative aspect-[5/6] w-full overflow-hidden rounded-sm bg-[hsl(var(--muted))]">
        <span className="absolute top-5 left-5 z-10 text-xs font-semibold tracking-[0.18em] text-white mix-blend-difference">
          {pad(index + 1)} / {totalLabel}
        </span>
        {study.heroImageUrl ? (
          <img
            src={study.heroImageUrl}
            alt=""
            className="h-full w-full object-cover grayscale-[20%] transition-all duration-700 ease-out group-hover:grayscale-0 group-hover:scale-[1.03]"
          />
        ) : (
          <div aria-hidden className="h-full w-full bg-[hsl(var(--muted))]" />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold tracking-[0.22em] uppercase text-[hsl(var(--foreground))]">
            {study.client}
          </span>
          {meta.length > 0 && (
            <>
              <span className="h-px w-6 bg-[hsl(var(--hairline))]" aria-hidden />
              <span className="text-xs font-medium tracking-[0.18em] uppercase text-[hsl(var(--muted-foreground))]">
                {meta.join(' · ')}
              </span>
            </>
          )}
        </div>
        <h3 className="text-2xl md:text-4xl font-semibold tracking-[-0.02em] leading-[1.05] max-w-[16ch]">
          {study.title}
        </h3>
        <span
          aria-hidden
          className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]"
        >
          <span className="border-b border-[hsl(var(--hairline))] group-hover:border-[hsl(var(--foreground))] transition-colors pb-0.5">
            Read case study
          </span>
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
