import type { ReactNode } from 'react';
import { defineBlock } from './registry';
import type { BlockRenderProps } from './types';
import { Reveal } from '../motion/Reveal';
import { Stagger } from '../motion/Stagger';

interface FeatureListFields extends Record<string, unknown> {
  heading?: string;
  eyebrow?: string;
  items?: string;
  /** Retained for content compatibility; unused by the default variant. */
  number?: string;
}

interface ParsedItem {
  title: string;
  description: string;
}

/**
 * Items are stored as newline-delimited "Title :: Description" rows in the
 * JSONB custom_fields column.
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

function FeatureList({ fields }: BlockRenderProps<FeatureListFields>): ReactNode {
  const items = parseItems(fields.items);

  return (
    <section className="w-full py-20 md:py-28 border-b border-[hsl(var(--border))]">
      <div className="mx-auto max-w-6xl px-6 md:px-10 flex flex-col gap-12">
        {(fields.heading || fields.eyebrow) && (
          <Reveal>
            <header className="flex flex-col gap-4 max-w-3xl">
              {fields.eyebrow && (
                <span className="text-eyebrow">[ {fields.eyebrow} ]</span>
              )}
              {fields.heading && <h2 className="text-headline">{fields.heading}</h2>}
            </header>
          </Reveal>
        )}
        <Stagger
          className="grid gap-4 md:gap-5 sm:grid-cols-2 lg:grid-cols-3"
          step={0.04}
        >
          {items.map((item, i) => (
            <li
              key={i}
              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-6 md:p-8 flex flex-col gap-3 list-none transition-colors hover:border-[hsl(var(--foreground))]/30"
            >
              <span
                className="text-xs font-medium tracking-[0.02em] text-[hsl(var(--accent))]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="text-base font-semibold tracking-[-0.01em]">{item.title}</h3>
              {item.description && (
                <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                  {item.description}
                </p>
              )}
            </li>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

export const featureListBlock = defineBlock<FeatureListFields>({
  kind: 'feature-list',
  name: 'Feature List',
  category: 'Content',
  icon: 'List',
  variants: [{ key: 'default', label: 'Default' }],
  defaultVariant: 'default',
  fields: {
    eyebrow: { type: 'text', label: 'Eyebrow', maxLength: 60 },
    heading: { type: 'text', label: 'Heading', maxLength: 120 },
    items: {
      type: 'textarea',
      label: 'Features',
      description: 'One per line. Use "Title :: Description" to separate.',
    },
    number: { type: 'text', label: 'Section number (legacy)', maxLength: 4 },
  },
  component: FeatureList,
});
