import { createElement, Fragment, type ReactNode } from 'react';
import { blockRegistry } from './registry';
import type { SectionData } from './types';

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
 * Renders an ordered list of sections by looking each block up in the
 * registry and passing its `customFields` + `variant` to the component.
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
        fields: section.customFields,
        variant,
      });
    }),
  );
}
