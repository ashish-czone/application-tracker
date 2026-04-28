import type { ReactNode } from 'react';
import { defineBlock } from './registry';
import type { BlockRenderProps } from './types';
import { Reveal } from '../motion/Reveal';
import { HoverLift } from '../motion/HoverLift';

interface CTAFields extends Record<string, unknown> {
  heading?: string;
  body?: string;
  primaryText?: string;
  primaryHref?: string;
  secondaryText?: string;
  secondaryHref?: string;
}

/**
 * Variants:
 * - `default` — vercel-light. Bordered white card on a muted strip,
 *   centred copy, black pill primary + ghost secondary. Restrained.
 * - `banner` — full-bleed dark bar, inline copy + actions on desktop.
 * - `split` — heading/body left, actions right.
 */
function CTA({ fields, variant }: BlockRenderProps<CTAFields>): ReactNode {
  const { heading, body, primaryText, primaryHref, secondaryText, secondaryHref } = fields;

  const primaryCta = primaryText && primaryHref && (
    <HoverLift>
      <a
        href={primaryHref}
        className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground))]/90 transition-colors"
      >
        {primaryText}
        <span aria-hidden className="text-base leading-none">→</span>
      </a>
    </HoverLift>
  );

  const secondaryCta = secondaryText && secondaryHref && (
    <HoverLift>
      <a
        href={secondaryHref}
        className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
      >
        {secondaryText}
      </a>
    </HoverLift>
  );

  const actions = (primaryCta || secondaryCta) && (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {primaryCta}
      {secondaryCta}
    </div>
  );

  if (variant === 'banner') {
    return (
      <section className="w-full bg-[hsl(var(--foreground))] text-[hsl(var(--background))]">
        <Reveal className="mx-auto max-w-6xl px-6 md:px-10 py-16 md:py-20 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="space-y-2 max-w-2xl">
            {heading && (
              <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.025em] leading-tight">
                {heading}
              </h2>
            )}
            {body && (
              <p className="text-base text-[hsl(var(--background)/0.7)]">{body}</p>
            )}
          </div>
          {(primaryText || secondaryText) && (
            <div className="flex flex-wrap gap-3 md:justify-end">
              {primaryText && primaryHref && (
                <HoverLift>
                  <a
                    href={primaryHref}
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium bg-[hsl(var(--background))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--background))]/90 transition-colors"
                  >
                    {primaryText}
                    <span aria-hidden className="text-base leading-none">→</span>
                  </a>
                </HoverLift>
              )}
              {secondaryText && secondaryHref && (
                <HoverLift>
                  <a
                    href={secondaryHref}
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium border border-[hsl(var(--background)/0.3)] text-[hsl(var(--background))] hover:bg-[hsl(var(--background)/0.1)] transition-colors"
                  >
                    {secondaryText}
                  </a>
                </HoverLift>
              )}
            </div>
          )}
        </Reveal>
      </section>
    );
  }

  if (variant === 'split') {
    return (
      <section className="w-full py-20 md:py-28 bg-[hsl(var(--muted))] border-y border-[hsl(var(--border))]">
        <Reveal className="mx-auto max-w-6xl px-6 md:px-10 grid gap-10 md:grid-cols-2 md:gap-16 items-center">
          <div className="space-y-4">
            {heading && <h2 className="text-headline">{heading}</h2>}
            {body && <p className="text-lead">{body}</p>}
          </div>
          <div className="md:justify-self-end flex flex-wrap gap-3">
            {primaryCta}
            {secondaryCta}
          </div>
        </Reveal>
      </section>
    );
  }

  // default — bordered card centred on a muted strip.
  return (
    <section className="w-full bg-[hsl(var(--muted))] py-20 md:py-28 border-y border-[hsl(var(--border))]">
      <Reveal className="mx-auto max-w-3xl px-6 md:px-10">
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-10 md:p-14 text-center flex flex-col gap-6 items-center shadow-sm">
          {heading && <h2 className="text-headline max-w-2xl">{heading}</h2>}
          {body && <p className="text-lead max-w-xl">{body}</p>}
          {actions && <div className="mt-2">{actions}</div>}
        </div>
      </Reveal>
    </section>
  );
}

export const ctaBlock = defineBlock<CTAFields>({
  kind: 'cta',
  name: 'Call to Action',
  category: 'Call to action',
  icon: 'Megaphone',
  variants: [
    { key: 'default', label: 'Default' },
    { key: 'banner', label: 'Inverse banner' },
    { key: 'split', label: 'Split' },
  ],
  defaultVariant: 'default',
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
