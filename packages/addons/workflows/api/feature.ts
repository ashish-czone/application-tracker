/**
 * Pure feature-bag helpers for workflows. No entity-engine dependency —
 * non-entity-engine consumers (e.g., the workflows-ui shell, ad-hoc
 * domain code reading the bag) can import these without dragging
 * entity-engine into their graph.
 *
 * The entity-engine-coupled deriver lives in
 * `@packages/workflows-entity-engine`.
 */

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

/** Read the workflow feature bag from a registry entry's `features`. */
export function readWorkflowFeature(features: Record<string, unknown>): WorkflowFeatureBag | null {
  return (features[WORKFLOW_FEATURE_KEY] as WorkflowFeatureBag | undefined) ?? null;
}
