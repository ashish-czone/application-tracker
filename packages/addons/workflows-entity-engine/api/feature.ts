export const WORKFLOW_FEATURE_KEY = 'workflow';

export interface WorkflowFeatureBag {
  hasWorkflow: true;
  discriminator: null;
}

export const workflowFeatureDeriver = () => ({});

export function readWorkflowFeature(features: Record<string, unknown>): WorkflowFeatureBag | null {
  return (features[WORKFLOW_FEATURE_KEY] as WorkflowFeatureBag | undefined) ?? null;
}
