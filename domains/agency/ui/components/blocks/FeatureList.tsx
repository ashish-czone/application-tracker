import type { ReactNode } from 'react';
import { defineBlock } from './registry';
import type { BlockRenderProps } from './types';
import { Reveal } from '../motion/Reveal';
import { Stagger } from '../motion/Stagger';

interface FeatureListFields extends Record<string, unknown> {
  heading?: string;
  items?: string;
}

/**
 * Items are stored as newline-delimited "Title :: Description" rows in the
 * JSONB custom_fields column. A structured array field type would be nicer
 * but requires new storage semantics — deferred to a follow-up.
 */
function parseItems(raw: string | undefined): { title: string; description: string }[] {
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
    <section className="w-full py-16 px-6">
      <div className="mx-auto max-w-6xl flex flex-col gap-10">
        {fields.heading && (
          <Reveal>
            <h2 className="text-2xl md:text-3xl font-semibold text-center">{fields.heading}</h2>
          </Reveal>
        )}
        <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" step={0.05}>
          {items.map((item, i) => (
            <li
              key={i}
              className="rounded-lg border border-border p-6 flex flex-col gap-2 list-none"
            >
              <h3 className="font-semibold">{item.title}</h3>
              {item.description && (
                <p className="text-sm text-muted-foreground">{item.description}</p>
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
  fields: {
    heading: { type: 'text', label: 'Heading', maxLength: 120 },
    items: {
      type: 'textarea',
      label: 'Features',
      description: 'One per line. Use "Title :: Description" to separate.',
    },
  },
  component: FeatureList,
});
