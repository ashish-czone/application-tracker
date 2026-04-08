import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Check, ChevronDown } from 'lucide-react';
import { Form, Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@packages/ui';
import { DynamicField, buildFormSchema } from '@packages/eav-attributes-ui';
import { useFormDrafts, DraftRecoveryBanner, DraftStatusIndicator } from '@packages/drafts-ui';
import type { LayoutSection, FullLayoutField } from '@packages/entity-engine/types';
import { useEntityEngine, useEntityHooks, useEntityConfig } from '../EntityEngineProvider';
import { useEntityLayout } from '../helpers/useEntityLayout';

interface EntityCreatePageProps {
  entityType: string;
}

/**
 * Full-page create form for entities with createMode: 'page' or 'wizard'.
 * - 'page': all sections on one page
 * - 'wizard': one section per step with Next/Back/Submit navigation
 */
export function EntityCreatePage({ entityType }: EntityCreatePageProps) {
  const navigate = useNavigate();
  const entity = useEntityConfig(entityType);
  const hooks = useEntityHooks(entityType);
  const { apiFn } = useEntityEngine();
  const { data: layout, isLoading: layoutLoading } = useEntityLayout(entityType);

  const isWizard = entity.ui.createMode === 'wizard';
  const [currentStep, setCurrentStep] = useState(0);

  // Filter sections with editable fields
  const steps = useMemo(() => {
    if (!layout) return [];
    return layout.sections
      .map((s) => ({
        ...s,
        editableFields: s.fields.filter((f) => !f.isReadonly && f.fieldType !== 'auto_number'),
      }))
      .filter((s) => s.editableFields.length > 0);
  }, [layout]);

  // All editable fields across all sections
  const editableFields = useMemo(() => {
    return steps.flatMap((s) => s.editableFields);
  }, [steps]);

  // Async search callbacks
  const searchUsers = useCallback(async (query: string) => {
    const res = await apiFn.get<{ data: { id: string; firstName: string; lastName: string }[] }>(`/users?search=${encodeURIComponent(query)}&limit=20`);
    return res.data.map((u) => ({ label: `${u.firstName} ${u.lastName}`.trim(), value: u.id }));
  }, [apiFn]);

  const searchLookup = useCallback(async (entity: string, query: string) => {
    return apiFn.get<{ label: string; value: string }[]>(`/lookups/${entity}?search=${encodeURIComponent(query)}&limit=20`);
  }, [apiFn]);

  const searchTags = useCallback(async (groupSlug: string, query: string) => {
    return apiFn.get<{ label: string; value: string; color?: string }[]>(
      `/tags/group/${groupSlug}?search=${encodeURIComponent(query)}&limit=20`,
    );
  }, [apiFn]);

  const schema = useMemo(() => buildFormSchema(editableFields), [editableFields]);

  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    for (const field of editableFields) {
      defaults[field.fieldKey] = field.defaultValue ?? '';
    }
    return defaults;
  }, [editableFields]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // --- Drafts integration ---
  const drafts = useFormDrafts({
    entityType,
    draftKey: 'new',
    formValues: form.watch(),
    onRestore: (data) => form.reset(data),
    enabled: editableFields.length > 0,
  });

  const createMutation = hooks.useCreate({
    onSuccess: (created) => {
      drafts.cleanup();
      navigate(`/${entity.slug}/${created.id}`);
    },
  });

  function onSubmit(data: Record<string, unknown>) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== '' && val !== undefined) {
        cleaned[key] = val;
      }
    }
    createMutation.mutate(cleaned);
  }

  // Wizard has N section steps + 1 review step
  const totalSteps = isWizard ? steps.length + 1 : steps.length;
  const isReviewStep = isWizard && currentStep === steps.length;
  const isLastSectionStep = isWizard && currentStep === steps.length - 1;

  // Wizard: validate current step fields before advancing
  async function handleNext() {
    if (isReviewStep) return;
    const stepFields = steps[currentStep]?.editableFields ?? [];
    const fieldKeys = stepFields.map((f) => f.fieldKey);
    const isValid = await form.trigger(fieldKeys);
    if (isValid) setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
  }

  function handleBack() {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }

  if (layoutLoading) {
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

  const isLastStep = currentStep === totalSteps - 1;

  function renderSection(step: typeof steps[number]) {
    return (
      <div key={step.id} className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="text-sm font-medium text-foreground">{step.name}</h2>
        </div>
        <div
          className="grid gap-4 p-4"
          style={{ gridTemplateColumns: step.columns === 1 ? '1fr' : 'repeat(2, 1fr)' }}
        >
          {step.editableFields.map((field: FullLayoutField) => (
            <DynamicField
              key={field.fieldKey}
              field={field}
              mode="edit"
              onSearch={
                field.fieldType === 'user' ? searchUsers
                : field.fieldType === 'lookup' && field.lookupEntity ? (q: string) => searchLookup(field.lookupEntity!, q)
                : undefined
              }
              onChipSearch={
                field.fieldType === 'multi_user' ? searchUsers
                : (field.fieldType === 'multi_lookup') && field.lookupEntity ? (q: string) => searchLookup(field.lookupEntity!, q)
                : field.fieldType === 'tags' && field.tagGroupSlug ? (q: string) => searchTags(field.tagGroupSlug!, q)
                : undefined
              }
            />
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
          onClick={() => navigate(`/${entity.slug}`)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Back to list"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-foreground">Create {entity.singularName}</h1>
            <DraftStatusIndicator {...drafts.statusProps} />
          </div>
          <p className="text-sm text-muted-foreground">
            {isWizard
              ? isReviewStep ? 'Review your details before saving' : `Step ${currentStep + 1} of ${totalSteps}`
              : 'Fill in the details below'}
          </p>
        </div>
      </div>

      {/* Wizard step indicator */}
      {isWizard && steps.length > 0 && (
        <nav className="mb-6">
          <ol className="flex items-center gap-2">
            {[...steps.map((s) => s.name), 'Review'].map((label, i) => {
              const isActive = i === currentStep;
              const isComplete = i < currentStep;
              return (
                <li key={label} className="flex items-center gap-2">
                  {i > 0 && <div className={`h-px w-6 ${isComplete ? 'bg-primary' : 'bg-border'}`} />}
                  <button
                    type="button"
                    onClick={() => i < currentStep && setCurrentStep(i)}
                    disabled={i > currentStep}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : isComplete
                          ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isComplete && <Check className="h-3 w-3" />}
                    {label}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {drafts.bannerProps && (
        <div className="mb-4">
          <DraftRecoveryBanner {...drafts.bannerProps} />
        </div>
      )}

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)}>
        {isWizard ? (
          isReviewStep ? (
            // Wizard review: all sections read-only
            <div className="space-y-6">
              {steps.map((step) => (
                <div key={step.id} className="rounded-lg border border-border bg-card">
                  <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                    <h2 className="text-sm font-medium text-foreground">{step.name}</h2>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(steps.indexOf(step))}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <div
                    className="grid gap-4 p-4"
                    style={{ gridTemplateColumns: step.columns === 1 ? '1fr' : 'repeat(2, 1fr)' }}
                  >
                    {step.editableFields.map((field) => {
                      const val = form.getValues(field.fieldKey);
                      return (
                        <DynamicField
                          key={field.fieldKey}
                          field={field}
                          mode="view"
                          value={val === '' ? null : val}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Wizard: show only current step
            steps[currentStep] && renderSection(steps[currentStep])
          )
        ) : (
          // Page: show all sections
          <div className="space-y-8">
            {steps.map((step) => renderSection(step))}
          </div>
        )}

        {createMutation.isError && (
          <p className="text-sm text-destructive mt-4" aria-live="polite">
            {(createMutation.error as any)?.body?.message || `Failed to create ${entity.singularName.toLowerCase()}.`}
          </p>
        )}

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <div>
            {isWizard && currentStep > 0 && (
              <Button type="button" variant="outline" onClick={handleBack}>
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(`/${entity.slug}`)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            {isWizard && !isLastStep ? (
              <Button type="button" onClick={handleNext}>
                Next
              </Button>
            ) : (
              <div className="inline-flex items-center rounded-md">
                <Button type="submit" disabled={createMutation.isPending} className="rounded-r-none">
                  {createMutation.isPending ? 'Creating...' : 'Save'}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      disabled={createMutation.isPending}
                      className="rounded-l-none border-l border-primary-foreground/20 px-2"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={drafts.saveAsDraft}>
                      Save as Draft
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </Form>
    </div>
  );
}
