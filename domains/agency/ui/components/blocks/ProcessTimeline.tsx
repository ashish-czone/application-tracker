import type { ReactNode } from 'react';
import { defineBlock } from './registry';
import type { BlockRenderProps } from './types';

interface ProcessTimelineFields extends Record<string, unknown> {
  heading?: string;
  subheading?: string;
  steps?: string;
}

function pad2(n: number): string {
  return String(n + 1).padStart(2, '0');
}

/**
 * Steps are newline-delimited "Title :: Description" pairs, matching
 * the FeatureList DSL. Blank lines between entries are ignored.
 */
function parseSteps(raw: string | undefined): { title: string; description: string }[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, ...rest] = line.split('::').map((p) => p.trim());
      return { title: title ?? '', description: rest.join(' :: ') };
    });
}

function ProcessTimeline({ fields }: BlockRenderProps<ProcessTimelineFields>): ReactNode {
  const { heading, subheading, steps: raw } = fields;
  const steps = parseSteps(raw);

  return (
    <section className="w-full py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 md:px-10 flex flex-col gap-14">
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
        <ol className="relative flex flex-col gap-10 md:gap-14">
          <div
            aria-hidden
            className="absolute left-[19px] top-0 bottom-0 w-px bg-[hsl(var(--border))] md:left-[23px]"
          />
          {steps.map((step, i) => (
            <li key={i} className="relative flex gap-6 pl-12 md:pl-16">
              <span
                aria-hidden
                className="absolute left-0 top-0 flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-xs md:text-sm font-semibold tracking-[0.1em]"
              >
                {pad2(i)}
              </span>
              <div className="flex flex-col gap-2 pt-1 md:pt-2">
                <h3 className="text-xl md:text-2xl font-semibold tracking-[-0.01em] leading-tight">
                  {step.title}
                </h3>
                {step.description && (
                  <p className="text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
                    {step.description}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export const processTimelineBlock = defineBlock<ProcessTimelineFields>({
  kind: 'process-timeline',
  name: 'Process Timeline',
  category: 'Content',
  icon: 'ListOrdered',
  fields: {
    heading: { type: 'text', label: 'Heading', maxLength: 120 },
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
    steps: {
      type: 'textarea',
      label: 'Steps',
      description: 'One per line. Use "Title :: Description" to separate.',
    },
  },
  component: ProcessTimeline,
});
