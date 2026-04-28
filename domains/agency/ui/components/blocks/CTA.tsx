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
 * Four variants:
 * - `sign-off` (default) — full-bleed inverse panel with the heading at
 *   display scale (.text-display, clamp ~5rem → 11rem). The page-end
 *   sign-off used by the agency homepage.
 * - `centered` — boxed CTA on a softened card.
 * - `banner` — full-bleed inverse bar, inline on desktop.
 * - `split` — heading/body on the left, actions on the right.
 */
function CTA({ fields, variant }: BlockRenderProps<CTAFields>): ReactNode {
  const { heading, body, primaryText, primaryHref, secondaryText, secondaryHref } = fields;

  const actions = (primaryText || secondaryText) ? (
    <div className="flex flex-wrap gap-3">
      {primaryText && primaryHref && (
        <HoverLift>
          <a
            href={primaryHref}
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:opacity-90 transition-opacity"
          >
            {primaryText}
            <span aria-hidden>→</span>
          </a>
        </HoverLift>
      )}
      {secondaryText && secondaryHref && (
        <HoverLift>
          <a
            href={secondaryHref}
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            {secondaryText}
          </a>
        </HoverLift>
      )}
    </div>
  ) : null;

  if (variant === 'sign-off') {
    return (
      <section className="w-full bg-[hsl(var(--surface-inverse))] text-[hsl(var(--surface-inverse-foreground))]">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-24 md:py-36 flex flex-col gap-10 md:gap-14">
          <Reveal>
            <span className="text-xs font-semibold tracking-[0.22em] uppercase text-[hsl(var(--accent))]">
              <span className="mr-3">06</span>
              <span className="inline-block h-px w-8 align-middle bg-[hsl(var(--surface-inverse-foreground))]/30 mr-3" />
              Get in touch
            </span>
          </Reveal>
          {heading && (
            <Reveal delay={0.05}>
              <h2 className="text-display max-w-[14ch]">{heading}</h2>
            </Reveal>
          )}
          {body && (
            <div className="grid grid-cols-12 gap-6 items-end">
              <Reveal delay={0.1} className="col-span-12 md:col-span-6 md:col-start-7">
                <p className="text-lg md:text-xl text-[hsl(var(--surface-inverse-foreground))]/70 leading-[1.55] max-w-xl">
                  {body}
                </p>
              </Reveal>
            </div>
          )}
          {(primaryText || secondaryText) && (
            <Reveal delay={0.15}>
              <div className="flex flex-wrap items-center gap-3">
                {primaryText && primaryHref && (
                  <HoverLift>
                    <a
                      href={primaryHref}
                      className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:opacity-90 transition-opacity"
                    >
                      {primaryText}
                      <span aria-hidden>→</span>
                    </a>
                  </HoverLift>
                )}
                {secondaryText && secondaryHref && (
                  <HoverLift>
                    <a
                      href={secondaryHref}
                      className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium border border-[hsl(var(--surface-inverse-foreground))]/30 text-[hsl(var(--surface-inverse-foreground))] hover:bg-[hsl(var(--surface-inverse-foreground))]/10 transition-colors"
                    >
                      {secondaryText}
                    </a>
                  </HoverLift>
                )}
              </div>
            </Reveal>
          )}
        </div>
      </section>
    );
  }

  if (variant === 'banner') {
    return (
      <section className="w-full py-20 md:py-24 bg-[hsl(var(--foreground))] text-[hsl(var(--background))]">
        <Reveal className="mx-auto max-w-6xl px-6 md:px-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
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
        </Reveal>
      </section>
    );
  }

  if (variant === 'split') {
    return (
      <section className="w-full py-20 md:py-28">
        <Reveal className="mx-auto max-w-6xl px-6 md:px-10 grid gap-8 md:grid-cols-2 md:gap-16 items-center">
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
        </Reveal>
      </section>
    );
  }

  // centered (default)
  return (
    <section className="w-full py-20 md:py-28">
      <Reveal className="mx-auto max-w-4xl px-6 md:px-10">
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
    { key: 'sign-off', label: 'Sign-off (default)' },
    { key: 'centered', label: 'Centered card' },
    { key: 'banner', label: 'Inverse banner' },
    { key: 'split', label: 'Split' },
  ],
  defaultVariant: 'sign-off',
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
