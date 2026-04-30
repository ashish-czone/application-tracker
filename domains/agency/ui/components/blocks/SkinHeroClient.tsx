'use client';

import type { ReactNode } from 'react';
import { Reveal } from '../motion/Reveal';
import { HoverLift } from '../motion/HoverLift';
import { OrbitingBadge } from '../decoration/OrbitingBadge';
import { ColoredEyebrow } from '../decoration/ColoredEyebrow';
import { UnderlinedKeyword } from '../decoration/UnderlinedKeyword';
import { WorkspaceIllustration } from '../decoration/WorkspaceIllustration';
import { ProductStackIllustration } from '../decoration/ProductStackIllustration';
import { useSkin } from '../decoration/useSkin';
import { Rocket, Zap, Users, Award, Star, ShieldCheck } from 'lucide-react';

export interface SkinHeroBadge {
  primary: string;
  secondary: string;
  icon?: string;
}

export interface SkinHeroClientProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  keyword?: string;
  badges: SkinHeroBadge[];
  primaryCta: { text: string; href: string } | null;
  secondaryCta: { text: string; href: string } | null;
}

const BADGE_ICONS: Record<string, ReactNode> = {
  rocket: <Rocket className="h-4 w-4" />,
  zap: <Zap className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
  award: <Award className="h-4 w-4" />,
  star: <Star className="h-4 w-4" />,
  shield: <ShieldCheck className="h-4 w-4" />,
};

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

export function SkinHeroClient({
  eyebrow,
  headline,
  subheadline,
  keyword,
  badges,
  primaryCta,
  secondaryCta,
}: SkinHeroClientProps): ReactNode {
  const skin = useSkin();
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

  if (skin === 'editorial') {
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

  if (skin === 'product') {
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

  // warm — default
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
