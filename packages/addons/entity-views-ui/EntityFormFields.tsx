import { useMemo } from 'react';
import { DynamicField } from '@packages/eav-attributes-ui';
import type { FormFieldDefinition, FormLayoutDefinition, FormSectionDefinition } from './define-form-layout';
import { adaptFormFieldDefinition } from './helpers/build-form-schema';

/**
 * Per-field render-time override. Pages that need to disable specific
 * fields based on row state (e.g. "lock identity fields when filings
 * exist") pass overrides keyed by `fieldKey`. The renderer flips the
 * underlying `<DynamicField>`'s `disabled` + `disabledTooltip` props
 * accordingly.
 *
 * Only `disabled`/`disabledTooltip` are exposed today — extend the
 * shape when a real consumer needs more (e.g. per-field default value
 * override, custom render). Don't speculate.
 */
export interface FormFieldOverride {
  disabled?: boolean;
  disabledTooltip?: string;
}

/**
 * Async lookup-search callback. Pages provide one wrapper that knows how
 * to translate `(entityName, query)` into `apiFn.get('/lookups/...')` —
 * usually via `useQueryClient().fetchQuery` for de-dup and short-cache.
 * The renderer routes per-field by reading each `lookup`-typed field's
 * `lookupEntity` and binding it.
 */
export type LookupSearchFn = (
  entityName: string,
  query: string,
) => Promise<{ label: string; value: string }[]>;

interface EntityFormFieldsProps {
  layout: FormLayoutDefinition;
  /** Optional per-field overrides — keyed by `fieldKey`. */
  fieldOverrides?: Record<string, FormFieldOverride>;
  /**
   * Required when the layout contains `lookup` fields. The page wraps
   * its own apiFn + queryClient.fetchQuery here.
   */
  lookupSearch?: LookupSearchFn;
}

/**
 * Render a static form layout as React-Hook-Form-compatible inputs.
 *
 * Must be mounted inside a `<Form>` (from `@packages/ui`) — RHF context
 * is read by the underlying `<DynamicField>` widgets. The consumer owns
 * the `useForm` instance, the schema, the submit handler, and any chrome
 * outside the field grid (header, save buttons, dialogs).
 *
 * @example
 *   const schema = useMemo(() => buildFormSchema(flattenFormFields(LAYOUT)), []);
 *   const form = useForm({ resolver: zodResolver(schema), defaultValues });
 *   return (
 *     <Form form={form} onSubmit={form.handleSubmit(onSubmit)}>
 *       <EntityFormFields layout={LAYOUT} lookupSearch={searchLookup} />
 *       <Button type="submit">Save</Button>
 *     </Form>
 *   );
 */
export function EntityFormFields({ layout, fieldOverrides, lookupSearch }: EntityFormFieldsProps) {
  // Pre-adapt every field once per layout/overrides change. The adapted
  // shape is what `<DynamicField>` consumes; recomputing per render only
  // matters here, not inside the deeper render path.
  const adaptedSections = useMemo(
    () => layout.sections.map((section, sIdx) => ({
      section,
      fields: section.fields.map((field, fIdx) => ({
        original: field,
        adapted: adaptFormFieldDefinition(field, layout.entity, sIdx * 1000 + fIdx),
      })),
    })),
    [layout],
  );

  return (
    <div className="space-y-8">
      {adaptedSections.map(({ section, fields }, sIdx) => (
        <FormSection
          key={section.id ?? `${section.name}-${sIdx}`}
          section={section}
          fields={fields}
          fieldOverrides={fieldOverrides}
          lookupSearch={lookupSearch}
        />
      ))}
    </div>
  );
}

interface FormSectionProps {
  section: FormSectionDefinition;
  fields: { original: FormFieldDefinition; adapted: ReturnType<typeof adaptFormFieldDefinition> }[];
  fieldOverrides?: Record<string, FormFieldOverride>;
  lookupSearch?: LookupSearchFn;
}

function FormSection({ section, fields, fieldOverrides, lookupSearch }: FormSectionProps) {
  const columns = section.columns ?? 2;
  return (
    <div className="rounded-md border border-rule bg-paper">
      <div className="border-b border-rule bg-paper-raised/30 px-4 py-3">
        <h2 className="text-sm font-medium text-ink">{section.name}</h2>
      </div>
      <div
        className="grid gap-4 p-4"
        style={{ gridTemplateColumns: columns === 1 ? '1fr' : 'repeat(2, 1fr)' }}
      >
        {fields.map(({ original, adapted }) => {
          const override = fieldOverrides?.[original.fieldKey];
          const onSearch =
            original.fieldType === 'lookup' && original.lookupEntity && lookupSearch
              ? (q: string) => lookupSearch(original.lookupEntity!, q)
              : undefined;
          return (
            <DynamicField
              key={original.fieldKey}
              field={adapted}
              mode="edit"
              disabled={override?.disabled}
              disabledTooltip={override?.disabledTooltip}
              onSearch={onSearch}
            />
          );
        })}
      </div>
    </div>
  );
}
