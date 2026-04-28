import type { ReactNode } from 'react';
import { defineBlock } from '../registry';
import type { BlockRenderProps } from '../types';
import { Reveal } from '../../motion/Reveal';

interface AwardsStripFields extends Record<string, unknown> {
  /** Newline-delimited recognitions, e.g. "Awwwards · Site of the Day" per line. */
  items?: string;
  /** Optional small mono label rendered above the row. */
  eyebrow?: string;
}

function parseItems(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Quiet recognition row — eyebrow + a wrapping list of award names in
 * monospace, muted by default. Replaces the editorial Marquee. Reads as
 * a logo-cloud equivalent for a studio that wants to surface awards
 * without the noise of an animated band.
 */
function AwardsStrip({ fields }: BlockRenderProps<AwardsStripFields>): ReactNode {
  const items = parseItems(fields.items);
  if (items.length === 0) return null;
  const eyebrow = fields.eyebrow ?? 'Recognitions';

  return (
    <section className="w-full py-14 md:py-16 border-b border-[hsl(var(--border))]">
      <Reveal className="mx-auto max-w-6xl px-6 md:px-10 flex flex-col gap-6">
        <span className="text-eyebrow">[ {eyebrow} ]</span>
        <ul className="flex flex-wrap items-center gap-x-8 gap-y-3 text-mono text-[hsl(var(--muted-foreground))]">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-center gap-3 text-sm hover:text-[hsl(var(--foreground))] transition-colors"
            >
              <span>{item}</span>
              {i < items.length - 1 && (
                <span aria-hidden className="text-[hsl(var(--border))]">•</span>
              )}
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

export const awardsStripBlock = defineBlock<AwardsStripFields>({
  kind: 'awards-strip',
  name: 'Awards Strip',
  category: 'Content',
  icon: 'Award',
  variants: [{ key: 'default', label: 'Default' }],
  defaultVariant: 'default',
  fields: {
    eyebrow: { type: 'text', label: 'Eyebrow', maxLength: 60 },
    items: {
      type: 'textarea',
      label: 'Recognitions',
      description:
        'One per line. Awwwards · Site of the Day · 2024, FWA · Mobile of the Day, etc.',
    },
  },
  component: AwardsStrip,
});
