import { createElement, type ReactNode } from 'react';
import type {
  BlockDefinition,
  BlockFieldSpec,
  BlockFieldType,
} from '../components/blocks';
import type { DataSource } from '@domains/agency-contract';
import { DataSourcePicker } from './DataSourcePicker';

/**
 * Minimal structural shape the adapter needs to serialize a section into Puck.
 * We avoid depending on the broader `SectionData` here because the admin
 * reads rows via the entity-engine list API — those rows don't carry the
 * server-resolved `data` or a section-title slot, both of which are
 * irrelevant while authoring.
 */
export interface PuckSectionInput {
  id: string;
  order: number;
  blockKind: string;
  variant: string | null;
  customFields: Record<string, unknown>;
  /** Where the block pulls records from. `null` = static, no data fetch. */
  dataSource?: DataSource | null;
}

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

export interface PuckCustomFieldRender<Value = unknown> {
  (props: { value: Value; onChange: (value: Value) => void }): ReactNode;
}

export interface PuckField {
  type: 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'custom';
  label?: string;
  options?: { label: string; value: string | number }[];
  min?: number;
  max?: number;
  /** Set when `type === 'custom'`. Puck calls this with `{ value, onChange }`. */
  render?: PuckCustomFieldRender<any>;
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

export interface BuildPuckConfigOptions {
  /**
   * Entity slugs the surrounding app has registered. Blocks declaring a
   * non-empty `supports` list are filtered to those whose declared entities
   * intersect with this set — a block needing testimonials disappears when
   * the testimonials entity isn't installed.
   *
   * Omit (or pass `undefined`) to skip filtering — every block is shown.
   */
  availableEntities?: string[];
}

/**
 * Returns the blocks that should appear in the Puck picker for a given
 * environment. Static-only blocks (empty `supports`) always pass. Blocks
 * declaring `supports` only pass when at least one of their entities is in
 * `availableEntities`. When `availableEntities` is omitted, no filtering
 * happens — useful for tests, single-tenant apps, or when block visibility
 * isn't gated on entity registration.
 */
export function filterBlocksBySupports(
  blocks: BlockDefinition[],
  availableEntities?: string[],
): BlockDefinition[] {
  if (!availableEntities) return blocks;
  const available = new Set(availableEntities);
  return blocks.filter((b) => {
    const supports = b.supports;
    if (!supports || supports.length === 0) return true;
    return supports.some((s) => available.has(s));
  });
}

/**
 * Build the Puck `Config` object from our registered blocks. Each block
 * becomes one Puck component keyed by `kind`; its render delegates to
 * the block's actual React component so the admin preview and the
 * public site share the exact same output.
 *
 * Pass `availableEntities` to filter content blocks whose `supports` has no
 * overlap with what's installed.
 */
export function buildPuckConfig(
  blocks: BlockDefinition[],
  options: BuildPuckConfigOptions = {},
): PuckConfig {
  const components: Record<string, PuckComponentConfig> = {};
  const categories: Record<string, { title?: string; components: string[] }> = {};

  const eligible = filterBlocksBySupports(blocks, options.availableEntities);

  for (const block of eligible) {
    const fields: Record<string, PuckField> = {};
    for (const [key, spec] of Object.entries(block.fields)) {
      fields[key] = toPuckField(spec);
    }
    const vField = variantField(block);
    if (vField) fields.variant = vField;

    const dataSourceField = dataSourcePickerField(block, options.availableEntities);
    if (dataSourceField) fields.dataSource = dataSourceField;

    const Component = block.component;

    components[block.kind] = {
      label: block.name,
      fields,
      defaultProps: block.defaultVariant ? { variant: block.defaultVariant } : undefined,
      render: (props) => {
        const { variant, dataSource: _ds, ...rest } = props as Record<string, unknown> & {
          variant?: string;
          dataSource?: DataSource | null;
        };
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

/**
 * Returns a Puck custom field rendering the DataSourcePicker, scoped to the
 * intersection of `block.supports` and `availableEntities`. Returns null
 * when the block doesn't declare `supports` (static-only blocks have nothing
 * to pick from), so the field never appears for blocks like Hero.
 */
function dataSourcePickerField(
  block: BlockDefinition,
  availableEntities: string[] | undefined,
): PuckField | null {
  const supports = block.supports;
  if (!supports || supports.length === 0) return null;

  const allowed = availableEntities
    ? supports.filter((s) => availableEntities.includes(s))
    : supports;

  const entities = allowed.map((slug) => ({ slug }));

  return {
    type: 'custom',
    label: 'Data',
    render: ({ value, onChange }) =>
      createElement(DataSourcePicker, {
        value: (value ?? null) as DataSource | null,
        onChange: onChange as (next: DataSource | null) => void,
        availableEntities: entities,
      }),
  };
}

// ─── Serialization between Section rows and Puck Data ────────────────

export function sectionsToPuckData(sections: PuckSectionInput[]): PuckData {
  const ordered = [...sections].sort((a, b) => a.order - b.order);
  return {
    content: ordered.map((s) => ({
      type: s.blockKind,
      props: {
        id: s.id,
        ...(s.variant ? { variant: s.variant } : {}),
        ...(s.dataSource ? { dataSource: s.dataSource } : {}),
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
  dataSource: DataSource | null;
}

/**
 * Project a Puck `Data` object back to the Section shape the API expects.
 * Splits `props` into the known discriminators (id, variant, dataSource)
 * and the remaining `customFields` blob.
 */
export function puckDataToSections(data: PuckData): SectionDraft[] {
  return data.content.map((item, order) => {
    const { id, variant, dataSource, ...rest } = item.props as Record<string, unknown> & {
      id?: unknown;
      variant?: unknown;
      dataSource?: unknown;
    };
    return {
      id: typeof id === 'string' ? id : `tmp-${order}`,
      order,
      blockKind: item.type,
      variant: typeof variant === 'string' ? variant : null,
      customFields: rest,
      dataSource: isDataSource(dataSource) ? dataSource : null,
    };
  });
}

/** Narrow guard — used during deserialization to keep typed payloads safe. */
function isDataSource(value: unknown): value is DataSource {
  if (typeof value !== 'object' || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'static' || kind === 'entity-query' || kind === 'entity-ids';
}
