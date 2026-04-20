import { createElement, type ReactNode } from 'react';
import { defineBlock } from '../registry';
import type { BlockRenderProps } from '../types';

interface HeroFields extends Record<string, unknown> {
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  ctaHref?: string;
  imageUrl?: string;
}

function Hero({ fields, variant }: BlockRenderProps<HeroFields>): ReactNode {
  const { headline, subheadline, ctaText, ctaHref, imageUrl } = fields;
  const isSplit = variant === 'split';

  const copy = createElement(
    'div',
    { className: 'flex flex-col gap-4 max-w-xl' },
    headline ? createElement('h1', { className: 'text-4xl md:text-5xl font-bold tracking-tight' }, headline) : null,
    subheadline ? createElement('p', { className: 'text-lg text-muted-foreground' }, subheadline) : null,
    ctaText && ctaHref
      ? createElement(
          'a',
          { href: ctaHref, className: 'inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground w-fit' },
          ctaText,
        )
      : null,
  );

  const image = imageUrl
    ? createElement('img', { src: imageUrl, alt: '', className: 'rounded-lg w-full h-auto object-cover' })
    : null;

  return createElement(
    'section',
    { className: `w-full py-20 px-6 ${isSplit ? '' : 'text-center'}` },
    createElement(
      'div',
      { className: `mx-auto max-w-6xl ${isSplit ? 'grid gap-12 md:grid-cols-2 items-center' : 'flex flex-col items-center gap-6'}` },
      isSplit ? copy : copy,
      isSplit ? image : null,
    ),
  );
}

export const heroBlock = defineBlock<HeroFields>({
  kind: 'hero',
  name: 'Hero',
  category: 'Hero',
  icon: 'LayoutPanelTop',
  variants: [
    { key: 'centered', label: 'Centered' },
    { key: 'split', label: 'Split (image)' },
  ],
  defaultVariant: 'centered',
  fields: {
    headline: { type: 'text', label: 'Headline', required: true, maxLength: 120 },
    subheadline: { type: 'textarea', label: 'Subheadline', maxLength: 240 },
    ctaText: { type: 'text', label: 'CTA Text', maxLength: 40 },
    ctaHref: { type: 'url', label: 'CTA Link' },
    imageUrl: { type: 'url', label: 'Image URL', description: 'Shown only in the Split variant' },
  },
  component: Hero,
});
