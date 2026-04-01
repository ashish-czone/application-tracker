import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { Label, Input, FormSelect } from '@packages/ui';
import { useWorkflows } from '../hooks';
import type { WorkflowDefinition } from '../types';

interface TransitionWorkflowActionConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  /** Entity type of the triggering event — used to filter workflows when no override */
  sourceEntityType?: string;
  /** Pre-fetched entity options for the entity type picker */
  entityOptions: { value: string; label: string }[];
}

/**
 * Action config component for the "transition_workflow" action type.
 * Renders:
 * 1. Optional entity type override (defaults to triggering entity)
 * 2. Optional entity ID override (supports mustache interpolation)
 * 3. Workflow picker — filtered by effective entity type
 * 4. Target state picker — states from selected workflow with color indicators
 *
 * The fieldKey is auto-populated from the selected workflow's fieldName.
 */
export function TransitionWorkflowActionConfig({
  config,
  onChange,
  sourceEntityType,
  entityOptions,
}: TransitionWorkflowActionConfigProps) {
  const { data: allWorkflows, isLoading: workflowsLoading } = useWorkflows();

  const selectedEntityType = (config.entityType as string) ?? '';
  const entityId = (config.entityId as string) ?? '';
  const workflowSlug = (config.workflowSlug as string) ?? '';
  const targetState = (config.targetState as string) ?? '';

  // Effective entity type for filtering workflows
  const effectiveEntityType = selectedEntityType || sourceEntityType;

  // Entity types that have at least one active workflow
  const entitiesWithWorkflows = useMemo(() => {
    if (!allWorkflows) return new Set<string>();
    return new Set(allWorkflows.filter((w) => w.isActive).map((w) => w.entityType));
  }, [allWorkflows]);

  // Entity type options: "triggering entity" + only entities with workflows
  const entityTypeOptions = useMemo(() => [
    { value: '', label: 'Triggering entity (default)' },
    ...entityOptions.filter((e) => entitiesWithWorkflows.has(e.value)),
  ], [entityOptions, entitiesWithWorkflows]);

  // Workflows filtered by effective entity type
  const filteredWorkflows = useMemo(() => {
    if (!allWorkflows || !effectiveEntityType) return [];
    return allWorkflows.filter((w) => w.entityType === effectiveEntityType && w.isActive);
  }, [allWorkflows, effectiveEntityType]);

  const workflowOptions = useMemo(() =>
    filteredWorkflows.map((w) => ({
      value: w.slug,
      label: `${w.name} (${w.fieldName})`,
    })),
  [filteredWorkflows]);

  // Selected workflow definition (for states)
  const selectedWorkflow: WorkflowDefinition | undefined = useMemo(() =>
    filteredWorkflows.find((w) => w.slug === workflowSlug),
  [filteredWorkflows, workflowSlug]);

  // State options from the selected workflow, sorted by sortOrder
  const stateOptions = useMemo(() => {
    if (!selectedWorkflow) return [];
    return [...selectedWorkflow.states]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({ value: s.name, label: s.label }));
  }, [selectedWorkflow]);

  const handleEntityTypeChange = (value: string) => {
    // Reset workflow and state when entity type changes
    onChange({ entityType: value || undefined, entityId: entityId || undefined });
  };

  const handleEntityIdChange = (value: string) => {
    onChange({ ...config, entityId: value || undefined });
  };

  const handleWorkflowChange = (slug: string) => {
    const workflow = filteredWorkflows.find((w) => w.slug === slug);
    onChange({
      ...(selectedEntityType ? { entityType: selectedEntityType } : {}),
      ...(entityId ? { entityId } : {}),
      workflowSlug: slug || undefined,
      fieldKey: workflow?.fieldName,
      targetState: undefined,
    });
  };

  const handleTargetStateChange = (state: string) => {
    onChange({
      ...(selectedEntityType ? { entityType: selectedEntityType } : {}),
      ...(entityId ? { entityId } : {}),
      workflowSlug,
      fieldKey: selectedWorkflow?.fieldName,
      targetState: state || undefined,
    });
  };

  return (
    <div className="space-y-3">
      <FormSelect
        value={selectedEntityType}
        onChange={handleEntityTypeChange}
        options={entityTypeOptions}
        label="Entity Type"
        placeholder="Triggering entity (default)"
      />

      {selectedEntityType && (
        <div className="space-y-2">
          <Label>Entity ID (optional, supports {"{{mustache}}"})</Label>
          <Input
            value={entityId}
            onChange={(e) => handleEntityIdChange(e.target.value)}
            placeholder="{{event.entityId}} (defaults to triggering entity)"
          />
        </div>
      )}

      {!effectiveEntityType && (
        <p className="text-xs text-muted-foreground">
          Select a trigger event with an entity type to see available workflows.
        </p>
      )}

      {effectiveEntityType && workflowsLoading && (
        <div className="h-10 animate-pulse rounded bg-muted" />
      )}

      {effectiveEntityType && !workflowsLoading && (
        <>
          <FormSelect
            value={workflowSlug}
            onChange={handleWorkflowChange}
            options={workflowOptions}
            label="Workflow"
            placeholder={filteredWorkflows.length === 0 ? 'No workflows found' : 'Select workflow...'}
          />

          {workflowSlug && selectedWorkflow && (
            <>
              <div className="space-y-2">
                <Label>Target State</Label>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    {stateOptions.map((opt) => {
                      const state = selectedWorkflow.states.find((s) => s.name === opt.value);
                      const isSelected = targetState === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleTargetStateChange(opt.value)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                              : 'border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent'
                          }`}
                        >
                          {state?.color && (
                            <span
                              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: state.color }}
                            />
                          )}
                          <span className="truncate">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2.5">
                <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Transition will only execute if a valid path exists from the entity's current state.
                  Invalid transitions are logged and skipped.
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
