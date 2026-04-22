import type { ReactNode } from 'react';
import type { TestimonialsGridFields } from '@packages/blocks-contract';
import { defineBlock } from '../../registry';
import type { BlockRenderProps } from '../../types';

interface Fields extends Record<string, unknown> {
  heading?: string;
  subheading?: string;
  items?: TestimonialsGridFields['items'];
}

function TestimonialsGrid({ fields }: BlockRenderProps<Fields>): ReactNode {
  const { heading, subheading, items = [] } = fields;

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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <figure
              key={t.id}
              className="relative flex flex-col gap-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8 transition-shadow hover:shadow-lg hover:shadow-black/5"
            >
              <span
                aria-hidden
                className="absolute top-6 right-6 text-5xl leading-none text-[hsl(var(--muted-foreground)/0.25)] font-serif"
              >
                ”
              </span>
              <blockquote className="text-lg leading-relaxed text-[hsl(var(--foreground))]">
                {t.quote}
              </blockquote>
              <figcaption className="flex items-center gap-4 mt-auto pt-4 border-t border-[hsl(var(--border))]">
                {t.avatarUrl ? (
                  <img
                    src={t.avatarUrl}
                    alt={t.authorName}
                    className="h-11 w-11 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-11 w-11 rounded-full bg-[hsl(var(--muted))]" aria-hidden />
                )}
                <div className="flex flex-col leading-tight">
                  <span className="font-medium">{t.authorName}</span>
                  {(t.authorRole || t.companyName) && (
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">
                      {[t.authorRole, t.companyName].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export const testimonialsGridBlock = defineBlock<Fields>({
  kind: 'testimonials-grid',
  name: 'Testimonials',
  category: 'Content',
  icon: 'MessageSquareQuote',
  supports: ['testimonials'],
  fields: {
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
  },
  component: TestimonialsGrid,
});
