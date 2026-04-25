/** Key under which workflow data is published in `EntityRegistryEntry.features`. */
export const WORKFLOW_FEATURE_KEY = 'workflow';

export interface WorkflowFeatureBag {
  hasWorkflow: true;
  discriminator: {
    key: string;
    label: string;
    options: { value: string; label: string }[];
    fieldName: string;
  } | null;
}

/** Read the workflow feature bag from a registry entry's `features`. */
export function readWorkflowFeature(features: Record<string, unknown>): WorkflowFeatureBag | null {
  return (features[WORKFLOW_FEATURE_KEY] as WorkflowFeatureBag | undefined) ?? null;
}
