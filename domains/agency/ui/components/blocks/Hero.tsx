import type { ReactNode } from 'react';
import { defineBlock } from './registry';
import type { BlockRenderProps } from './types';
import { Reveal } from '../motion/Reveal';
import { Stagger } from '../motion/Stagger';
import { HoverLift } from '../motion/HoverLift';
import { Parallax } from '../motion/Parallax';
import { UnderlinedKeyword } from '../decoration/UnderlinedKeyword';
import { OrbitingBadge } from '../decoration/OrbitingBadge';
import { ColoredEyebrow } from '../decoration/ColoredEyebrow';
import { WorkspaceIllustration } from '../decoration/WorkspaceIllustration';
import { ProductStackIllustration } from '../decoration/ProductStackIllustration';
import { Rocket, Zap, Users, Award, Star, ShieldCheck } from 'lucide-react';

interface HeroBadge {
  primary: string;
  secondary: string;
  icon?: string;
}

interface HeroFields extends Record<string, unknown> {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  ctaHref?: string;
  ctaSecondaryText?: string;
  ctaSecondaryHref?: string;
  imageUrl?: string;
  /** Substring inside `headline` to wrap with UnderlinedKeyword. */
  keyword?: string;
  /** Multi-line `primary :: secondary :: icon` for skin-variant orbiting pills. */
  badges?: string;
  /** Retained for content compatibility; unused by the default variant. */
  number?: string;
  meta?: string;
}

const BADGE_ICONS: Record<string, ReactNode> = {
  rocket: <Rocket className="h-4 w-4" />,
  zap: <Zap className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
  award: <Award className="h-4 w-4" />,
  star: <Star className="h-4 w-4" />,
  shield: <ShieldCheck className="h-4 w-4" />,
};

function parseBadges(raw: string | undefined): HeroBadge[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('::').map((p) => p.trim());
      return {
        primary: parts[0] ?? '',
        secondary: parts[1] ?? '',
        icon: parts[2]?.toLowerCase(),
      };
    })
    .filter((b) => b.primary);
}

function renderHeadline(headline: string, keyword?: string): ReactNode {
  if (!keyword || !headline.includes(keyword)) return headline;
  const idx = headline.indexOf(keyword);
  return (
    <>
      {headline.slice(0, idx)}
      <UnderlinedKeyword>{keyword}</UnderlinedKeyword>
      {headline.slice(idx + keyword.length)}
    </>
  );
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
    keyword,
    badges: badgesRaw,
  } = fields;

  const badges = parseBadges(badgesRaw);

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

  if (variant === 'warm' || variant === 'editorial' || variant === 'product-stack') {
    return (
      <SkinHero
        variant={variant}
        eyebrow={eyebrow}
        headline={headline}
        subheadline={subheadline}
        keyword={keyword}
        badges={badges}
        primaryCta={ctaText && ctaHref ? { text: ctaText, href: ctaHref } : null}
        secondaryCta={
          ctaSecondaryText && ctaSecondaryHref
            ? { text: ctaSecondaryText, href: ctaSecondaryHref }
            : null
        }
      />
    );
  }

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

interface SkinHeroProps {
  variant: 'warm' | 'editorial' | 'product-stack';
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  keyword?: string;
  badges: HeroBadge[];
  primaryCta: { text: string; href: string } | null;
  secondaryCta: { text: string; href: string } | null;
}

function SkinPrimaryCta({ text, href }: { text: string; href: string }) {
  return (
    <HoverLift>
      <a
        href={href}
        className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors"
        style={{
          background: 'hsl(var(--skin-anchor))',
          color: 'white',
          boxShadow: '0 10px 24px -10px hsl(var(--skin-anchor) / 0.55)',
        }}
      >
        {text}
        <span aria-hidden className="text-base leading-none">→</span>
      </a>
    </HoverLift>
  );
}

function SkinSecondaryCta({ text, href }: { text: string; href: string }) {
  return (
    <HoverLift>
      <a
        href={href}
        className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium hover:bg-white/60 transition-colors"
        style={{
          color: 'hsl(var(--skin-ink))',
          border: '1px solid hsl(var(--skin-card-border))',
          background: 'transparent',
        }}
      >
        {text}
      </a>
    </HoverLift>
  );
}

