import { useMemo, useState } from 'react';
import { Badge } from '@packages/ui';
import { useEntityConfig } from '@packages/entity-engine-ui';
import { PipelineStageManager } from './PipelineStageManager';
import { useWorkflows, useCreateWorkflow } from '../hooks';
import { readWorkflowFeature } from '../feature';

/**
 * The Pipeline sub-tab inside the entity-config admin page. Registered
 * by the workflowsWeb manifest as an `entityConfigTabs` entry.
 *
 * Rendered when the host entity has the workflow feature configured.
 * If no workflow record exists yet, the tab renders nothing — workflow
 * creation lives on the `/workflows` admin route (also from this addon).
 */
export function WorkflowPipelineTab({ entityType }: { entityType: string }) {
  const entity = useEntityConfig(entityType);
  const { data: workflows } = useWorkflows();
  const createWorkflow = useCreateWorkflow();

  const entityWorkflows = useMemo(
    () => (workflows ?? []).filter((w) => w.entityType === entityType && w.isActive),
    [workflows, entityType],
  );

  const workflowFeature = readWorkflowFeature(entity.features);
  const discriminator = workflowFeature?.discriminator ?? null;

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const activeWorkflow = selectedSlug
    ? entityWorkflows.find((w) => w.slug === selectedSlug) ?? entityWorkflows[0]
    : entityWorkflows[0];

  function handleCreatePipeline(discriminatorValue: string) {
    if (!activeWorkflow || !discriminator) return;
    const option = discriminator.options.find((o) => o.value === discriminatorValue);
    const slug = `${activeWorkflow.slug}-${discriminatorValue.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    createWorkflow.mutate({
      slug,
      name: `${option?.label ?? discriminatorValue} Pipeline`,
      entityType,
      fieldName: discriminator.fieldName,
      initialState: activeWorkflow.initialState,
      discriminatorKey: discriminator.key,
      discriminatorValue,
      isDefault: false,
    });
  }

  const usedDiscriminatorValues = useMemo(
    () => new Set(entityWorkflows.map((w) => w.discriminatorValue).filter(Boolean)),
    [entityWorkflows],
  );

  const availableDiscriminatorOptions = useMemo(
    () => discriminator?.options.filter((o) => !usedDiscriminatorValues.has(o.value)) ?? [],
    [discriminator, usedDiscriminatorValues],
  );

  if (!activeWorkflow) return null;

  return (
    <div>
      {discriminator && entityWorkflows.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {entityWorkflows.map((w) => (
            <button
              key={w.slug}
              type="button"
              onClick={() => setSelectedSlug(w.slug)}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                (activeWorkflow.slug === w.slug)
                  ? 'border-primary bg-primary/5 text-primary font-medium'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {w.name}
              {w.isDefault && (
                <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0">Default</Badge>
              )}
              {w.discriminatorValue && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0">{w.discriminatorValue}</Badge>
              )}
            </button>
          ))}

          {availableDiscriminatorOptions.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) handleCreatePipeline(e.target.value);
                e.target.value = '';
              }}
              className="h-8 px-2 text-xs rounded-md border border-dashed border-border bg-transparent text-muted-foreground"
              defaultValue=""
              disabled={createWorkflow.isPending}
            >
              <option value="" disabled>+ Add pipeline for {discriminator.label}...</option>
              {availableDiscriminatorOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <PipelineStageManager workflowSlug={activeWorkflow.slug} />
    </div>
  );
}
