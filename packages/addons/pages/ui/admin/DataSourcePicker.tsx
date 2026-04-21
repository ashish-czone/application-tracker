import { useId, useMemo } from 'react';
import { Combobox, Input, RadioGroup, RadioGroupItem, Label } from '@packages/ui';
import type { DataSource } from '@packages/blocks-contract';

export interface DataSourcePickerEntity {
  /** Entity slug (matches `defineEntity` slug). Used as `dataSource.entity`. */
  slug: string;
  /** Human-friendly label rendered in the entity picker. Defaults to slug. */
  label?: string;
}

export interface DataSourcePickerProps {
  value: DataSource | null | undefined;
  onChange: (next: DataSource | null) => void;
  /**
   * Entities the surrounding block declares as renderable. Filters the
   * entity dropdown — empty array means no entity is available, so the
   * picker locks to `static` and shows a helpful empty hint.
   */
  availableEntities: DataSourcePickerEntity[];
  /** Disable the whole control (e.g. when section is being saved). */
  disabled?: boolean;
}

const KIND_OPTIONS: Array<{ value: DataSource['kind']; label: string; help: string }> = [
  { value: 'static', label: 'Static', help: 'Block renders only from author-entered fields.' },
  { value: 'entity-query', label: 'Records query', help: 'Pull top-N records from an entity by sort + filter.' },
];

/**
 * Pure transition between kinds. Preserves entity/sort/limit when moving
 * inside the entity-query branch and falls back to the first available entity
 * when crossing in from `static`. If the user picks `entity-query` but no
 * entities are available the transition is suppressed (returns `static`) so
 * the picker never lands in an unselectable state.
 */
export function transitionKind(
  current: DataSource,
  nextKind: DataSource['kind'],
  availableEntities: DataSourcePickerEntity[],
): DataSource {
  if (nextKind === 'static') return { kind: 'static' };
  if (nextKind === 'entity-query') {
    const entity =
      current.kind !== 'static' ? current.entity : availableEntities[0]?.slug;
    if (!entity) return { kind: 'static' };
    return {
      kind: 'entity-query',
      entity,
      sort: current.kind === 'entity-query' ? current.sort : undefined,
      limit: current.kind === 'entity-query' ? current.limit : 10,
    };
  }
  return current;
}

/**
 * Inline editor for `DataSource`. Two kinds for v1:
 *
 * - `static`  — block renders only from its `customFields`
 * - `entity-query` — engine pulls records by sort + limit (filter wired via
 *   raw JSON for now; a structured filter builder is a future iteration)
 *
 * `entity-ids` (hand-pick records) intentionally omitted — it requires a
 * per-entity record search picker that would balloon the v1 scope.
 */
export function DataSourcePicker({
  value,
  onChange,
  availableEntities,
  disabled,
}: DataSourcePickerProps) {
  const kindGroupId = useId();
  const limitId = useId();
  const sortId = useId();

  const ds = value ?? { kind: 'static' };
  const entityOptions = useMemo(
    () => availableEntities.map((e) => ({ value: e.slug, label: e.label ?? e.slug })),
    [availableEntities],
  );

  function setKind(nextKind: DataSource['kind']) {
    onChange(transitionKind(ds, nextKind, availableEntities));
  }

  function patchEntityQuery(patch: Partial<Extract<DataSource, { kind: 'entity-query' }>>) {
    if (ds.kind !== 'entity-query') return;
    onChange({ ...ds, ...patch });
  }

  const noEntities = availableEntities.length === 0;

  return (
    <div className="space-y-4 rounded-md border border-border bg-card p-4">
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Data source
        </Label>
        <RadioGroup
          value={ds.kind}
          onValueChange={(v) => setKind(v as DataSource['kind'])}
          disabled={disabled}
        >
          {KIND_OPTIONS.map((opt) => {
            const id = `${kindGroupId}-${opt.value}`;
            const lockedOut = opt.value === 'entity-query' && noEntities;
            return (
              <div key={opt.value} className="flex items-start gap-2">
                <RadioGroupItem id={id} value={opt.value} disabled={disabled || lockedOut} />
                <div className="grid gap-0.5 leading-none">
                  <Label htmlFor={id} className="cursor-pointer text-sm">
                    {opt.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{opt.help}</p>
                </div>
              </div>
            );
          })}
        </RadioGroup>
        {noEntities && (
          <p className="text-xs text-muted-foreground">
            This block has no compatible entities registered, so only static rendering is available.
          </p>
        )}
      </div>

      {ds.kind === 'entity-query' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Entity</Label>
            <Combobox
              value={ds.entity}
              onChange={(v) => patchEntityQuery({ entity: v })}
              options={entityOptions}
              placeholder="Select entity…"
              disabled={disabled}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={limitId} className="text-xs">
                Limit
              </Label>
              <Input
                id={limitId}
                type="number"
                min={1}
                value={ds.limit ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  patchEntityQuery({ limit: raw === '' ? undefined : Number(raw) });
                }}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={sortId} className="text-xs">
                Sort
              </Label>
              <Input
                id={sortId}
                type="text"
                placeholder="e.g. -createdAt"
                value={ds.sort ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  patchEntityQuery({ sort: raw === '' ? undefined : raw });
                }}
                disabled={disabled}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Prefix sort with <code className="rounded bg-muted px-1 py-0.5">-</code> for descending
            order. Filters are inherited from the entity's defaults; the structured filter builder
            will land in a follow-up.
          </p>
        </div>
      )}
    </div>
  );
}
