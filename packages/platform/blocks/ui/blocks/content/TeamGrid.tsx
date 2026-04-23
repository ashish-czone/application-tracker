import type { ReactNode } from 'react';
import type { TeamGridFields } from '@packages/blocks-contract';
import { defineBlock } from '../../registry';
import type { BlockRenderProps } from '../../types';

interface Fields extends Record<string, unknown> {
  heading?: string;
  subheading?: string;
  members?: TeamGridFields['members'];
}

/**
 * Editorial portrait grid — left-aligned section heading, 3/4 portrait
 * tiles with a hairline wash, name set in display weight, role in the
 * muted scale, LinkedIn surfaces on hover.
 */
function TeamGrid({ fields }: BlockRenderProps<Fields>): ReactNode {
  const { heading, subheading, members = [] } = fields;

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
        <div className="grid gap-x-6 gap-y-12 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {members.map((m) => (
            <article key={m.id} className="group flex flex-col gap-4">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-[hsl(var(--muted))]">
                {m.photoUrl ? (
                  <img
                    src={m.photoUrl}
                    alt={m.fullName}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                ) : (
                  <div aria-hidden className="h-full w-full bg-[hsl(var(--muted))]" />
                )}
                {m.linkedinUrl && (
                  <a
                    href={m.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute inset-x-3 bottom-3 flex items-center justify-center rounded-full bg-[hsl(var(--background))]/90 backdrop-blur px-3 py-1.5 text-xs font-medium tracking-wide opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`${m.fullName} on LinkedIn`}
                  >
                    LinkedIn →
                  </a>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <h3 className="text-lg font-semibold tracking-[-0.01em]">{m.fullName}</h3>
                {m.role && (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{m.role}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export const teamGridBlock = defineBlock<Fields>({
  kind: 'team-grid',
  name: 'Team',
  category: 'Content',
  icon: 'Users',
  supports: ['team-members'],
  fields: {
    subheading: { type: 'textarea', label: 'Subheading', maxLength: 240 },
  },
  component: TeamGrid,
});
