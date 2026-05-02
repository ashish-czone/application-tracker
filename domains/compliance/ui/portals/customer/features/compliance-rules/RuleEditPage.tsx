import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useEntityEngine } from '@packages/entity-engine-ui';
import {
  EntityFormFields,
  buildFormSchema,
  flattenFormFields,
  type FormFieldOverride,
  type LookupSearchFn,
} from '@packages/entity-views-ui';
import { InactiveStateBanner } from '../../../../components';
import {
  rulesQueries,
  useRuleEditConstraints,
  useUpdateComplianceRule,
} from '../../../../hooks/useComplianceRulesApi';
import { RULES_FORM_LAYOUT } from '../../../../entity-configs/rules.form-layout';

const ENTITY_SLUG = 'compliance-rules';
const IMMUTABLE_IDENTITY_FIELDS = ['code', 'frequency', 'lawId'] as const;
const FORWARD_ONLY_MATH_FIELDS = ['dueDayOfMonth', 'dueMonthOffset', 'gracePeriodDays'] as const;

/**
 * I15: custom edit page for compliance rules. Now consumes the static
 * `RULES_FORM_LAYOUT` (post form-primitive migration); previously fetched
 * `GET /layouts/compliance-rules` at runtime. Domain behaviour unchanged:
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
 *      than a generic update — keeps the compliance-rules URL family
 *      (preview / deprecate / constraints / update) on one root.
 */
export function RuleEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { apiFn } = useEntityEngine();
  const queryClient = useQueryClient();
  const { data: row, isLoading: rowLoading } = useQuery(rulesQueries(apiFn).detail(id));
  const { data: constraints, isLoading: constraintsLoading } = useRuleEditConstraints(id);

  const locked = constraints?.hasGeneratedFilings === true;
  const filingCount = constraints?.generatedFilingCount ?? 0;

  const editableFields = useMemo(() => flattenFormFields(RULES_FORM_LAYOUT), []);
  const schema = useMemo(
    () => buildFormSchema(editableFields, RULES_FORM_LAYOUT.entity),
    [editableFields],
  );

  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    for (const field of editableFields) {
      const raw = (row as Record<string, unknown> | undefined)?.[field.fieldKey];
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
      navigate(`/${ENTITY_SLUG}/${id}`);
    },
  });

  // Lookup-search wrapper. Reuses the same fetchQuery shape the previous
  // useEntityLayout-driven path used: identical (entity, query) pairs are
  // deduped while in flight, recent results stay in cache for 30s.
  const lookupSearch: LookupSearchFn = (entityName, query) =>
    queryClient.fetchQuery({
      queryKey: ['rule-edit-lookup', entityName, query],
      queryFn: () =>
        apiFn.get<{ label: string; value: string }[]>(
          `/lookups/${entityName}?search=${encodeURIComponent(query)}&limit=20`,
        ),
      staleTime: 30_000,
    });

  // I15: build per-field override map for the immutable identity fields
  // when the rule has generated filings. The server-side guard (I14) is
  // still the backstop; this is purely a UX affordance.
  const fieldOverrides = useMemo<Record<string, FormFieldOverride> | undefined>(() => {
    if (!locked) return undefined;
    const map: Record<string, FormFieldOverride> = {};
    for (const key of IMMUTABLE_IDENTITY_FIELDS) {
      const fieldLabel = editableFields.find((f) => f.fieldKey === key)?.label ?? key;
      map[key] = {
        disabled: true,
        disabledTooltip: `Cannot change — this rule has generated ${filingCount} filing${
          filingCount === 1 ? '' : 's'
        }. Deprecate this rule and create a new one to change ${fieldLabel}.`,
      };
    }
    return map;
  }, [locked, filingCount, editableFields]);

  function hasTouchedMath(data: Record<string, unknown>): boolean {
    if (!row) return false;
    return FORWARD_ONLY_MATH_FIELDS.some((k) => {
      const next = data[k];
      const current = (row as Record<string, unknown>)[k];
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

  const loading = rowLoading || constraintsLoading;

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

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(`/${ENTITY_SLUG}/${id}`)}
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

      {(row as Record<string, unknown> | undefined)?.status === 'deprecated' && (
        <InactiveStateBanner kind="deprecated" />
      )}

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
        <EntityFormFields
          layout={RULES_FORM_LAYOUT}
          fieldOverrides={fieldOverrides}
          lookupSearch={lookupSearch}
        />

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
            onClick={() => navigate(`/${ENTITY_SLUG}/${id}`)}
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
