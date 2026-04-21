import { createElement, type ReactNode } from 'react';
import type { ServicesGridFields } from '@packages/blocks-contract';
import { defineBlock } from '../../registry';
import type { BlockRenderProps } from '../../types';

interface Fields extends Record<string, unknown> {
  heading?: string;
  subheading?: string;
  services?: ServicesGridFields['services'];
}

function ServicesGrid({ fields }: BlockRenderProps<Fields>): ReactNode {
  const { heading, subheading, services = [] } = fields;

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
        ...services.map((s) =>
          createElement(
            'article',
            { key: s.id, className: 'flex flex-col gap-3 rounded-lg border bg-card p-6' },
            createElement('h3', { className: 'text-xl font-semibold' }, s.name),
            createElement('p', { className: 'text-base text-muted-foreground flex-1' }, s.description),
            s.ctaText && s.ctaHref
              ? createElement(
                  'a',
                  {
                    href: s.ctaHref,
                    className: 'text-sm font-medium text-primary hover:underline w-fit',
                  },
                  `${s.ctaText} →`,
                )
              : null,
          ),
        ),
      ),
    ),
  );
}

export const servicesGridBlock = defineBlock<Fields>({
  kind: 'services-grid',
  name: 'Services',
  category: 'Content',
  icon: 'Briefcase',
  supports: ['services'],
  fields: {
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
  },
  component: ServicesGrid,
});
