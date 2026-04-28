import type { ReactNode } from 'react';
import type { StatsRowFields } from '@domains/agency-contract';
import { defineBlock } from '../registry';
import type { BlockRenderProps } from '../types';
import { Reveal } from '../../motion/Reveal';
import { Stagger } from '../../motion/Stagger';

interface Fields extends Record<string, unknown> {
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  stats?: StatsRowFields['stats'];
  /** Retained for content compatibility; unused. */
  number?: string;
}

function formatStat(value: number, suffix: string | null): string {
  const formatted = value.toLocaleString();
  return suffix ? `${formatted}${suffix}` : formatted;
}

const COLS_CLASS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

/**
 * Mono-spaced numerals on a muted strip with hairline dividers between
 * cells. Restrained, technical — the agency equivalent of a dashboard
 * stat block.
 */
function StatsRow({ fields }: BlockRenderProps<Fields>): ReactNode {
  const { eyebrow, heading, subheading, stats = [] } = fields;
  const colsKey = Math.max(1, Math.min(4, stats.length || 4)) as 1 | 2 | 3 | 4;
  const cols = COLS_CLASS[colsKey];

  return (
    <section className="w-full bg-[hsl(var(--muted))] py-20 md:py-28 border-y border-[hsl(var(--border))]">
      <div className="mx-auto max-w-6xl px-6 md:px-10 flex flex-col gap-12">
        {(heading || eyebrow) && (
          <Reveal>
            <header className="flex flex-col gap-4 max-w-3xl">
              {eyebrow && <span className="text-eyebrow">[ {eyebrow} ]</span>}
              {heading && <h2 className="text-headline">{heading}</h2>}
              {subheading && <p className="text-lead max-w-2xl">{subheading}</p>}
            </header>
          </Reveal>
        )}

        <Stagger
          className={`grid grid-cols-1 ${cols} divide-y divide-[hsl(var(--border))] sm:divide-y-0 sm:divide-x rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]`}
          step={0.05}
        >
          {stats.map((s) => (
            <div key={s.id} className="flex flex-col gap-1 p-6 md:p-8">
              <span
                className="font-semibold tracking-[-0.03em] leading-none text-[clamp(2.25rem,1.5rem+2vw,3rem)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {formatStat(s.value, s.suffix)}
              </span>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">{s.label}</span>
            </div>
          ))}
        </Stagger>
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
  variants: [{ key: 'default', label: 'Default' }],
  defaultVariant: 'default',
  fields: {
    eyebrow: { type: 'text', label: 'Eyebrow', maxLength: 60 },
    heading: { type: 'text', label: 'Heading', maxLength: 120 },
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
    number: { type: 'text', label: 'Section number (legacy)', maxLength: 4 },
  },
  component: StatsRow,
});
