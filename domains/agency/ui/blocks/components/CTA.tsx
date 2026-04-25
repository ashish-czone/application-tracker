import type { ReactNode } from 'react';
import { defineBlock } from '../registry';
import type { BlockRenderProps } from '../types';

interface CTAFields extends Record<string, unknown> {
  heading?: string;
  body?: string;
  primaryText?: string;
  primaryHref?: string;
  secondaryText?: string;
  secondaryHref?: string;
}

/**
 * Three variants:
 * - `centered` (default) — the classic boxed CTA, softened card on a
 *   neutral surface.
 * - `banner` — full-bleed inverse bar, heading + actions inline on
 *   desktop, stacked on mobile. Great as a page-bottom close.
 * - `split` — heading/body on the left, actions on the right. Reads
 *   conversational without taking the whole fold.
 */
function CTA({ fields, variant }: BlockRenderProps<CTAFields>): ReactNode {
  const { heading, body, primaryText, primaryHref, secondaryText, secondaryHref } = fields;

  const actions = (primaryText || secondaryText) ? (
    <div className="flex flex-wrap gap-3">
      {primaryText && primaryHref && (
        <a
          href={primaryHref}
          className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:opacity-90 transition-opacity"
        >
          {primaryText}
          <span aria-hidden>→</span>
        </a>
      )}
      {secondaryText && secondaryHref && (
        <a
          href={secondaryHref}
          className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors"
        >
          {secondaryText}
        </a>
      )}
    </div>
  ) : null;

  if (variant === 'banner') {
    return (
      <section className="w-full py-20 md:py-24 bg-[hsl(var(--foreground))] text-[hsl(var(--background))]">
        <div className="mx-auto max-w-6xl px-6 md:px-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            {heading && (
              <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] leading-tight">
                {heading}
              </h2>
            )}
            {body && (
              <p className="text-base md:text-lg text-[hsl(var(--background)/0.7)]">{body}</p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap gap-3 md:justify-end [&_a]:bg-[hsl(var(--background))] [&_a]:text-[hsl(var(--foreground))] [&_a]:border-transparent">
              {actions}
            </div>
          )}
        </div>
      </section>
    );
  }

  if (variant === 'split') {
    return (
      <section className="w-full py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6 md:px-10 grid gap-8 md:grid-cols-2 md:gap-16 items-center">
          <div className="space-y-4">
            {heading && (
              <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] leading-tight">
                {heading}
              </h2>
            )}
            {body && (
              <p className="text-base md:text-lg text-[hsl(var(--muted-foreground))]">{body}</p>
            )}
          </div>
          <div className="md:justify-self-end">{actions}</div>
        </div>
      </section>
    );
  }

  // centered (default)
  return (
    <section className="w-full py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 md:px-10">
        <div className="rounded-2xl bg-[hsl(var(--surface-muted))] p-10 md:p-16 text-center flex flex-col gap-5 items-center">
          {heading && (
            <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] leading-tight">
              {heading}
            </h2>
          )}
          {body && (
            <p className="text-base md:text-lg text-[hsl(var(--muted-foreground))] max-w-2xl">
              {body}
            </p>
          )}
          {actions && <div className="mt-2 justify-center flex flex-wrap gap-3">{actions}</div>}
        </div>
      </div>
    </section>
  );
}

export const ctaBlock = defineBlock<CTAFields>({
  kind: 'cta',
  name: 'Call to Action',
  category: 'Call to action',
  icon: 'Megaphone',
  variants: [
    { key: 'centered', label: 'Centered card' },
    { key: 'banner', label: 'Inverse banner' },
    { key: 'split', label: 'Split' },
  ],
  defaultVariant: 'centered',
  fields: {
    heading: { type: 'text', label: 'Heading', required: true, maxLength: 120 },
    body: { type: 'textarea', label: 'Body', maxLength: 280 },
    primaryText: { type: 'text', label: 'Primary button text', maxLength: 40 },
    primaryHref: { type: 'url', label: 'Primary button link' },
    secondaryText: { type: 'text', label: 'Secondary button text', maxLength: 40 },
    secondaryHref: { type: 'url', label: 'Secondary button link' },
  },
  component: CTA,
});
