import type { ReactNode } from 'react';
import { defineBlock } from './registry';
import type { BlockRenderProps } from './types';

interface CaseStudyGridFields extends Record<string, unknown> {
  heading?: string;
  subheading?: string;
  entries?: string;
}

interface ParsedEntry {
  client: string;
  title: string;
  href: string;
  imageUrl: string;
}

/**
 * Entries are stored as newline-delimited
 * "Client :: Title :: Href :: ImageUrl" rows. Rows with < 2 parts are
 * skipped; missing Href just removes the link, missing ImageUrl falls
 * back to a muted placeholder tile.
 */
function parseEntries(raw: string | undefined): ParsedEntry[] {
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

function CaseStudyGrid({ fields }: BlockRenderProps<CaseStudyGridFields>): ReactNode {
  const { heading, subheading, entries: raw } = fields;
  const entries = parseEntries(raw);

  return (
    <section className="w-full py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6 md:px-10 flex flex-col gap-14">
        {(heading || subheading) && (
          <div className="flex flex-col gap-3 max-w-2xl">
            {heading && (
              <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.02em] leading-[1.05]">
                {heading}
              </h2>
            )}
            {subheading && (
              <p className="text-lg text-[hsl(var(--muted-foreground))]">{subheading}</p>
            )}
          </div>
        )}
        <div className="grid gap-x-6 gap-y-14 md:grid-cols-2">
          {entries.map((e, i) => {
            const Wrapper: 'a' | 'article' = e.href ? 'a' : 'article';
            const wrapperProps = e.href
              ? { href: e.href, className: 'group flex flex-col gap-5' }
              : { className: 'flex flex-col gap-5' };
            return (
              <Wrapper key={i} {...wrapperProps}>
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-[hsl(var(--muted))]">
                  {e.imageUrl ? (
                    <img
                      src={e.imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div aria-hidden className="h-full w-full bg-[hsl(var(--muted))]" />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium tracking-[0.2em] uppercase text-[hsl(var(--muted-foreground))]">
                    {e.client}
                  </span>
                  <h3 className="text-2xl md:text-3xl font-semibold tracking-[-0.01em] leading-tight">
                    {e.title}
                  </h3>
                  {e.href && (
                    <span
                      aria-hidden
                      className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--foreground))]"
                    >
                      <span className="underline underline-offset-4 decoration-transparent group-hover:decoration-[hsl(var(--foreground))]">
                        Read case study
                      </span>
                      <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                        →
                      </span>
                    </span>
                  )}
                </div>
              </Wrapper>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export const caseStudyGridBlock = defineBlock<CaseStudyGridFields>({
  kind: 'case-study-grid',
  name: 'Case Studies',
  category: 'Content',
  icon: 'FolderKanban',
  fields: {
    heading: { type: 'text', label: 'Heading', maxLength: 120 },
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
    entries: {
      type: 'textarea',
      label: 'Case studies',
      description:
        'One per line. Use "Client :: Title :: Href :: ImageUrl" (Href and ImageUrl optional).',
    },
  },
  component: CaseStudyGrid,
});
