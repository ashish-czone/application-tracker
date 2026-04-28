import type { ReactNode } from 'react';
import { defineBlock } from './registry';
import type { BlockRenderProps } from './types';
import { Reveal } from '../motion/Reveal';
import { Stagger } from '../motion/Stagger';
import { HoverLift } from '../motion/HoverLift';
import { Parallax } from '../motion/Parallax';

interface HeroFields extends Record<string, unknown> {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  ctaHref?: string;
  ctaSecondaryText?: string;
  ctaSecondaryHref?: string;
  imageUrl?: string;
  /** Retained for content compatibility; unused by the default variant. */
  number?: string;
  meta?: string;
}

/**
 * Primary hero. Variants:
 *
 * - `default` — vercel-light. Mono eyebrow, measured display headline,
 *   muted subhead, black pill primary + ghost secondary, subtle indigo
 *   gradient backdrop. Reads engineered, not theatrical.
 * - `split` — copy left, image right.
 * - `full-bleed` — image fills the fold, copy on a dark scrim.
 */
function Hero({ fields, variant }: BlockRenderProps<HeroFields>): ReactNode {
  const {
    eyebrow,
    headline,
    subheadline,
    ctaText,
    ctaHref,
    ctaSecondaryText,
    ctaSecondaryHref,
    imageUrl,
  } = fields;

  const primaryCta = ctaText && ctaHref && (
    <HoverLift>
      <a
        href={ctaHref}
        className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground))]/90 transition-colors"
      >
        {ctaText}
        <span aria-hidden className="text-base leading-none">→</span>
      </a>
    </HoverLift>
  );

  const secondaryCta = ctaSecondaryText && ctaSecondaryHref && (
    <HoverLift>
      <a
        href={ctaSecondaryHref}
        className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
      >
        {ctaSecondaryText}
      </a>
    </HoverLift>
  );

  if (variant === 'full-bleed' && imageUrl) {
    return (
      <section className="relative w-full min-h-[90vh] flex items-end overflow-hidden">
        <Parallax className="absolute inset-0 w-full h-full" strength={0.25}>
          <img src={imageUrl} alt="" className="w-full h-[120%] object-cover" />
        </Parallax>
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-6xl px-6 md:px-10 pb-20 md:pb-32 text-white">
          <Stagger className="flex flex-col gap-6 max-w-3xl" step={0.07}>
            {eyebrow && (
              <span className="text-eyebrow text-white/70">[ {eyebrow} ]</span>
            )}
            {headline && <h1 className="text-display">{headline}</h1>}
            {subheadline && (
              <p className="text-lg md:text-xl text-white/80 leading-relaxed max-w-2xl">
                {subheadline}
              </p>
            )}
            {(primaryCta || secondaryCta) && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {primaryCta}
                {secondaryCta}
              </div>
            )}
          </Stagger>
        </div>
      </section>
    );
  }

  if (variant === 'split') {
    return (
      <section className="w-full bg-hero-gradient py-20 md:py-28 border-b border-[hsl(var(--border))]">
        <div className="mx-auto max-w-6xl px-6 md:px-10 grid gap-12 md:grid-cols-2 md:gap-16 items-center">
          <Stagger className="flex flex-col gap-6" step={0.07}>
            {eyebrow && (
              <span className="text-eyebrow">[ {eyebrow} ]</span>
            )}
            {headline && <h1 className="text-hero">{headline}</h1>}
            {subheadline && (
              <p className="text-lead max-w-xl">{subheadline}</p>
            )}
            {(primaryCta || secondaryCta) && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {primaryCta}
                {secondaryCta}
              </div>
            )}
          </Stagger>
          <Reveal delay={0.15}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                className="rounded-xl border border-[hsl(var(--border))] shadow-sm w-full h-auto object-cover aspect-[4/5]"
              />
            ) : (
              <div className="rounded-xl border border-[hsl(var(--border))] aspect-[4/5] bg-[hsl(var(--muted))]" aria-hidden />
            )}
          </Reveal>
        </div>
      </section>
    );
  }

  // default — vercel-light, type-driven, gradient backdrop, mono eyebrow.
  return (
    <section className="relative w-full bg-hero-gradient overflow-hidden border-b border-[hsl(var(--border))]">
      <div className="mx-auto max-w-5xl px-6 md:px-10 pt-24 md:pt-32 pb-20 md:pb-28 flex flex-col items-center text-center gap-7">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1 text-mono">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]"
              aria-hidden
            />
            {eyebrow ?? `Available for new work · ${new Date().getFullYear()}`}
          </span>
        </Reveal>
        {headline && (
          <Reveal delay={0.06}>
            <h1 className="text-display max-w-4xl">{headline}</h1>
          </Reveal>
        )}
        {subheadline && (
          <Reveal delay={0.12}>
            <p className="text-lead max-w-2xl">{subheadline}</p>
          </Reveal>
        )}
        {(primaryCta || secondaryCta) && (
          <Reveal delay={0.18}>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {primaryCta}
              {secondaryCta}
            </div>
          </Reveal>
        )}
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
    { key: 'default', label: 'Default' },
    { key: 'split', label: 'Split (image)' },
    { key: 'full-bleed', label: 'Full-bleed image' },
  ],
  defaultVariant: 'default',
  fields: {
    eyebrow: {
      type: 'text',
      label: 'Eyebrow',
      maxLength: 60,
      description: 'Small mono label above the headline.',
    },
    headline: { type: 'text', label: 'Headline', required: true, maxLength: 120 },
    subheadline: { type: 'textarea', label: 'Subheadline', maxLength: 240 },
    ctaText: { type: 'text', label: 'Primary CTA text', maxLength: 40 },
    ctaHref: { type: 'url', label: 'Primary CTA link' },
    ctaSecondaryText: { type: 'text', label: 'Secondary CTA text', maxLength: 40 },
    ctaSecondaryHref: { type: 'url', label: 'Secondary CTA link' },
    imageUrl: {
      type: 'url',
      label: 'Image URL',
      description: 'Used by Split and Full-bleed variants only.',
    },
    number: { type: 'text', label: 'Section number (legacy)', maxLength: 4 },
    meta: { type: 'text', label: 'Meta label (legacy)', maxLength: 60 },
  },
  component: Hero,
});
