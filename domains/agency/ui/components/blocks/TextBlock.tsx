import { createElement, type ReactNode } from 'react';
import { defineBlock } from './registry';
import type { BlockRenderProps } from './types';

interface TextFields extends Record<string, unknown> {
  heading?: string;
  body?: string;
}

function TextBlock({ fields }: BlockRenderProps<TextFields>): ReactNode {
  const { heading, body } = fields;
  return createElement(
    'section',
    { className: 'w-full py-12 px-6' },
    createElement(
      'div',
      { className: 'mx-auto max-w-3xl flex flex-col gap-4' },
      heading ? createElement('h2', { className: 'text-2xl md:text-3xl font-semibold' }, heading) : null,
      body ? createElement('div', { className: 'prose prose-neutral max-w-none whitespace-pre-wrap' }, body) : null,
    ),
  );
}

export const textBlock = defineBlock<TextFields>({
  kind: 'text',
  name: 'Text',
  category: 'Content',
  icon: 'Text',
  fields: {
    heading: { type: 'text', label: 'Heading', maxLength: 120 },
    body: { type: 'textarea', label: 'Body' },
  },
  component: TextBlock,
});
