import type { ReactNode } from 'react';
import type { StatsRowFields } from '@domains/agency-contract';
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

/**
 * Oversized editorial numerals. The stat values are the visual —
 * labels sit beneath as a typographic counterpoint. Works at any
 * count (2/3/4 columns); the grid auto-distributes.
 */
function StatsRow({ fields }: BlockRenderProps<Fields>): ReactNode {
  const { heading, subheading, stats = [] } = fields;
  const cols = stats.length <= 2 ? 'md:grid-cols-2' : stats.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4';

  return (
    <section className="w-full py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6 md:px-10 flex flex-col gap-14">
        {(heading || subheading) && (
          <div className="flex flex-col gap-3 max-w-2xl">
            {heading && (
              <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.02em] leading-[1.05]">
                {heading}
              </h2>
            )}
            {subheading && (
              <p className="text-lg text-[hsl(var(--muted-foreground))]">{subheading}</p>
            )}
          </div>
        )}
        <div className={`grid gap-x-10 gap-y-12 grid-cols-2 ${cols}`}>
          {stats.map((s) => (
            <div key={s.id} className="flex flex-col gap-3 border-t border-[hsl(var(--border))] pt-6">
              <span className="text-6xl md:text-7xl lg:text-8xl font-semibold tracking-[-0.04em] leading-none">
                {formatStat(s.value, s.suffix)}
              </span>
              <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
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
