import type { ReactNode } from 'react';
import type { ValuePropsGridFields } from '@packages/blocks-contract';
import { defineBlock } from '../../registry';
import type { BlockRenderProps } from '../../types';

interface Fields extends Record<string, unknown> {
  heading?: string;
  subheading?: string;
  items?: ValuePropsGridFields['items'];
}

function pad2(n: number): string {
  return String(n + 1).padStart(2, '0');
}

/**
 * Editorial value-props grid — oversized numerals replace the old
 * icon tile so the block reads as a display-type list. Each item
 * stands on a hairline top rule; the numeral is the visual hook.
 */
function ValuePropsGrid({ fields }: BlockRenderProps<Fields>): ReactNode {
  const { heading, subheading, items = [] } = fields;

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
        <div className="grid gap-x-10 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 border-t border-[hsl(var(--border))] pt-6"
            >
              <span
                aria-hidden
                className="text-5xl md:text-6xl font-semibold tracking-[-0.03em] leading-none text-[hsl(var(--foreground))]"
              >
                {pad2(i)}
              </span>
              <h3 className="text-xl md:text-2xl font-semibold tracking-[-0.01em] leading-tight">
                {item.title}
              </h3>
              <p className="text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const valuePropsGridBlock = defineBlock<Fields>({
  kind: 'value-props-grid',
  name: 'Value Props',
  category: 'Content',
  icon: 'Sparkles',
  supports: ['value-props'],
  fields: {
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
  },
  component: ValuePropsGrid,
});
