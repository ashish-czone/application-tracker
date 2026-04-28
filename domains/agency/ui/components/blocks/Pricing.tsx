import type { ReactNode } from 'react';
import { defineBlock } from './registry';
import type { BlockRenderProps } from './types';

interface PricingFields extends Record<string, unknown> {
  heading?: string;
  subheading?: string;
  tiers?: string;
}

interface PricingTier {
  name: string;
  featured: boolean;
  price: string;
  features: string[];
  ctaText: string;
  ctaHref: string;
}

/**
 * Tiers are blank-line-delimited blocks. Each block:
 *
 *   Line 1 — Name   (append " (recommended)" to mark it featured)
 *   Line 2 — Price  (any string: "$49/mo", "from $999", "Custom")
 *   Lines 3..n-1 — Features (one per line)
 *   Last line — "CtaText :: CtaHref"
 *
 * Blocks with fewer than two lines are dropped. Missing CTA lines
 * just render the tier without a CTA button.
 */
function parseTiers(raw: string | undefined): PricingTier[] {
  if (!raw) return [];
  return raw
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) return null;
      const rawName = lines[0];
      const featured = /\(recommended\)/i.test(rawName);
      const name = rawName.replace(/\s*\(recommended\)\s*$/i, '').trim();
      const price = lines[1];
      const rest = lines.slice(2);
      let ctaText = '';
      let ctaHref = '';
      const maybeCta = rest[rest.length - 1];
      if (maybeCta && maybeCta.includes('::')) {
        const [text, href] = maybeCta.split('::').map((p) => p.trim());
        ctaText = text ?? '';
        ctaHref = href ?? '';
        rest.pop();
      }
      return {
        name,
        featured,
        price,
        features: rest,
        ctaText,
        ctaHref,
      } satisfies PricingTier;
    })
    .filter((t): t is PricingTier => t !== null);
}

function Pricing({ fields }: BlockRenderProps<PricingFields>): ReactNode {
  const { heading, subheading, tiers: raw } = fields;
  const tiers = parseTiers(raw);
  const cols = tiers.length <= 1 ? 'md:grid-cols-1' : tiers.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3';

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
        <div className={`grid gap-6 ${cols}`}>
          {tiers.map((t, i) => (
            <article
              key={i}
              className={`flex flex-col gap-6 rounded-2xl border p-8 ${
                t.featured
                  ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))] text-[hsl(var(--background))] shadow-xl shadow-black/10'
                  : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold tracking-[-0.01em]">{t.name}</h3>
                {t.featured && (
                  <span className="rounded-full bg-[hsl(var(--background))]/15 px-2.5 py-0.5 text-[10px] font-medium tracking-[0.15em] uppercase">
                    Recommended
                  </span>
                )}
              </div>
              <p
                className={`text-4xl md:text-5xl font-semibold tracking-[-0.03em] leading-none ${
                  t.featured ? '' : 'text-[hsl(var(--foreground))]'
                }`}
              >
                {t.price}
              </p>
              {t.features.length > 0 && (
                <ul className="flex flex-col gap-3 text-sm">
                  {t.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className={`mt-1 inline-block h-1.5 w-1.5 rounded-full ${
                          t.featured ? 'bg-[hsl(var(--background))]' : 'bg-[hsl(var(--foreground))]'
                        }`}
                      />
                      <span className={t.featured ? '' : 'text-[hsl(var(--foreground))]'}>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
              {t.ctaText && t.ctaHref && (
                <a
                  href={t.ctaHref}
                  className={`mt-auto inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-opacity hover:opacity-90 ${
                    t.featured
                      ? 'bg-[hsl(var(--background))] text-[hsl(var(--foreground))]'
                      : 'bg-[hsl(var(--foreground))] text-[hsl(var(--background))]'
                  }`}
                >
                  {t.ctaText}
                  <span aria-hidden>→</span>
                </a>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export const pricingBlock = defineBlock<PricingFields>({
  kind: 'pricing',
  name: 'Pricing',
  category: 'Content',
  icon: 'DollarSign',
  fields: {
    heading: { type: 'text', label: 'Heading', maxLength: 120 },
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
    tiers: {
      type: 'textarea',
      label: 'Tiers',
      description:
        'Blank line between tiers. Lines: Name (append " (recommended)" to feature), Price, Features (one per line), then "CTA text :: /link" as the last line.',
    },
  },
  component: Pricing,
});
