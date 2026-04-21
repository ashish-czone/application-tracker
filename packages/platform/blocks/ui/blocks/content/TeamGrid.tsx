import { createElement, type ReactNode } from 'react';
import type { TeamGridFields } from '@packages/blocks-contract';
import { defineBlock } from '../../registry';
import type { BlockRenderProps } from '../../types';

interface Fields extends TeamGridFields {
  heading?: string;
  subheading?: string;
}

function TeamGrid({ fields }: BlockRenderProps<Fields>): ReactNode {
  const { heading, subheading, members = [] } = fields;

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
        { className: 'grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4' },
        ...members.map((m) =>
          createElement(
            'article',
            { key: m.id, className: 'flex flex-col items-center gap-3 text-center' },
            m.photoUrl
              ? createElement('img', {
                  src: m.photoUrl,
                  alt: m.fullName,
                  className: 'h-28 w-28 rounded-full object-cover',
                })
              : createElement('div', {
                  className: 'h-28 w-28 rounded-full bg-muted',
                  'aria-hidden': true,
                }),
            createElement(
              'div',
              { className: 'flex flex-col gap-0.5' },
              createElement('h3', { className: 'font-medium' }, m.fullName),
              m.role ? createElement('p', { className: 'text-sm text-muted-foreground' }, m.role) : null,
            ),
            m.linkedinUrl
              ? createElement(
                  'a',
                  {
                    href: m.linkedinUrl,
                    className: 'text-sm text-primary hover:underline',
                    target: '_blank',
                    rel: 'noreferrer',
                  },
                  'LinkedIn',
                )
              : null,
          ),
        ),
      ),
    ),
  );
}

export const teamGridBlock = defineBlock<Fields>({
  kind: 'team-grid',
  name: 'Team',
  category: 'Content',
  icon: 'Users',
  supports: ['team-members'],
  fields: {
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
  },
  component: TeamGrid,
});
