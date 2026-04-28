import type { ReactNode } from 'react';
import { defineBlock } from './registry';
import type { BlockRenderProps } from './types';
import { Reveal } from '../motion/Reveal';
import { Stagger } from '../motion/Stagger';

interface ParsedEntry {
  client: string;
  title: string;
  href: string;
  imageUrl: string;
  industry?: string | null;
  year?: number | null;
}

interface CaseStudyGridFields extends Record<string, unknown> {
  heading?: string;
  subheading?: string;
  /** Two-digit chapter number for the section label. */
  number?: string;
  /** Eyebrow shown next to the section number. */
  eyebrow?: string;
  /**
   * Either a newline-delimited string (hand-authored: "Client :: Title :: Href :: ImageUrl"
   * per row) or an already-mapped array (delivered by the case-study-grid
   * mapper when the section has a case-studies data source). Array form
   * wins since it represents structured live data.
   */
  entries?: string | ParsedEntry[];
}

function parseEntries(raw: CaseStudyGridFields['entries']): ParsedEntry[] {
  if (Array.isArray(raw)) return raw.filter((e) => e.client && e.title);
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [client, title, href, imageUrl] = line.split('::').map((p) => p.trim());
      return {
        client: client ?? '',
        title: title ?? '',
        href: href ?? '',
        imageUrl: imageUrl ?? '',
      };
    })
    .filter((e) => e.client.length > 0 && e.title.length > 0);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function CaseStudyTile({
  entry,
  index,
  totalLabel,
}: {
  entry: ParsedEntry;
  index: number;
  totalLabel: string;
}) {
  const Wrapper: 'a' | 'article' = entry.href ? 'a' : 'article';
  const wrapperProps = entry.href
    ? { href: entry.href, className: 'group flex flex-col gap-6 cursor-pointer' }
    : { className: 'flex flex-col gap-6' };

  const meta: string[] = [];
  if (entry.industry) meta.push(entry.industry);
  if (entry.year) meta.push(String(entry.year));

  return (
    <Wrapper {...wrapperProps}>
      <div className="relative aspect-[5/6] w-full overflow-hidden rounded-sm bg-[hsl(var(--muted))]">
        <span className="absolute top-5 left-5 z-10 text-xs font-semibold tracking-[0.18em] text-white mix-blend-difference">
          {pad(index + 1)} / {totalLabel}
        </span>
        {entry.imageUrl ? (
          <img
            src={entry.imageUrl}
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
            {entry.client}
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
          {entry.title}
        </h3>
        {entry.href && (
          <span
            aria-hidden
            className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]"
          >
            <span className="border-b border-[hsl(var(--hairline))] group-hover:border-[hsl(var(--foreground))] transition-colors pb-0.5">
              Read case study
            </span>
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </span>
        )}
      </div>
    </Wrapper>
  );
}

function CaseStudyGrid({ fields }: BlockRenderProps<CaseStudyGridFields>): ReactNode {
  const { heading, subheading, entries: raw, number, eyebrow } = fields;
  const entries = parseEntries(raw);
  const totalLabel = pad(entries.length);

  return (
    <section className="w-full py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-10 flex flex-col gap-14 md:gap-20">
        {(heading || subheading || eyebrow) && (
          <Reveal>
            <header className="grid grid-cols-12 gap-6 items-end">
              <div className="col-span-12 md:col-span-7 flex flex-col gap-4">
                {eyebrow && (
                  <span className="text-xs font-semibold tracking-[0.22em] uppercase text-[hsl(var(--muted-foreground))]">
                    <span className="text-[hsl(var(--accent))]">{number ?? '03'}</span>
                    <span className="mx-3 inline-block h-px w-8 align-middle bg-[hsl(var(--hairline))]" />
                    {eyebrow}
                  </span>
                )}
                {heading && (
                  <h2 className="text-4xl md:text-6xl font-semibold tracking-[-0.025em] leading-[0.98]">
                    {heading}
                  </h2>
                )}
              </div>
              {subheading && (
                <p className="hidden md:block md:col-span-4 md:col-start-9 text-base text-[hsl(var(--muted-foreground))] leading-[1.55]">
                  {subheading}
                </p>
              )}
            </header>
          </Reveal>
        )}
        <Stagger className="grid gap-x-8 gap-y-20 md:grid-cols-2" step={0.08}>
          {entries.map((e, i) => (
            <CaseStudyTile key={i} entry={e} index={i} totalLabel={totalLabel} />
          ))}
        </Stagger>
      </div>
    </section>
  );
}

export const caseStudyGridBlock = defineBlock<CaseStudyGridFields>({
  kind: 'case-study-grid',
  name: 'Case Studies',
  category: 'Content',
  icon: 'FolderKanban',
  supports: ['case-studies'],
  fields: {
    number: { type: 'text', label: 'Section number', maxLength: 4 },
    eyebrow: { type: 'text', label: 'Eyebrow', maxLength: 60 },
    heading: { type: 'text', label: 'Heading', maxLength: 120 },
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
    entries: {
      type: 'textarea',
      label: 'Case studies (hand-authored fallback)',
      description:
        'Used when no data source is selected. One per line: "Client :: Title :: Href :: ImageUrl".',
    },
  },
  component: CaseStudyGrid,
});
