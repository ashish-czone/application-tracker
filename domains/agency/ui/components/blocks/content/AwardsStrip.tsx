import type { ReactNode } from 'react';
import { defineBlock } from '../registry';
import type { BlockRenderProps } from '../types';
import { Marquee } from '../../editorial/Marquee';

interface AwardsStripFields extends Record<string, unknown> {
  /** Newline-delimited recognitions, e.g. "Awwwards · Site of the Day" per line. */
  items?: string;
  /** Tone — accent (rust strip) is the showpiece; default is paper, inverse is ink. */
  tone?: 'default' | 'inverse' | 'accent';
  /** Type scale for the marquee. */
  size?: 'sm' | 'lg' | 'xl';
}

function parseItems(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * A single-row continuously scrolling marquee for awards / recognitions /
 * client name walls. Hand-authored content — fed via the `items` textarea
 * (one per line). For client-logo carousels with images, see ClientLogosRow.
 */
function AwardsStrip({ fields, variant }: BlockRenderProps<AwardsStripFields>): ReactNode {
  const items = parseItems(fields.items);
  if (items.length === 0) return null;
  // Variant overrides the field-level tone so authors can swap inline
  // without rebuilding the section.
  const tone = (variant as 'default' | 'inverse' | 'accent' | undefined) ?? fields.tone ?? 'inverse';
  const size = fields.size ?? 'xl';
  return <Marquee items={items} tone={tone} size={size} durationSec={45} separator="✦" />;
}

export const awardsStripBlock = defineBlock<AwardsStripFields>({
  kind: 'awards-strip',
  name: 'Awards Strip',
  category: 'Content',
  icon: 'Award',
  variants: [
    { key: 'inverse', label: 'Ink (default)' },
    { key: 'accent', label: 'Accent (rust)' },
    { key: 'default', label: 'Paper' },
  ],
  defaultVariant: 'inverse',
  fields: {
    items: {
      type: 'textarea',
      label: 'Recognitions',
      description:
        'One per line. Awwwards · Site of the Day · 2024, FWA · Mobile of the Day, etc.',
    },
  },
  component: AwardsStrip,
});
