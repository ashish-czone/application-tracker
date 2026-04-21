import { createElement, type ReactNode } from 'react';
import type { ClientLogosRowFields } from '@packages/blocks-contract';
import { defineBlock } from '../../registry';
import type { BlockRenderProps } from '../../types';

interface Fields extends ClientLogosRowFields {
  heading?: string;
}

function ClientLogosRow({ fields }: BlockRenderProps<Fields>): ReactNode {
  const { heading, logos = [] } = fields;

  return createElement(
    'section',
    { className: 'w-full py-14 px-6 bg-muted/30' },
    createElement(
      'div',
      { className: 'mx-auto max-w-6xl flex flex-col gap-8' },
      heading
        ? createElement(
            'p',
            { className: 'text-center text-sm font-medium uppercase tracking-wider text-muted-foreground' },
            heading,
          )
        : null,
      createElement(
        'div',
        { className: 'flex flex-wrap items-center justify-center gap-x-12 gap-y-8' },
        ...logos.map((l) => {
          const img = createElement('img', {
            src: l.logoUrl,
            alt: l.name,
            className: 'h-10 w-auto opacity-60 hover:opacity-100 transition grayscale hover:grayscale-0',
          });
          return l.href
            ? createElement('a', { key: l.id, href: l.href, target: '_blank', rel: 'noreferrer' }, img)
            : createElement('div', { key: l.id }, img);
        }),
      ),
    ),
  );
}

export const clientLogosRowBlock = defineBlock<Fields>({
  kind: 'client-logos-row',
  name: 'Client Logos',
  category: 'Content',
  icon: 'Images',
  supports: ['client-logos'],
  fields: {},
  component: ClientLogosRow,
});
