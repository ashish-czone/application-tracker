import { createElement, type ReactNode } from 'react';
import { defineBlock } from '../registry';
import type { BlockRenderProps } from '../types';

interface ImageFields extends Record<string, unknown> {
  src?: string;
  alt?: string;
  caption?: string;
}

function ImageBlock({ fields, variant }: BlockRenderProps<ImageFields>): ReactNode {
  const { src, alt, caption } = fields;
  if (!src) return null;
  const bleed = variant === 'full-bleed';
  return createElement(
    'section',
    { className: 'w-full py-12 px-6' },
    createElement(
      'figure',
      { className: bleed ? 'w-full' : 'mx-auto max-w-5xl' },
      createElement('img', { src, alt: alt ?? '', className: 'w-full h-auto object-cover rounded-lg' }),
      caption
        ? createElement('figcaption', { className: 'text-sm text-muted-foreground mt-2 text-center' }, caption)
        : null,
    ),
  );
}

export const imageBlock = defineBlock<ImageFields>({
  kind: 'image',
  name: 'Image',
  category: 'Content',
  icon: 'Image',
  variants: [
    { key: 'default', label: 'Default' },
    { key: 'full-bleed', label: 'Full bleed' },
  ],
  defaultVariant: 'default',
  fields: {
    src: { type: 'url', label: 'Image URL', required: true },
    alt: { type: 'text', label: 'Alt text', maxLength: 160, description: 'Read by screen readers' },
    caption: { type: 'text', label: 'Caption', maxLength: 200 },
  },
  component: ImageBlock,
});
