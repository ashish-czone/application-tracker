import type { ComponentType } from 'react';

/**
 * Lightweight field-type set supported by block-authored `customFields`. Mirrors
 * the platform's richer FieldType but kept local so blocks-ui has no entity-
 * engine deps — the admin editor projects these to the full `FieldDefinition`
 * shape its form renderer consumes.
 */
export type BlockFieldType =
  | 'text'
  | 'textarea'
  | 'rich_text'
  | 'number'
  | 'boolean'
  | 'url'
  | 'email'
  | 'phone'
  | 'date'
  | 'datetime'
  | 'picklist'
  | 'multi_select'
  | 'file';

export interface BlockFieldSpec {
  type: BlockFieldType;
  label: string;
  required?: boolean;
  /** Max length for text-based fields */
  maxLength?: number;
  /** Default value for new sections using this block */
  defaultValue?: string | number | boolean;
  /** Picklist/multi_select options */
  options?: { value: string; label: string }[];
  /** Help text shown under the input in the admin editor */
  description?: string;
}

export interface BlockVariant {
  key: string;
  label: string;
}

export interface BlockRenderProps<TFields extends Record<string, unknown> = Record<string, unknown>> {
  fields: TFields;
  variant: string | null;
}

export interface BlockDefinition<TFields extends Record<string, unknown> = Record<string, unknown>> {
  /** Stable string key stored in section.blockKind. Change = data migration. */
  kind: string;
  /** Human-readable name shown in the block picker */
  name: string;
  /** Picker grouping, e.g. "Hero", "Content", "Call to action" */
  category?: string;
  /** Lucide icon name */
  icon?: string;
  /** Field schema authored in declarative form */
  fields: Record<string, BlockFieldSpec>;
  /** Optional visual variants */
  variants?: BlockVariant[];
  /** Default variant key if the section has none */
  defaultVariant?: string;
  /**
   * Entity slugs this block can render. Used by the editor to filter the
   * (entity × block) picker. Empty or omitted = the block is purely static
   * (renders only from its own `customFields`, no data source).
   */
  supports?: string[];
  /** React component rendered on both admin preview and the public site */
  component: ComponentType<BlockRenderProps<TFields>>;
}
