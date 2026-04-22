import type { ReactNode } from 'react';
import { defineBlock } from '../registry';
import type { BlockRenderProps } from '../types';

interface HeroFields extends Record<string, unknown> {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  ctaHref?: string;
  ctaSecondaryText?: string;
  ctaSecondaryHref?: string;
  imageUrl?: string;
}

/**
 * Primary hero for landing pages. Ships three variants:
 *
 * - `centered` — headline + sub + CTA row, centered. Good for a bold
 *   statement page.
 * - `split` — two-column copy/image. Works when you want a visual to
 *   share the fold with the pitch.
 * - `full-bleed` — image takes over the whole fold, copy sits on an
 *   inverted scrim. Most dramatic; needs a strong image.
 */
function Hero({ fields, variant }: BlockRenderProps<HeroFields>): ReactNode {
  const { eyebrow, headline, subheadline, ctaText, ctaHref, ctaSecondaryText, ctaSecondaryHref, imageUrl } = fields;

  const copy = (
    <div className="flex flex-col gap-6">
      {eyebrow && (
        <span className="text-xs font-semibold tracking-[0.14em] uppercase text-[hsl(var(--muted-foreground))]">
          {eyebrow}
        </span>
      )}
      {headline && (
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.05] tracking-[-0.02em]">
          {headline}
        </h1>
      )}
      {subheadline && (
        <p className="text-lg md:text-xl text-[hsl(var(--muted-foreground))] leading-relaxed max-w-2xl">
          {subheadline}
        </p>
      )}
      {(ctaText || ctaSecondaryText) && (
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {ctaText && ctaHref && (
            <a
              href={ctaHref}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:opacity-90 transition-opacity"
            >
              {ctaText}
              <span aria-hidden>→</span>
            </a>
          )}
          {ctaSecondaryText && ctaSecondaryHref && (
            <a
              href={ctaSecondaryHref}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              {ctaSecondaryText}
            </a>
          )}
        </div>
      )}
    </div>
  );

  if (variant === 'full-bleed' && imageUrl) {
    return (
      <section className="relative w-full min-h-[90vh] flex items-end">
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" aria-hidden />
        <div className="relative mx-auto w-full max-w-6xl px-6 md:px-10 pb-20 md:pb-32 text-white">
          {copy}
        </div>
      </section>
    );
  }

  if (variant === 'split') {
    return (
      <section className="w-full py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6 md:px-10 grid gap-12 md:grid-cols-2 md:gap-16 items-center">
          {copy}
          {imageUrl ? (
            <img src={imageUrl} alt="" className="rounded-lg w-full h-auto object-cover aspect-[4/5]" />
          ) : (
            <div className="rounded-lg aspect-[4/5] bg-[hsl(var(--muted))]" aria-hidden />
          )}
        </div>
      </section>
    );
  }

  // centered (default)
  return (
    <section className="w-full py-24 md:py-36">
      <div className="mx-auto max-w-4xl px-6 md:px-10 text-center">
        <div className="flex flex-col items-center gap-6">
          {copy}
        </div>
      </div>
    </section>
  );
}

export const heroBlock = defineBlock<HeroFields>({
  kind: 'hero',
  name: 'Hero',
  category: 'Hero',
  icon: 'LayoutPanelTop',
  variants: [
    { key: 'centered', label: 'Centered' },
    { key: 'split', label: 'Split (image)' },
    { key: 'full-bleed', label: 'Full-bleed image' },
  ],
  defaultVariant: 'centered',
  fields: {
    eyebrow: { type: 'text', label: 'Eyebrow', maxLength: 60, description: 'Small uppercase label above the headline.' },
    headline: { type: 'text', label: 'Headline', required: true, maxLength: 120 },
    subheadline: { type: 'textarea', label: 'Subheadline', maxLength: 240 },
    ctaText: { type: 'text', label: 'Primary CTA text', maxLength: 40 },
    ctaHref: { type: 'url', label: 'Primary CTA link' },
    ctaSecondaryText: { type: 'text', label: 'Secondary CTA text', maxLength: 40 },
    ctaSecondaryHref: { type: 'url', label: 'Secondary CTA link' },
    imageUrl: { type: 'url', label: 'Image URL', description: 'Used by Split and Full-bleed variants.' },
  },
  component: Hero,
});
