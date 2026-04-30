import type { ReactNode } from 'react';
import { defineBlock } from './registry';
import type { BlockRenderProps } from './types';
import { Reveal } from '../motion/Reveal';
import { Stagger } from '../motion/Stagger';
import { ColoredEyebrow } from '../decoration/ColoredEyebrow';

interface FeatureListFields extends Record<string, unknown> {
  heading?: string;
  eyebrow?: string;
  items?: string;
  /** Retained for content compatibility; unused by the default variant. */
  number?: string;
}

const PRACTICE_TONES = [
  'hsl(var(--skin-practice-1))',
  'hsl(var(--skin-practice-2))',
  'hsl(var(--skin-practice-3))',
  'hsl(var(--skin-practice-4))',
  'hsl(var(--skin-practice-5))',
  'hsl(var(--skin-practice-6))',
] as const;

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
    <section
      className="relative w-full py-20 md:py-28 skin-surface"
      style={{
        background: 'hsl(var(--skin-page-bg))',
        borderTop: '1px solid hsl(var(--skin-card-border) / 0.6)',
      }}
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10 flex flex-col gap-12">
        {(fields.heading || fields.eyebrow) && (
          <Reveal>
            <header className="flex flex-col gap-4 max-w-3xl">
              {fields.eyebrow && <ColoredEyebrow>{fields.eyebrow}</ColoredEyebrow>}
              {fields.heading && (
                <h2
                  className="text-headline"
                  style={{ color: 'hsl(var(--skin-ink))' }}
                >
                  {fields.heading}
                </h2>
              )}
            </header>
          </Reveal>
        )}
        <Stagger
          className="grid gap-4 md:gap-5 sm:grid-cols-2 lg:grid-cols-3"
          step={0.04}
        >
          {items.map((item, i) => {
            const tone = PRACTICE_TONES[i % PRACTICE_TONES.length];
            return (
              <li
                key={i}
                className="group relative rounded-2xl p-6 md:p-7 flex flex-col gap-3 list-none transition-all hover:-translate-y-0.5"
                style={{
                  background: 'white',
                  border: '1px solid hsl(var(--skin-card-border))',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl text-white text-sm font-bold"
                    style={{ background: tone }}
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3
                    className="text-base font-semibold tracking-[-0.01em]"
                    style={{ color: 'hsl(var(--skin-ink))' }}
                  >
                    {item.title}
                  </h3>
                </div>
                {item.description && (
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'hsl(var(--skin-muted-ink))' }}
                  >
                    {item.description}
                  </p>
                )}
                <span
                  aria-hidden
                  className="absolute left-0 top-6 bottom-6 w-[3px] rounded-r-full opacity-60 group-hover:opacity-100 transition-opacity"
                  style={{ background: tone }}
                />
              </li>
            );
          })}
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
