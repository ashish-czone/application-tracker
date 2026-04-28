import type { ReactNode } from 'react';
import { defineBlock } from './registry';
import type { BlockRenderProps } from './types';
import { Reveal } from '../motion/Reveal';
import { Stagger } from '../motion/Stagger';

interface FeatureListFields extends Record<string, unknown> {
  heading?: string;
  /** Optional eyebrow shown above the heading. */
  eyebrow?: string;
  /** Two-digit chapter number for the editorial variant. */
  number?: string;
  items?: string;
}

interface ParsedItem {
  title: string;
  description: string;
}

/**
 * Items are stored as newline-delimited "Title :: Description" rows in the
 * JSONB custom_fields column. A structured array field type would be nicer
 * but requires new storage semantics — deferred to a follow-up.
 */
function parseItems(raw: string | undefined): ParsedItem[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, ...rest] = line.split('::').map((p) => p.trim());
      return { title: title ?? '', description: rest.join(' :: ') };
    });
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function EditorialRows({ items }: { items: ParsedItem[] }) {
  return (
    <Stagger className="flex flex-col" step={0.05}>
      {items.map((item, i) => (
        <article
          key={i}
          className="grid grid-cols-12 gap-6 md:gap-8 py-8 md:py-12 border-t border-[hsl(var(--hairline))] group"
        >
          <div className="col-span-2 md:col-span-1">
            <span className="text-xs md:text-sm font-semibold tracking-[0.18em] text-[hsl(var(--accent))]">
              {pad(i + 1)}
            </span>
          </div>
          <h3 className="col-span-10 md:col-span-5 text-2xl md:text-4xl font-semibold tracking-[-0.02em] leading-[1.05]">
            {item.title}
          </h3>
          {item.description && (
            <p className="col-span-12 md:col-span-6 text-base md:text-lg text-[hsl(var(--muted-foreground))] leading-[1.55] md:pt-2">
              {item.description}
            </p>
          )}
        </article>
      ))}
      <div className="border-t border-[hsl(var(--hairline))]" aria-hidden />
    </Stagger>
  );
}

function CardsGrid({ items }: { items: ParsedItem[] }) {
  return (
    <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" step={0.05}>
      {items.map((item, i) => (
        <li
          key={i}
          className="rounded-lg border border-[hsl(var(--border))] p-6 flex flex-col gap-2 list-none"
        >
          <h3 className="font-semibold">{item.title}</h3>
          {item.description && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{item.description}</p>
          )}
        </li>
      ))}
    </Stagger>
  );
}

function FeatureList({ fields, variant }: BlockRenderProps<FeatureListFields>): ReactNode {
  const items = parseItems(fields.items);
  const isCards = variant === 'cards';

  return (
    <section className="w-full py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-10 flex flex-col gap-12 md:gap-16">
        {(fields.heading || fields.eyebrow) && (
          <Reveal>
            <header className="grid grid-cols-12 gap-6 items-end">
              <div className="col-span-12 md:col-span-7 flex flex-col gap-4">
                {fields.eyebrow && (
                  <span className="text-xs font-semibold tracking-[0.22em] uppercase text-[hsl(var(--muted-foreground))]">
                    <span className="text-[hsl(var(--accent))]">{fields.number ?? '02'}</span>
                    <span className="mx-3 inline-block h-px w-8 align-middle bg-[hsl(var(--hairline))]" />
                    {fields.eyebrow}
                  </span>
                )}
                {fields.heading && (
                  <h2 className="text-4xl md:text-6xl font-semibold tracking-[-0.025em] leading-[0.98]">
                    {fields.heading}
                  </h2>
                )}
              </div>
              <p className="hidden md:block md:col-span-4 md:col-start-9 text-sm text-[hsl(var(--muted-foreground))]">
                {items.length} practices · scoped to outcomes, not titles
              </p>
            </header>
          </Reveal>
        )}
        {isCards ? <CardsGrid items={items} /> : <EditorialRows items={items} />}
      </div>
    </section>
  );
}

export const featureListBlock = defineBlock<FeatureListFields>({
  kind: 'feature-list',
  name: 'Feature List',
  category: 'Content',
  icon: 'List',
  variants: [
    { key: 'editorial', label: 'Editorial rows (default)' },
    { key: 'cards', label: 'Card grid' },
  ],
  defaultVariant: 'editorial',
  fields: {
    number: {
      type: 'text',
      label: 'Section number',
      maxLength: 4,
      description: 'Two-digit chapter number for the editorial variant.',
    },
    eyebrow: { type: 'text', label: 'Eyebrow', maxLength: 60 },
    heading: { type: 'text', label: 'Heading', maxLength: 120 },
    items: {
      type: 'textarea',
      label: 'Features',
      description: 'One per line. Use "Title :: Description" to separate.',
    },
  },
  component: FeatureList,
});
