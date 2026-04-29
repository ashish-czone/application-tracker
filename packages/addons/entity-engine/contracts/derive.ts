import type { FieldDef, FieldMap } from './field';

/**
 * Base columns every entity row carries. Compose with EntityRow<T> via
 * intersection (`Row & BaseEntityRow`). Timestamps are ISO strings on the
 * wire per data-formatting.md rules.
 */
export interface BaseEntityRow {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/** Extra columns present when the entity has softDelete enabled. */
export interface SoftDeletableRow {
  deletedAt: string | null;
  deletedBy: string | null;
}

export interface FileValue {
  id: string;
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

type StringLikeType =
  | 'text'
  | 'email'
  | 'phone'
  | 'url'
  | 'textarea'
  | 'rich_text'
  | 'auto_number'
  | 'lookup'
  | 'user'
  | 'category'
  | 'belongsTo';

type NumberLikeType = 'number' | 'currency' | 'decimal';

type DateLikeType = 'date' | 'datetime';

type MultiScalarType = 'multi_lookup' | 'multi_user' | 'tags';

type RelationType = 'hasOne' | 'hasMany' | 'manyToMany';

/**
 * Base value type derived from a field's `type`.
 *
 * picklist / multi_select / workflow fall through to the permissive
 * string / string[] shape here. Consumers get exact literal unions by
 * declaring their own enums (e.g. `TaskStatus`) and intersecting with
 * Omit<EntityRow<...>, 'status'> — see tasks/contracts for the pattern.
 * Keeping the derivation non-magical avoids `as const` + readonly array
 * churn across the api boundary.
 */
type BaseFieldValue<F extends FieldDef> =
  F['type'] extends StringLikeType
    ? string
    : F['type'] extends NumberLikeType
      ? number
      : F['type'] extends 'boolean'
        ? boolean
        : F['type'] extends DateLikeType
          ? string
          : F['type'] extends 'picklist'
            ? string
            : F['type'] extends 'multi_select'
              ? string[]
              : F['type'] extends MultiScalarType
                ? string[]
                : F['type'] extends 'file'
                  ? FileValue | null
                  : F['type'] extends 'workflow'
                    ? string
                    : F['type'] extends RelationType
                      ? never
                      : unknown;

/** Nullable when the field is not `required: true`. */
type FieldValue<F extends FieldDef> = F extends { required: true }
  ? BaseFieldValue<F>
  : BaseFieldValue<F> | null;

/** Field keys that materialise as columns on the row (excludes has-many / many-to-many). */
type RowKeys<T extends FieldMap> = {
  [K in keyof T]: T[K]['type'] extends RelationType ? never : K;
}[keyof T];

/**
 * Typed row shape for an entity, derived from its field map.
 *
 * ```ts
 * type Task = EntityRow<typeof TASKS_FIELDS> & BaseEntityRow & SoftDeletableRow;
 * ```
 */
export type EntityRow<T extends FieldMap> = {
  [K in RowKeys<T>]: FieldValue<T[K]>;
};

/** Field keys that can be set via create/update (excludes system, readonly, relations). */
type WritableKeys<T extends FieldMap> = {
  [K in keyof T]: T[K] extends { system: true }
    ? never
    : T[K] extends { readonly: true }
      ? never
      : T[K]['type'] extends RelationType
        ? never
        : K;
}[keyof T];

type RequiredWritableKeys<T extends FieldMap> = {
  [K in WritableKeys<T>]: T[K] extends { required: true } ? K : never;
}[WritableKeys<T>];

type OptionalWritableKeys<T extends FieldMap> = {
  [K in WritableKeys<T>]: T[K] extends { required: true } ? never : K;
}[WritableKeys<T>];

/** Payload accepted by POST /{slug}. Required writable keys are required, rest optional. */
export type EntityCreateInput<T extends FieldMap> = {
  [K in RequiredWritableKeys<T>]: BaseFieldValue<T[K]>;
} & {
  [K in OptionalWritableKeys<T>]?: BaseFieldValue<T[K]> | null;
};

/** Payload accepted by PATCH /{slug}/:id. All writable fields optional. */
export type EntityUpdateInput<T extends FieldMap> = Partial<EntityCreateInput<T>>;
