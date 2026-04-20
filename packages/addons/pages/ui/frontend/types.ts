import type { ComponentType } from 'react';

/**
 * Lightweight field-type set supported by blocks. Mirrors the platform's
 * FieldType but kept local so pages-ui-frontend has no platform deps — the
 * admin package is where fields are projected to the full `FieldDefinition`
 * shape consumed by `DynamicField`.
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
  /** React component rendered on both admin preview and the public site */
  component: ComponentType<BlockRenderProps<TFields>>;
}

/** Shape returned by GET /public/pages/:slug — public-site consumes this. */
export interface SectionData {
  id: string;
  order: number;
  blockKind: string;
  variant: string | null;
  customFields: Record<string, unknown>;
}

export interface PageData {
  id: string;
  slug: string;
  title: string;
  metaDescription: string | null;
  ogImage: string | null;
}

export interface PublicPageResponse {
  page: PageData;
  sections: SectionData[];
}
