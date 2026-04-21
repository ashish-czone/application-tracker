import { createElement, type ReactNode } from 'react';
import { defineBlock } from '../registry';
import type { BlockRenderProps } from '../types';

interface CTAFields extends Record<string, unknown> {
  heading?: string;
  body?: string;
  primaryText?: string;
  primaryHref?: string;
  secondaryText?: string;
  secondaryHref?: string;
}

function CTA({ fields }: BlockRenderProps<CTAFields>): ReactNode {
  const { heading, body, primaryText, primaryHref, secondaryText, secondaryHref } = fields;
  return createElement(
    'section',
    { className: 'w-full py-16 px-6' },
    createElement(
      'div',
      { className: 'mx-auto max-w-4xl rounded-2xl bg-muted/40 p-10 text-center flex flex-col gap-4 items-center' },
      heading ? createElement('h2', { className: 'text-2xl md:text-3xl font-semibold' }, heading) : null,
      body ? createElement('p', { className: 'text-base text-muted-foreground max-w-2xl' }, body) : null,
      createElement(
        'div',
        { className: 'flex flex-wrap gap-3 justify-center mt-2' },
        primaryText && primaryHref
          ? createElement(
              'a',
              { href: primaryHref, className: 'inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground' },
              primaryText,
            )
          : null,
        secondaryText && secondaryHref
          ? createElement(
              'a',
              { href: secondaryHref, className: 'inline-flex items-center rounded-md border border-border px-5 py-2.5 text-sm font-medium' },
              secondaryText,
            )
          : null,
      ),
    ),
  );
}

export const ctaBlock = defineBlock<CTAFields>({
  kind: 'cta',
  name: 'Call to Action',
  category: 'Call to action',
  icon: 'Megaphone',
  fields: {
    heading: { type: 'text', label: 'Heading', required: true, maxLength: 120 },
    body: { type: 'textarea', label: 'Body', maxLength: 280 },
    primaryText: { type: 'text', label: 'Primary button text', maxLength: 40 },
    primaryHref: { type: 'url', label: 'Primary button link' },
    secondaryText: { type: 'text', label: 'Secondary button text', maxLength: 40 },
    secondaryHref: { type: 'url', label: 'Secondary button link' },
  },
  component: CTA,
});
