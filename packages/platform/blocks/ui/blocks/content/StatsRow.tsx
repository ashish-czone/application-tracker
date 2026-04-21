import { createElement, type ReactNode } from 'react';
import type { StatsRowFields } from '@packages/blocks-contract';
import { defineBlock } from '../../registry';
import type { BlockRenderProps } from '../../types';

interface Fields extends Record<string, unknown> {
  heading?: string;
  subheading?: string;
  stats?: StatsRowFields['stats'];
}

function formatStat(value: number, suffix: string | null): string {
  const formatted = value.toLocaleString();
  return suffix ? `${formatted}${suffix}` : formatted;
}

function StatsRow({ fields }: BlockRenderProps<Fields>): ReactNode {
  const { heading, subheading, stats = [] } = fields;

  return createElement(
    'section',
    { className: 'w-full py-16 px-6' },
    createElement(
      'div',
      { className: 'mx-auto max-w-6xl flex flex-col gap-10' },
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
        { className: 'grid gap-8 grid-cols-2 md:grid-cols-4' },
        ...stats.map((s) =>
          createElement(
            'div',
            { key: s.id, className: 'flex flex-col items-center gap-1 text-center' },
            createElement(
              'span',
              { className: 'text-4xl md:text-5xl font-bold tracking-tight' },
              formatStat(s.value, s.suffix),
            ),
            createElement(
              'span',
              { className: 'text-sm text-muted-foreground uppercase tracking-wider' },
              s.label,
            ),
          ),
        ),
      ),
    ),
  );
}

export const statsRowBlock = defineBlock<Fields>({
  kind: 'stats-row',
  name: 'Stats',
  category: 'Content',
  icon: 'BarChart3',
  supports: ['stats'],
  fields: {
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
  },
  component: StatsRow,
});
