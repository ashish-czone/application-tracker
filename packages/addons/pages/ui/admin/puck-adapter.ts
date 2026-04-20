import { createElement, type ReactNode } from 'react';
import type {
  BlockDefinition,
  BlockFieldSpec,
  BlockFieldType,
  SectionData,
} from '@packages/pages-ui-frontend';

/**
 * Shape of the Puck `Data` payload for our editor. We keep types loose
 * here (instead of importing Puck's heavily-generic `Data`) because the
 * editor always treats entries as plain `{ type, props }` with our own
 * id / variant conventions.
 */
export interface PuckContentItem {
  type: string;
  props: Record<string, unknown> & { id: string; variant?: string | null };
}

export interface PuckData {
  content: PuckContentItem[];
  root: { props: Record<string, unknown> };
}

export interface PuckField {
  type: 'text' | 'textarea' | 'number' | 'select' | 'radio';
  label?: string;
  options?: { label: string; value: string | number }[];
  min?: number;
  max?: number;
}

export interface PuckComponentConfig {
  label?: string;
  fields: Record<string, PuckField>;
  defaultProps?: Record<string, unknown>;
  render: (props: Record<string, unknown>) => ReactNode;
}

export interface PuckConfig {
  components: Record<string, PuckComponentConfig>;
  categories?: Record<string, { title?: string; components: string[] }>;
}

/**
 * Map the admin-authored field spec to Puck's built-in field primitives.
 * Types Puck doesn't ship (date, file, rich_text, multi_select) degrade
 * to `text` for v1; an adapter that routes these to our DynamicField is
 * a follow-up (tracked on the PR).
 */
function toPuckField(spec: BlockFieldSpec): PuckField {
  const label = spec.label;
  switch (spec.type as BlockFieldType) {
    case 'textarea':
    case 'rich_text':
      return { type: 'textarea', label };
    case 'number':
      return { type: 'number', label };
    case 'boolean':
      return {
        type: 'radio',
        label,
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' },
        ],
      };
    case 'picklist':
      return {
        type: 'select',
        label,
        options: (spec.options ?? []).map((o) => ({ label: o.label, value: o.value })),
      };
    default:
      return { type: 'text', label };
  }
}

function variantField(block: BlockDefinition): PuckField | null {
  if (!block.variants || block.variants.length === 0) return null;
  return {
    type: 'select',
    label: 'Variant',
    options: block.variants.map((v) => ({ label: v.label, value: v.key })),
  };
}

/**
 * Build the Puck `Config` object from our registered blocks. Each block
 * becomes one Puck component keyed by `kind`; its render delegates to
 * the block's actual React component so the admin preview and the
 * public site share the exact same output.
 */
export function buildPuckConfig(blocks: BlockDefinition[]): PuckConfig {
  const components: Record<string, PuckComponentConfig> = {};
  const categories: Record<string, { title?: string; components: string[] }> = {};

  for (const block of blocks) {
    const fields: Record<string, PuckField> = {};
    for (const [key, spec] of Object.entries(block.fields)) {
      fields[key] = toPuckField(spec);
    }
    const vField = variantField(block);
    if (vField) fields.variant = vField;

    const Component = block.component;

    components[block.kind] = {
      label: block.name,
      fields,
      defaultProps: block.defaultVariant ? { variant: block.defaultVariant } : undefined,
      render: (props) => {
        const { variant, ...rest } = props as Record<string, unknown> & { variant?: string };
        return createElement(Component, {
          fields: rest as any,
          variant: typeof variant === 'string' ? variant : null,
        });
      },
    };

    const catKey = block.category ?? 'Other';
    (categories[catKey] ??= { title: catKey, components: [] }).components.push(block.kind);
  }

  return { components, categories };
}

// ─── Serialization between Section rows and Puck Data ────────────────

export function sectionsToPuckData(sections: SectionData[]): PuckData {
  const ordered = [...sections].sort((a, b) => a.order - b.order);
  return {
    content: ordered.map((s) => ({
      type: s.blockKind,
      props: {
        id: s.id,
        ...(s.variant ? { variant: s.variant } : {}),
        ...s.customFields,
      },
    })),
    root: { props: {} },
  };
}

export interface SectionDraft {
  id: string;
  order: number;
  blockKind: string;
  variant: string | null;
  customFields: Record<string, unknown>;
}

/**
 * Project a Puck `Data` object back to the Section shape the API expects.
 * Splits `props` into the known discriminators (id, variant) and the
 * remaining `customFields` blob.
 */
export function puckDataToSections(data: PuckData): SectionDraft[] {
  return data.content.map((item, order) => {
    const { id, variant, ...rest } = item.props;
    return {
      id: typeof id === 'string' ? id : `tmp-${order}`,
      order,
      blockKind: item.type,
      variant: typeof variant === 'string' ? variant : null,
      customFields: rest,
    };
  });
}
