import type { ReactNode } from 'react';
import type { FaqAccordionFields } from '@packages/blocks-contract';
import { defineBlock } from '../../registry';
import type { BlockRenderProps } from '../../types';

interface Fields extends Record<string, unknown> {
  heading?: string;
  subheading?: string;
  items?: FaqAccordionFields['items'];
}

/**
 * Editorial FAQ — left-aligned section heading matching F4, larger
 * question type, hairline dividers, plus/minus marker that rotates
 * on open. Uses `<details>` / `<summary>` so the accordion works
 * without JS.
 */
function FaqAccordion({ fields }: BlockRenderProps<Fields>): ReactNode {
  const { heading, subheading, items = [] } = fields;

  return (
    <section className="w-full py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-6 md:px-10 flex flex-col gap-12">
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
        <div className="flex flex-col divide-y divide-[hsl(var(--border))] border-y border-[hsl(var(--border))]">
          {items.map((q) => (
            <details key={q.id} className="group py-6 marker:hidden open:pb-7 transition-all">
              <summary
                className="flex cursor-pointer items-start justify-between gap-6 text-lg md:text-xl font-medium tracking-[-0.01em] text-[hsl(var(--foreground))] list-none"
              >
                <span className="flex-1 pr-2">{q.question}</span>
                <span
                  aria-hidden
                  className="relative mt-1 flex h-5 w-5 shrink-0 items-center justify-center"
                >
                  <span className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-[hsl(var(--foreground))]" />
                  <span className="absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 bg-[hsl(var(--foreground))] transition-transform duration-200 group-open:scale-y-0" />
                </span>
              </summary>
              <p className="mt-4 text-base md:text-lg leading-relaxed text-[hsl(var(--muted-foreground))] whitespace-pre-line">
                {q.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export const faqAccordionBlock = defineBlock<Fields>({
  kind: 'faq-accordion',
  name: 'FAQ',
  category: 'Content',
  icon: 'HelpCircle',
  supports: ['faq-items'],
  fields: {
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
  },
  component: FaqAccordion,
});
