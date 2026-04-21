import { createElement, type ReactNode } from 'react';
import type { ValuePropsGridFields } from '@packages/blocks-contract';
import { defineBlock } from '../../registry';
import type { BlockRenderProps } from '../../types';

interface Fields extends ValuePropsGridFields {
  heading?: string;
  subheading?: string;
}

function ValuePropsGrid({ fields }: BlockRenderProps<Fields>): ReactNode {
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
        { className: 'grid gap-10 md:grid-cols-2 lg:grid-cols-3' },
        ...items.map((item) =>
          createElement(
            'div',
            { key: item.id, className: 'flex flex-col gap-3' },
            createElement(
              'div',
              {
                className:
                  'flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary text-xl',
                'aria-hidden': true,
              },
              '★',
            ),
            createElement('h3', { className: 'text-xl font-semibold' }, item.title),
            createElement('p', { className: 'text-base text-muted-foreground' }, item.description),
          ),
        ),
      ),
    ),
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
