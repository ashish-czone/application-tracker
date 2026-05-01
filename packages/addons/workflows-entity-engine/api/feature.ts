import type { EntityConfig, FeatureDeriver } from '@packages/entity-engine';
import { WORKFLOW_FEATURE_KEY, type WorkflowFeatureBag } from '@packages/workflows';

/**
 * Inspects an entity config for `workflow` field types and emits the
 * workflow feature bag when one is present. Registered with
 * `FeatureDeriverRegistry` by `WorkflowsEntityEngineModule`.
 *
 * Lives in the binding package because it depends on entity-engine's
 * `EntityConfig` / `FeatureDeriver` types. The pure feature-bag helpers
 * (`WORKFLOW_FEATURE_KEY`, `WorkflowFeatureBag`, `readWorkflowFeature`)
 * remain in `@packages/workflows` so non-entity-engine consumers can
 * still read the bag without dragging entity-engine into their graph.
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
