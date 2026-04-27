import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Info, Loader2 } from 'lucide-react';
import {
  Form,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@packages/ui';
import { DynamicField, buildFormSchema } from '@packages/eav-attributes-ui';
import type { FieldDefinition } from '@packages/eav-attributes-ui';
import {
  useEntityEngine,
  useEntityHooks,
  useEntityConfig,
  useEntityLayout,
} from '@packages/entity-engine-ui';
import { InactiveStateBanner } from '../../../../../components';
import {
  useRuleEditConstraints,
  useUpdateComplianceRule,
} from './api/useComplianceRulesApi';

const ENTITY_TYPE = 'compliance-rules';
const IMMUTABLE_IDENTITY_FIELDS = ['code', 'frequency', 'lawId'] as const;
const FORWARD_ONLY_MATH_FIELDS = ['dueDayOfMonth', 'dueMonthOffset', 'gracePeriodDays'] as const;

type ImmutableField = (typeof IMMUTABLE_IDENTITY_FIELDS)[number];

/**
 * I15: custom edit page for compliance rules. Mirrors `EntityEditPage` for
 * layout + form wiring, but diverges where Q9 demands rule-specific UX:
 *
 *   1. Fetches `/compliance-rules/:id/edit-constraints` up front. When the
 *      rule has generated filings, `code`/`frequency`/`lawId` render
 *      disabled with a tooltip explaining why. Writing through I14's
 *      server-side guard is still the backstop — a power user with devtools
 *      can't bypass the server.
 *   2. On save, checks whether any of the three due-date-math fields
 *      changed against the loaded row. If so and filings exist, intercepts
 *      the mutation and surfaces a forward-only confirm dialog first.
 *   3. PATCHes via `useUpdateComplianceRule` (the domain controller) rather
 *      than the generic `hooks.useUpdate`. Keeps the compliance-rules URL
 *      family (preview / deprecate / constraints / update) on one root.
 */
export function RuleEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const entity = useEntityConfig(ENTITY_TYPE);
  const hooks = useEntityHooks(ENTITY_TYPE);
  const { apiFn } = useEntityEngine();
  const { data: layout, isLoading: layoutLoading } = useEntityLayout(ENTITY_TYPE);
  const { data: row, isLoading: rowLoading } = hooks.useDetail(id);
  const { data: constraints, isLoading: constraintsLoading } = useRuleEditConstraints(id);

  const locked = constraints?.hasGeneratedFilings === true;
  const filingCount = constraints?.generatedFilingCount ?? 0;

  const sections = useMemo(() => {
    if (!layout) return [];
    return layout.sections
      .filter((s) => s.id !== '__unassigned__')
      .map((s) => ({
        ...s,
        editableFields: s.fields.filter(
          (f) => !f.isReadonly && f.fieldType !== 'auto_number',
        ),
      }))
      .filter((s) => s.editableFields.length > 0);
  }, [layout]);

  const editableFields = useMemo(
    () => sections.flatMap((s) => s.editableFields),
    [sections],
  );

  const searchLookup = useCallback(
    async (entityName: string, query: string) => {
      return apiFn.get<{ label: string; value: string }[]>(
        `/lookups/${entityName}?search=${encodeURIComponent(query)}&limit=20`,
      );
    },
    [apiFn],
  );

  const schema = useMemo(() => buildFormSchema(editableFields), [editableFields]);

  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    for (const field of editableFields) {
      const raw = row?.[field.fieldKey];
      defaults[field.fieldKey] = raw ?? field.defaultValue ?? '';
    }
    return defaults;
  }, [editableFields, row]);

  const form = useForm({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (row) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row]);

  const [pendingData, setPendingData] = useState<Record<string, unknown> | null>(null);

  const updateMutation = useUpdateComplianceRule({
    onSuccess: () => {
      setPendingData(null);
      navigate(`/${entity.slug}/${id}`);
    },
  });

  function hasTouchedMath(data: Record<string, unknown>): boolean {
    if (!row) return false;
    return FORWARD_ONLY_MATH_FIELDS.some((k) => {
      const next = data[k];
      const current = row[k];
      return next !== undefined && String(next) !== String(current);
    });
  }

  function submitDirect(data: Record<string, unknown>) {
    if (!id) return;
    const payload = pickAllowedFields(data);
    updateMutation.mutate({ ruleId: id, data: payload });
  }

  function onSubmit(data: Record<string, unknown>) {
    if (!id) return;
    if (filingCount > 0 && hasTouchedMath(data)) {
      setPendingData(data);
      return;
    }
    submitDirect(data);
  }

  const loading = layoutLoading || rowLoading || constraintsLoading;

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted mt-2" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  function renderField(field: FieldDefinition) {
    const isImmutable = IMMUTABLE_IDENTITY_FIELDS.includes(field.fieldKey as ImmutableField);
    const disabled = locked && isImmutable;
    const tooltip = disabled
      ? `Cannot change — this rule has generated ${filingCount} filing${filingCount === 1 ? '' : 's'}. Deprecate this rule and create a new one to change ${field.label}.`
      : undefined;
    return (
      <DynamicField
        key={field.fieldKey}
        field={field}
        mode="edit"
        disabled={disabled}
        disabledTooltip={tooltip}
        onSearch={
          field.fieldType === 'lookup' && field.lookupEntity
            ? (q: string) => searchLookup(field.lookupEntity!, q)
            : undefined
        }
      />
    );
  }

  function renderSection(section: (typeof sections)[number]) {
    return (
      <div key={section.id} className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="text-sm font-medium text-foreground">{section.name}</h2>
        </div>
        <div
          className="grid gap-4 p-4"
          style={{ gridTemplateColumns: section.columns === 1 ? '1fr' : 'repeat(2, 1fr)' }}
        >
          {section.editableFields.map(renderField)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(`/${entity.slug}/${id}`)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Back to detail"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Edit Compliance Rule</h1>
          <p className="text-sm text-muted-foreground">
            {locked
              ? 'Some identity fields are locked because this rule already has filings.'
              : 'Update details below.'}
          </p>
        </div>
      </div>

      {row?.status === 'deprecated' && <InactiveStateBanner kind="deprecated" />}

      {locked && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>{filingCount}</strong> filing{filingCount === 1 ? '' : 's'} already generated
            for this rule. Code, frequency, and law are locked. Due-date math edits will apply
            only to filings generated from now on.
          </span>
        </div>
      )}

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-8">{sections.map(renderSection)}</div>

        {updateMutation.isError && (
          <p className="text-sm text-destructive mt-4" aria-live="polite">
            {(updateMutation.error as { body?: { message?: string } })?.body?.message ??
              'Failed to update rule.'}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/${entity.slug}/${id}`)}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </Form>

      <ForwardOnlyConfirmDialog
        open={pendingData !== null}
        onOpenChange={(o) => {
          if (!o) setPendingData(null);
        }}
        filingCount={filingCount}
        onConfirm={() => pendingData && submitDirect(pendingData)}
        isPending={updateMutation.isPending}
      />
    </div>
  );
}

function pickAllowedFields(data: Record<string, unknown>): Record<string, unknown> {
  const allowed: Record<string, unknown> = {};
  const keys = [
    'code', 'name', 'lawId', 'frequency',
    'dueDayOfMonth', 'dueMonthOffset', 'gracePeriodDays',
    'description',
  ] as const;
  for (const k of keys) {
    if (k in data && data[k] !== '' && data[k] !== undefined) {
      allowed[k] = data[k];
    }
  }
  return allowed;
}

interface ForwardOnlyConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filingCount: number;
  onConfirm: () => void;
  isPending: boolean;
}

function ForwardOnlyConfirmDialog({
  open,
  onOpenChange,
  filingCount,
  onConfirm,
  isPending,
}: ForwardOnlyConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Due-date math update</DialogTitle>
          <DialogDescription>
            You're changing how due dates are computed for this rule.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 text-sm text-foreground">
          This change will apply <strong>only to filings generated from now on</strong>.{' '}
          The <strong>{filingCount}</strong> filing{filingCount === 1 ? '' : 's'} already
          generated will keep {filingCount === 1 ? 'its' : 'their'} current due dates.
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
