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
  eyebrow?: string;
  /**
   * Either a newline-delimited string (hand-authored: "Client :: Title :: Href :: ImageUrl"
   * per row) or an already-mapped array (delivered by the case-study-grid
   * mapper when the section has a case-studies data source). Array form
   * wins since it represents structured live data.
   */
  entries?: string | ParsedEntry[];
  /** Retained for content compatibility; unused. */
  number?: string;
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

function CaseStudyTile({ entry }: { entry: ParsedEntry }) {
  const Wrapper: 'a' | 'article' = entry.href ? 'a' : 'article';
  const wrapperProps = entry.href
    ? {
        href: entry.href,
        className:
          'group flex flex-col overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300',
      }
    : {
        className:
          'flex flex-col overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]',
      };

  const meta: string[] = [];
  if (entry.industry) meta.push(entry.industry);
  if (entry.year) meta.push(String(entry.year));

  return (
    <Wrapper {...wrapperProps}>
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))]">
        {entry.imageUrl ? (
          <img
            src={entry.imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <div aria-hidden className="h-full w-full bg-[hsl(var(--muted))]" />
        )}
      </div>
      <div className="flex flex-col gap-3 p-6 md:p-7">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-mono text-[hsl(var(--accent))]">{entry.client}</span>
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
          {entry.title}
        </h3>
        {entry.href && (
          <span
            aria-hidden
            className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors"
          >
            Read case study
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </span>
        )}
      </div>
    </Wrapper>
  );
}

function CaseStudyGrid({ fields }: BlockRenderProps<CaseStudyGridFields>): ReactNode {
  const { heading, subheading, entries: raw, eyebrow } = fields;
  const entries = parseEntries(raw);

  return (
    <section className="w-full py-20 md:py-28 border-b border-[hsl(var(--border))]">
      <div className="mx-auto max-w-6xl px-6 md:px-10 flex flex-col gap-12">
        {(heading || subheading || eyebrow) && (
          <Reveal>
            <header className="flex flex-col gap-4 max-w-3xl">
              {eyebrow && <span className="text-eyebrow">[ {eyebrow} ]</span>}
              {heading && <h2 className="text-headline">{heading}</h2>}
              {subheading && <p className="text-lead max-w-2xl">{subheading}</p>}
            </header>
          </Reveal>
        )}
        <Stagger className="grid gap-6 md:gap-8 sm:grid-cols-2" step={0.06}>
          {entries.map((e, i) => (
            <CaseStudyTile key={i} entry={e} />
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
    eyebrow: { type: 'text', label: 'Eyebrow', maxLength: 60 },
    heading: { type: 'text', label: 'Heading', maxLength: 120 },
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
    entries: {
      type: 'textarea',
      label: 'Case studies (hand-authored fallback)',
      description:
        'Used when no data source is selected. One per line: "Client :: Title :: Href :: ImageUrl".',
    },
    number: { type: 'text', label: 'Section number (legacy)', maxLength: 4 },
  },
  component: CaseStudyGrid,
});
