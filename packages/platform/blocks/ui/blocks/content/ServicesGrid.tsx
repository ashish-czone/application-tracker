import type { ReactNode } from 'react';
import type { ServicesGridFields } from '@packages/blocks-contract';
import { defineBlock } from '../../registry';
import type { BlockRenderProps } from '../../types';

interface Fields extends Record<string, unknown> {
  heading?: string;
  subheading?: string;
  services?: ServicesGridFields['services'];
}

function pad2(n: number): string {
  return String(n + 1).padStart(2, '0');
}

/**
 * Editorial service list — numbered eyebrow, display-weight name,
 * muted description, arrow-link CTA. Each cell sits above a hairline
 * top rule so the grid reads as a tabular catalogue rather than a
 * deck of cards.
 */
function ServicesGrid({ fields }: BlockRenderProps<Fields>): ReactNode {
  const { heading, subheading, services = [] } = fields;

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
        <div className="grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => (
            <article
              key={s.id}
              className="flex flex-col gap-4 border-t border-[hsl(var(--border))] pt-6"
            >
              <span className="text-xs font-medium tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
                {pad2(i)}
              </span>
              <h3 className="text-2xl md:text-3xl font-semibold tracking-[-0.01em] leading-tight">
                {s.name}
              </h3>
              <p className="text-base leading-relaxed text-[hsl(var(--muted-foreground))] flex-1">
                {s.description}
              </p>
              {s.ctaText && s.ctaHref && (
                <a
                  href={s.ctaHref}
                  className="group/link inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--foreground))] w-fit"
                >
                  <span className="underline-offset-4 group-hover/link:underline">
                    {s.ctaText}
                  </span>
                  <span
                    aria-hidden
                    className="transition-transform duration-200 group-hover/link:translate-x-0.5"
                  >
                    →
                  </span>
                </a>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export const servicesGridBlock = defineBlock<Fields>({
  kind: 'services-grid',
  name: 'Services',
  category: 'Content',
  icon: 'Briefcase',
  supports: ['services'],
  fields: {
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
  },
  component: ServicesGrid,
});
