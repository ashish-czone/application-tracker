import type { EntityConfig } from '@packages/entity-engine';
import type { FeatureDeriver } from '@packages/entity-engine';

/** Key under which workflow data is published in `EntityRegistryEntry.features`. */
export const WORKFLOW_FEATURE_KEY = 'workflow';

export interface WorkflowFeatureBag {
  /** Always true when the bag is present. Absence of the key means no workflow. */
  hasWorkflow: true;
  discriminator: {
    key: string;
    label: string;
    options: { value: string; label: string }[];
    fieldName: string;
  } | null;
}

/**
 * Inspects an entity config for `workflow` field types and emits the
 * workflow feature bag when one is present. Registered with
 * `FeatureDeriverRegistry` by `WorkflowsModule`.
 */
export const workflowFeatureDeriver: FeatureDeriver = (config: EntityConfig) => {
  const workflowFields = Object.entries(config.fieldMeta)
    .filter(([, meta]) => meta.fieldType === 'workflow');

  if (workflowFields.length === 0) return {};

  let discriminator: WorkflowFeatureBag['discriminator'] = null;
  for (const [fieldKey, meta] of workflowFields) {
    if (meta.workflow?.discriminator) {
      const d = meta.workflow.discriminator;
      discriminator = { key: d.key, label: d.label, options: d.options, fieldName: fieldKey };
      break;
    }
  }

  const bag: WorkflowFeatureBag = { hasWorkflow: true, discriminator };
  return { [WORKFLOW_FEATURE_KEY]: bag };
};

/** Read the workflow feature bag from a registry entry's `features`. */
export function readWorkflowFeature(features: Record<string, unknown>): WorkflowFeatureBag | null {
  return (features[WORKFLOW_FEATURE_KEY] as WorkflowFeatureBag | undefined) ?? null;
}
