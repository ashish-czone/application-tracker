import { createElement, type ReactNode } from 'react';
import type { TestimonialsGridFields } from '@packages/blocks-contract';
import { defineBlock } from '../../registry';
import type { BlockRenderProps } from '../../types';

interface Fields extends Record<string, unknown> {
  heading?: string;
  subheading?: string;
  items?: TestimonialsGridFields['items'];
}

function TestimonialsGrid({ fields }: BlockRenderProps<Fields>): ReactNode {
  const { heading, subheading, items = [] } = fields;

  return createElement(
    'section',
    { className: 'w-full py-20 px-6' },
    createElement(
      'div',
      { className: 'mx-auto max-w-6xl flex flex-col gap-12' },
      heading || subheading
        ? createElement(
            'div',
            { className: 'flex flex-col gap-3 text-center max-w-2xl mx-auto' },
            heading ? createElement('h2', { className: 'text-3xl md:text-4xl font-bold tracking-tight' }, heading) : null,
            subheading ? createElement('p', { className: 'text-lg text-muted-foreground' }, subheading) : null,
          )
        : null,
      createElement(
        'div',
        { className: 'grid gap-6 md:grid-cols-2 lg:grid-cols-3' },
        ...items.map((t) =>
          createElement(
            'figure',
            { key: t.id, className: 'flex flex-col gap-4 rounded-lg border bg-card p-6' },
            createElement('blockquote', { className: 'text-base leading-relaxed' }, `“${t.quote}”`),
            createElement(
              'figcaption',
              { className: 'flex items-center gap-3 mt-auto pt-2' },
              t.avatarUrl
                ? createElement('img', {
                    src: t.avatarUrl,
                    alt: t.authorName,
                    className: 'h-10 w-10 rounded-full object-cover',
                  })
                : null,
              createElement(
                'div',
                { className: 'flex flex-col' },
                createElement('span', { className: 'font-medium' }, t.authorName),
                t.authorRole || t.companyName
                  ? createElement(
                      'span',
                      { className: 'text-sm text-muted-foreground' },
                      [t.authorRole, t.companyName].filter(Boolean).join(' · '),
                    )
                  : null,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

export const testimonialsGridBlock = defineBlock<Fields>({
  kind: 'testimonials-grid',
  name: 'Testimonials',
  category: 'Content',
  icon: 'MessageSquareQuote',
  supports: ['testimonials'],
  fields: {
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
  },
  component: TestimonialsGrid,
});
