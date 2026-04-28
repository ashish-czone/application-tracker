import { createElement, Fragment, type ReactNode } from 'react';
import type { SectionData } from '@domains/agency-contract';
import { blockRegistry } from '../../../../components/blocks/registry';

export interface PageRendererProps {
  sections: SectionData[];
  /**
   * Rendered when a section's blockKind is not in the registry. Defaults to
   * rendering nothing so a missing block doesn't crash the page — the admin
   * should surface the same situation as a warning in the editor.
   */
  fallback?: (section: SectionData) => ReactNode;
}

/**
 * Composes each block's final `fields` prop. Precedence (low → high):
 *   1. `heading: section.title`  — default heading from the section title
 *   2. `section.data`            — server-resolved mapper output (for content
 *                                  blocks); `{}` for static/starter blocks
 *   3. `section.customFields`    — author-entered per-block config; wins over
 *                                  the mapper so a power user can pin values
 *
 * Static starter blocks (Hero, Text, Image, FeatureList, CTA) have empty
 * `data` and typically null `title`, so this reduces to `customFields` —
 * identical to the pre-content-block contract.
 */
function composeFields(section: SectionData): Record<string, unknown> {
  const fields: Record<string, unknown> = { ...section.data };
  if (section.title !== null) fields.heading = section.title;
  return { ...fields, ...section.customFields };
}

/**
 * Renders an ordered list of sections by looking each block up in the
 * registry and passing its composed fields + variant to the component.
 * Framework-agnostic — works in Next.js, Vite SSR, or anywhere React runs.
 */
export function PageRenderer({ sections, fallback }: PageRendererProps): ReactNode {
  const ordered = [...sections].sort((a, b) => a.order - b.order);

  return createElement(
    Fragment,
    null,
    ...ordered.map((section) => {
      const def = blockRegistry.get(section.blockKind);
      if (!def) {
        return fallback ? fallback(section) : null;
      }
      const variant = section.variant ?? def.defaultVariant ?? null;
      return createElement(def.component, {
        key: section.id,
        fields: composeFields(section),
        variant,
      });
    }),
  );
}
