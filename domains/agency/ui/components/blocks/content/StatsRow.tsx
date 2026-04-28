import type { ReactNode } from 'react';
import type { StatsRowFields } from '@domains/agency-contract';
import { defineBlock } from '../registry';
import type { BlockRenderProps } from '../types';
import { Reveal } from '../../motion/Reveal';
import { Stagger } from '../../motion/Stagger';

interface Fields extends Record<string, unknown> {
  number?: string;
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  stats?: StatsRowFields['stats'];
}

function formatStat(value: number, suffix: string | null): string {
  const formatted = value.toLocaleString();
  return suffix ? `${formatted}${suffix}` : formatted;
}

/**
 * Oversized editorial numerals — full-width strip with a hairline above
 * each number, label below. Section uses an inverse (deep ink) tone by
 * default to break the page rhythm. Numbers scale up to the .text-mega
 * size (clamp ~6rem → 14rem).
 */
function StatsRow({ fields, variant }: BlockRenderProps<Fields>): ReactNode {
  const { number, eyebrow, heading, subheading, stats = [] } = fields;
  const inverse = variant !== 'paper';

  return (
    <section
      className={
        'w-full py-20 md:py-28 ' +
        (inverse
          ? 'bg-[hsl(var(--surface-inverse))] text-[hsl(var(--surface-inverse-foreground))]'
          : '')
      }
    >
      <div className="mx-auto max-w-7xl px-6 md:px-10 flex flex-col gap-14 md:gap-20">
        {(heading || eyebrow) && (
          <Reveal>
            <header className="grid grid-cols-12 gap-6 items-end">
              <div className="col-span-12 md:col-span-7 flex flex-col gap-4">
                {eyebrow && (
                  <span
                    className={
                      'text-xs font-semibold tracking-[0.22em] uppercase ' +
                      (inverse
                        ? 'text-[hsl(var(--surface-inverse-foreground))]/60'
                        : 'text-[hsl(var(--muted-foreground))]')
                    }
                  >
                    <span className="text-[hsl(var(--accent))]">{number ?? '04'}</span>
                    <span
                      className={
                        'mx-3 inline-block h-px w-8 align-middle ' +
                        (inverse
                          ? 'bg-[hsl(var(--surface-inverse-foreground))]/30'
                          : 'bg-[hsl(var(--hairline))]')
                      }
                    />
                    {eyebrow}
                  </span>
                )}
                {heading && (
                  <h2 className="text-4xl md:text-6xl font-semibold tracking-[-0.025em] leading-[0.98]">
                    {heading}
                  </h2>
                )}
              </div>
              {subheading && (
                <p
                  className={
                    'hidden md:block md:col-span-4 md:col-start-9 text-base leading-[1.55] ' +
                    (inverse
                      ? 'text-[hsl(var(--surface-inverse-foreground))]/70'
                      : 'text-[hsl(var(--muted-foreground))]')
                  }
                >
                  {subheading}
                </p>
              )}
            </header>
          </Reveal>
        )}

        <Stagger
          className={
            'grid grid-cols-1 md:grid-cols-2 ' +
            (stats.length === 3
              ? 'lg:grid-cols-3'
              : stats.length >= 4
                ? 'lg:grid-cols-4'
                : 'lg:grid-cols-2')
          }
          step={0.06}
        >
          {stats.map((s) => (
            <div
              key={s.id}
              className={
                'flex flex-col gap-4 py-8 md:py-10 px-1 md:px-6 ' +
                'border-t ' +
                (inverse
                  ? 'border-[hsl(var(--surface-inverse-foreground))]/20'
                  : 'border-[hsl(var(--hairline))]')
              }
            >
              <span className="text-mega leading-none tracking-[-0.045em]">
                {formatStat(s.value, s.suffix)}
              </span>
              <span
                className={
                  'text-xs font-semibold tracking-[0.22em] uppercase ' +
                  (inverse
                    ? 'text-[hsl(var(--surface-inverse-foreground))]/60'
                    : 'text-[hsl(var(--muted-foreground))]')
                }
              >
                {s.label}
              </span>
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
  variants: [
    { key: 'inverse', label: 'Ink (default)' },
    { key: 'paper', label: 'Paper' },
  ],
  defaultVariant: 'inverse',
  fields: {
    number: { type: 'text', label: 'Section number', maxLength: 4 },
    eyebrow: { type: 'text', label: 'Eyebrow', maxLength: 60 },
    heading: { type: 'text', label: 'Heading', maxLength: 120 },
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
  },
  component: StatsRow,
});
