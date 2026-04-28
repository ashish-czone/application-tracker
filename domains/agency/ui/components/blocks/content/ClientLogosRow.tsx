import type { ReactNode } from 'react';
import type { ClientLogosRowFields } from '@domains/agency-contract';
import { defineBlock } from '../registry';
import type { BlockRenderProps } from '../types';

interface Fields extends Record<string, unknown> {
  heading?: string;
  logos?: ClientLogosRowFields['logos'];
}

/**
 * Two variants:
 * - `marquee` (default): auto-scrolling strip, logos duplicated so
 *   the loop is seamless. Pure CSS — no framer-motion dep. Paused by
 *   `prefers-reduced-motion` globally via the portal's stylesheet.
 * - `grid`: wrapped flex grid, static. For sites that want the
 *   gravitas without the motion.
 */
function ClientLogosRow({ fields, variant }: BlockRenderProps<Fields>): ReactNode {
  const { heading, logos = [] } = fields;

  const renderLogo = (l: Fields['logos'] extends (infer T)[] | undefined ? T : never, key: string) => {
    if (!l) return null;
    const img = (
      <img
        src={l.logoUrl}
        alt={l.name}
        className="h-10 w-auto opacity-60 hover:opacity-100 grayscale hover:grayscale-0 transition"
      />
    );
    return l.href ? (
      <a key={key} href={l.href} target="_blank" rel="noreferrer" className="shrink-0">
        {img}
      </a>
    ) : (
      <div key={key} className="shrink-0">
        {img}
      </div>
    );
  };

  if (variant === 'grid') {
    return (
      <section className="w-full py-14 bg-[hsl(var(--surface-muted))]">
        <div className="mx-auto max-w-6xl px-6 md:px-10 flex flex-col gap-8">
          {heading && (
            <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
              {heading}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
            {logos.map((l) => renderLogo(l, l.id))}
          </div>
        </div>
      </section>
    );
  }

  // marquee (default) — duplicate the list so the translation loops
  // seamlessly. Animation is pure CSS via an inline keyframe.
  const doubled = [...logos, ...logos];

  return (
    <section className="w-full py-14 bg-[hsl(var(--surface-muted))] overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 md:px-10 flex flex-col gap-8">
        {heading && (
          <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
            {heading}
          </p>
        )}
      </div>
      <div
        className="relative mt-6 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
        aria-hidden={false}
      >
        <div
          className="flex items-center gap-16 w-max whitespace-nowrap"
          style={{ animation: 'marquee 40s linear infinite' }}
        >
          {doubled.map((l, i) => renderLogo(l, `${l.id}-${i}`))}
        </div>
        <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      </div>
    </section>
  );
}

export const clientLogosRowBlock = defineBlock<Fields>({
  kind: 'client-logos-row',
  name: 'Client Logos',
  category: 'Content',
  icon: 'Images',
  supports: ['client-logos'],
  variants: [
    { key: 'marquee', label: 'Marquee (scrolling)' },
    { key: 'grid', label: 'Grid (static)' },
  ],
  defaultVariant: 'marquee',
  fields: {},
  component: ClientLogosRow,
});