function SkinHero({
  variant,
  eyebrow,
  headline,
  subheadline,
  keyword,
  badges,
  primaryCta,
  secondaryCta,
}: SkinHeroProps): ReactNode {
  const renderedHeadline = headline ? renderHeadline(headline, keyword) : null;

  const ctaRow = (primaryCta || secondaryCta) && (
    <Reveal delay={0.18}>
      <div className="flex flex-wrap items-center gap-3 pt-2">
        {primaryCta && <SkinPrimaryCta {...primaryCta} />}
        {secondaryCta && <SkinSecondaryCta {...secondaryCta} />}
      </div>
    </Reveal>
  );

  const eyebrowEl = eyebrow && (
    <Reveal>
      <ColoredEyebrow>{eyebrow}</ColoredEyebrow>
    </Reveal>
  );

  if (variant === 'editorial') {
    return (
      <section className="relative w-full overflow-hidden skin-surface">
        <div className="absolute inset-0 -z-0 bg-skin-hero" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6 md:px-10 pt-24 md:pt-32 pb-16 md:pb-24 grid gap-10 md:grid-cols-[1.4fr_1fr] items-center">
          <div className="flex flex-col gap-7">
            {eyebrowEl}
            {renderedHeadline && (
              <Reveal delay={0.06}>
                <h1
                  className="text-display"
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'clamp(2.75rem, 2rem + 4vw, 5.5rem)',
                    lineHeight: 0.98,
                    letterSpacing: '-0.04em',
                    color: 'hsl(var(--skin-ink))',
                  }}
                >
                  {renderedHeadline}
                </h1>
              </Reveal>
            )}
            {subheadline && (
              <Reveal delay={0.12}>
                <p
                  className="max-w-xl text-lg md:text-xl leading-relaxed"
                  style={{ color: 'hsl(var(--skin-muted-ink))' }}
                >
                  {subheadline}
                </p>
              </Reveal>
            )}
            {ctaRow}
          </div>
          <Reveal delay={0.2}>
            <div
              className="relative flex flex-col gap-4 rounded-2xl p-6 md:p-8"
              style={{
                background: 'hsl(var(--skin-cream))',
                border: '1px solid hsl(var(--skin-card-border))',
              }}
            >
              <span
                className="text-xs font-mono uppercase tracking-widest"
                style={{ color: 'hsl(var(--skin-anchor-ink))' }}
              >
                By the numbers
              </span>
              {badges.slice(0, 4).map((b, i) => (
                <div key={i} className="flex items-baseline justify-between gap-4">
                  <span
                    className="font-semibold"
                    style={{
                      fontSize: 'clamp(2rem, 1.5rem + 2vw, 3rem)',
                      lineHeight: 1,
                      color: 'hsl(var(--skin-ink))',
                    }}
                  >
                    {b.primary}
                  </span>
                  <span
                    className="text-sm text-right max-w-[55%]"
                    style={{ color: 'hsl(var(--skin-muted-ink))' }}
                  >
                    {b.secondary}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
    );
  }

  if (variant === 'product-stack') {
    return (
      <section className="relative w-full overflow-hidden skin-surface">
        <div className="absolute inset-0 -z-10 bg-skin-hero" aria-hidden />
        <div className="absolute inset-0 -z-10 bg-skin-dots opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6 md:px-10 pt-20 md:pt-28 pb-20 md:pb-28 grid gap-10 md:grid-cols-2 items-center">
          <div className="flex flex-col gap-6">
            {eyebrowEl}
            {renderedHeadline && (
              <Reveal delay={0.06}>
                <h1
                  className="text-display"
                  style={{
                    color: 'hsl(var(--skin-ink))',
                    fontSize: 'clamp(2.5rem, 1.8rem + 3.5vw, 4.5rem)',
                    lineHeight: 1.02,
                    letterSpacing: '-0.035em',
                  }}
                >
                  {renderedHeadline}
                </h1>
              </Reveal>
            )}
            {subheadline && (
              <Reveal delay={0.12}>
                <p
                  className="text-lead max-w-xl"
                  style={{ color: 'hsl(var(--skin-muted-ink))' }}
                >
                  {subheadline}
                </p>
              </Reveal>
            )}
            {ctaRow}
          </div>
          <Reveal delay={0.2}>
            <div className="relative">
              <ProductStackIllustration />
              {badges[0] && (
                <OrbitingBadge
                  className="absolute -top-2 -right-2 md:-right-6"
                  icon={BADGE_ICONS[badges[0].icon ?? 'zap'] ?? BADGE_ICONS.zap}
                  primary={badges[0].primary}
                  secondary={badges[0].secondary}
                  tone="hsl(var(--skin-practice-2))"
                  phase={0}
                />
              )}
              {badges[1] && (
                <OrbitingBadge
                  className="absolute bottom-2 -left-2 md:-left-8"
                  icon={BADGE_ICONS[badges[1].icon ?? 'users'] ?? BADGE_ICONS.users}
                  primary={badges[1].primary}
                  secondary={badges[1].secondary}
                  tone="hsl(var(--skin-practice-3))"
                  phase={0.6}
                />
              )}
              {badges[2] && (
                <OrbitingBadge
                  className="absolute top-1/2 -right-3 md:-right-10"
                  icon={BADGE_ICONS[badges[2].icon ?? 'star'] ?? BADGE_ICONS.star}
                  primary={badges[2].primary}
                  secondary={badges[2].secondary}
                  tone="hsl(var(--skin-practice-4))"
                  phase={1.2}
                />
              )}
            </div>
          </Reveal>
        </div>
      </section>
    );
  }

  // warm
  return (
    <section className="relative w-full overflow-hidden skin-surface">
      <div className="absolute inset-0 -z-10 bg-skin-hero" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-6 md:px-10 pt-20 md:pt-28 pb-20 md:pb-28 grid gap-10 md:grid-cols-2 items-center">
        <Reveal delay={0.05}>
          <div className="relative order-last md:order-first">
            <WorkspaceIllustration />
            {badges[0] && (
              <OrbitingBadge
                className="absolute -top-2 right-0 md:-right-4"
                icon={BADGE_ICONS[badges[0].icon ?? 'zap'] ?? BADGE_ICONS.zap}
                primary={badges[0].primary}
                secondary={badges[0].secondary}
                tone="hsl(var(--skin-practice-2))"
                phase={0}
              />
            )}
            {badges[1] && (
              <OrbitingBadge
                className="absolute bottom-6 -left-2 md:-left-6"
                icon={BADGE_ICONS[badges[1].icon ?? 'users'] ?? BADGE_ICONS.users}
                primary={badges[1].primary}
                secondary={badges[1].secondary}
                tone="hsl(var(--skin-practice-3))"
                phase={0.6}
              />
            )}
            {badges[2] && (
              <OrbitingBadge
                className="absolute top-1/2 -right-2 md:-right-4"
                icon={BADGE_ICONS[badges[2].icon ?? 'star'] ?? BADGE_ICONS.star}
                primary={badges[2].primary}
                secondary={badges[2].secondary}
                tone="hsl(var(--skin-practice-4))"
                phase={1.2}
              />
            )}
          </div>
        </Reveal>
        <div className="flex flex-col gap-6">
          {eyebrowEl}
          {renderedHeadline && (
            <Reveal delay={0.06}>
              <h1
                className="text-display"
                style={{
                  color: 'hsl(var(--skin-ink))',
                  fontSize: 'clamp(2.5rem, 1.8rem + 3.5vw, 4.5rem)',
                  lineHeight: 1.02,
                  letterSpacing: '-0.035em',
                }}
              >
                {renderedHeadline}
              </h1>
            </Reveal>
          )}
          {subheadline && (
            <Reveal delay={0.12}>
              <p
                className="text-lead max-w-xl"
                style={{ color: 'hsl(var(--skin-muted-ink))' }}
              >
                {subheadline}
              </p>
            </Reveal>
          )}
          {ctaRow}
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
    { key: 'default', label: 'Default' },
    { key: 'split', label: 'Split (image)' },
    { key: 'full-bleed', label: 'Full-bleed image' },
    { key: 'warm', label: 'Skin · Warm' },
    { key: 'editorial', label: 'Skin · Editorial' },
    { key: 'product-stack', label: 'Skin · Product stack' },
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
    keyword: {
      type: 'text',
      label: 'Underlined keyword',
      maxLength: 40,
      description: 'Substring of the headline to wrap with the skin-styled underline.',
    },
    badges: {
      type: 'textarea',
      label: 'Stat badges',
      description: 'One per line: `Primary :: Secondary :: icon`. Icons: rocket/zap/users/award/star/shield.',
    },
    number: { type: 'text', label: 'Section number (legacy)', maxLength: 4 },
    meta: { type: 'text', label: 'Meta label (legacy)', maxLength: 60 },
  },
  component: Hero,
});
