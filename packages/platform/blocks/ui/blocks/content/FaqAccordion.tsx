import { createElement, type ReactNode } from 'react';
import type { FaqAccordionFields } from '@packages/blocks-contract';
import { defineBlock } from '../../registry';
import type { BlockRenderProps } from '../../types';

interface Fields extends FaqAccordionFields {
  heading?: string;
  subheading?: string;
}

function FaqAccordion({ fields }: BlockRenderProps<Fields>): ReactNode {
  const { heading, subheading, items = [] } = fields;

  return createElement(
    'section',
    { className: 'w-full py-20 px-6' },
    createElement(
      'div',
      { className: 'mx-auto max-w-3xl flex flex-col gap-10' },
      heading || subheading
        ? createElement(
            'div',
            { className: 'flex flex-col gap-3 text-center' },
            heading ? createElement('h2', { className: 'text-3xl md:text-4xl font-bold tracking-tight' }, heading) : null,
            subheading ? createElement('p', { className: 'text-lg text-muted-foreground' }, subheading) : null,
          )
        : null,
      createElement(
        'div',
        { className: 'flex flex-col divide-y border-y' },
        ...items.map((q) =>
          createElement(
            'details',
            { key: q.id, className: 'group py-4' },
            createElement(
              'summary',
              { className: 'flex cursor-pointer items-center justify-between gap-4 text-base font-medium' },
              q.question,
              createElement('span', { 'aria-hidden': true, className: 'text-muted-foreground transition group-open:rotate-45' }, '+'),
            ),
            createElement('p', { className: 'mt-3 text-base text-muted-foreground whitespace-pre-line' }, q.answer),
          ),
        ),
      ),
    ),
  );
}

export const faqAccordionBlock = defineBlock<Fields>({
  kind: 'faq-accordion',
  name: 'FAQ',
  category: 'Content',
  icon: 'HelpCircle',
  supports: ['faq-items'],
  fields: {
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
  },
  component: FaqAccordion,
});
