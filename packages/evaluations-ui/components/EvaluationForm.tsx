import { useMemo, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, FormTextarea, FormSelect } from '@packages/ui';
import { useEvaluationTemplates } from '../hooks';
import type { EvaluationTemplate, EvaluationWithScores } from '../types';
import { StarRating } from './StarRating';

interface EvaluationFormProps {
  entityType: string;
  entityId: string;
  onSubmit: (data: EvaluationFormValues) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  /** Pre-fill for editing an existing evaluation */
  editingEvaluation?: EvaluationWithScores;
}

export interface EvaluationFormValues {
  templateId: string;
  overallRating: number;
  comment: string;
  scores: { criteriaName: string; score: number; note: string }[];
}

function buildSchema(template: EvaluationTemplate | null) {
  return z.object({
    templateId: z.string().min(1, 'Template is required'),
    overallRating: z.number().int().min(1, 'Overall rating is required').max(5),
    comment: z.string().max(65536).optional().default(''),
    scores: z.array(
      z.object({
        criteriaName: z.string(),
        score: z.number().int().min(1, 'Rating is required').max(5),
        note: z.string().max(2000).optional().default(''),
      }),
    ).length(template?.criteria.length ?? 0),
  });
}

export function EvaluationForm({
  entityType,
  entityId,
  onSubmit,
  onCancel,
  isSubmitting,
  editingEvaluation,
}: EvaluationFormProps) {
  const { data: templatesData, isLoading: templatesLoading } = useEvaluationTemplates(entityType);
  const templates = templatesData?.data ?? [];

  // Auto-select template if only one exists, or use editing evaluation's template
  const defaultTemplateId = editingEvaluation?.templateId ?? (templates.length === 1 ? templates[0].id : '');
  const selectedTemplate = templates.find((t) => t.id === defaultTemplateId) ?? null;

  const schema = useMemo(() => buildSchema(selectedTemplate), [selectedTemplate]);

  const methods = useForm<EvaluationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      templateId: defaultTemplateId,
      overallRating: editingEvaluation?.overallRating ?? 0,
      comment: editingEvaluation?.comment ?? '',
      scores: selectedTemplate?.criteria.map((c) => {
        const existing = editingEvaluation?.scores.find((s) => s.criteriaName === c.name);
        return {
          criteriaName: c.name,
          score: existing?.score ?? 0,
          note: existing?.note ?? '',
        };
      }) ?? [],
    },
  });

  const { watch, setValue, reset } = methods;
  const watchedTemplateId = watch('templateId');
  const currentTemplate = templates.find((t) => t.id === watchedTemplateId) ?? null;

  // When template changes, reset scores to match new template criteria
  useEffect(() => {
    if (currentTemplate) {
      const currentScores = methods.getValues('scores');
      const newScores = currentTemplate.criteria.map((c) => {
        const existing = currentScores.find((s) => s.criteriaName === c.name);
        return {
          criteriaName: c.name,
          score: existing?.score ?? 0,
          note: existing?.note ?? '',
        };
      });
      setValue('scores', newScores);
    }
  }, [watchedTemplateId, currentTemplate, setValue, methods]);

  // Reset form when editingEvaluation changes
  useEffect(() => {
    if (editingEvaluation && selectedTemplate) {
      reset({
        templateId: editingEvaluation.templateId,
        overallRating: editingEvaluation.overallRating,
        comment: editingEvaluation.comment ?? '',
        scores: selectedTemplate.criteria.map((c) => {
          const existing = editingEvaluation.scores.find((s) => s.criteriaName === c.name);
          return {
            criteriaName: c.name,
            score: existing?.score ?? 0,
            note: existing?.note ?? '',
          };
        }),
      });
    }
  }, [editingEvaluation, selectedTemplate, reset]);

  if (templatesLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-10 rounded bg-muted" />
        <div className="h-20 rounded bg-muted" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No evaluation templates configured for this entity type.
      </p>
    );
  }

  const handleSubmit = methods.handleSubmit((data) => {
    onSubmit(data);
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
        {/* Template selector (hidden if only one) */}
        {templates.length > 1 && (
          <FormSelect
            name="templateId"
            label="Evaluation Template"
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
          />
        )}

        {/* Criteria scores */}
        {currentTemplate && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Criteria</p>
            {currentTemplate.criteria.map((criterion, index) => {
              const scoreValue = watch(`scores.${index}.score`);
              return (
                <div key={criterion.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm">{criterion.name}</span>
                      {criterion.description && (
                        <p className="text-xs text-muted-foreground">{criterion.description}</p>
                      )}
                    </div>
                    <StarRating
                      value={scoreValue}
                      onChange={(v) => setValue(`scores.${index}.score`, v, { shouldValidate: true })}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Optional note..."
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    {...methods.register(`scores.${index}.note`)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Overall rating */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Overall Rating</p>
          <StarRating
            value={watch('overallRating')}
            onChange={(v) => setValue('overallRating', v, { shouldValidate: true })}
            size="lg"
          />
          {methods.formState.errors.overallRating && (
            <p className="text-sm text-destructive">
              {methods.formState.errors.overallRating.message}
            </p>
          )}
        </div>

        {/* Comment */}
        <FormTextarea
          name="comment"
          label="Comment"
          placeholder="Add any additional comments..."
        />

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : editingEvaluation ? 'Update' : 'Submit'}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
