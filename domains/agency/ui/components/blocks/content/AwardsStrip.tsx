import type { ReactNode } from 'react';
import { defineBlock } from '../registry';
import type { BlockRenderProps } from '../types';
import { Reveal } from '../../motion/Reveal';
import { ColoredEyebrow } from '../../decoration/ColoredEyebrow';

const PRACTICE_TONES = [
  'hsl(var(--skin-practice-1))',
  'hsl(var(--skin-practice-2))',
  'hsl(var(--skin-practice-3))',
  'hsl(var(--skin-practice-4))',
  'hsl(var(--skin-practice-5))',
  'hsl(var(--skin-practice-6))',
] as const;

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
    <section
      className="relative w-full py-14 md:py-16 skin-surface"
      style={{
        background: 'hsl(var(--skin-cream))',
        borderTop: '1px solid hsl(var(--skin-card-border) / 0.6)',
        borderBottom: '1px solid hsl(var(--skin-card-border) / 0.6)',
      }}
    >
      <Reveal className="mx-auto max-w-6xl px-6 md:px-10 flex flex-col gap-6 items-center text-center">
        <ColoredEyebrow>{eyebrow}</ColoredEyebrow>
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-center gap-3"
              style={{ color: 'hsl(var(--skin-muted-ink))' }}
            >
              <span
                className="font-medium"
                style={{ color: 'hsl(var(--skin-ink))' }}
              >
                {item}
              </span>
              {i < items.length - 1 && (
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: PRACTICE_TONES[i % PRACTICE_TONES.length] }}
                />
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
