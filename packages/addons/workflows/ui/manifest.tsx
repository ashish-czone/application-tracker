import type { WebFeatureManifest } from '@packages/domains';
import { PipelineProgressInline } from './components/PipelineProgressInline';
import {
  renderPipelineProgress,
  renderWorkflowActions,
} from './components/EntityDetailIntegration';
import { WorkflowPipelineTab } from './components/WorkflowPipelineTab';
import { readWorkflowFeature } from './feature';

/**
 * Frontend manifest for the workflows addon. Contributes:
 *
 * - `PipelineProgressRenderer` column renderer (canonical key referenced
 *   from entity column metadata).
 * - `entityDetailRenderers.pipelineProgress` — pipeline progress bar +
 *   transition confirm dialog inside `EntityDetailPage`.
 * - `entityDetailRenderers.workflowActions` — transition button +
 *   transition confirm dialog inside `EntityDetailPage`.
 * - `entityConfigTabs[].pipeline` — Pipeline sub-tab on the entity-config
 *   admin page, shown for entities that have the workflow feature
 *   configured. Tab content lives in `WorkflowPipelineTab`.
 */
export const workflowsWeb: WebFeatureManifest = {
  name: 'workflows',
  columnRenderers: {
    PipelineProgressRenderer: { component: PipelineProgressInline },
  },
  entityDetailRenderers: {
    pipelineProgress: renderPipelineProgress,
    workflowActions: renderWorkflowActions,
  },
  entityConfigTabs: [
    {
      key: 'pipeline',
      label: 'Pipeline',
      component: WorkflowPipelineTab,
      appliesTo: (entity) => {
        const features = (entity as { features?: Record<string, unknown> } | null | undefined)?.features;
        return !!features && !!readWorkflowFeature(features);
      },
    },
  ],
};
