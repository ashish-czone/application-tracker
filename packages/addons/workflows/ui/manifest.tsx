import type { WebFeatureManifest } from '@packages/domains';
import { PipelineProgressInline } from './components/PipelineProgressInline';
import {
  renderPipelineProgress,
  renderWorkflowActions,
} from './components/EntityDetailIntegration';

/**
 * Frontend manifest for the workflows addon. Contributes:
 *
 * - `PipelineProgressRenderer` column renderer (canonical key referenced
 *   from entity column metadata).
 * - `entityDetailRenderers.pipelineProgress` — pipeline progress bar +
 *   transition confirm dialog inside `EntityDetailPage`.
 * - `entityDetailRenderers.workflowActions` — transition button +
 *   transition confirm dialog inside `EntityDetailPage`.
 *
 * The entity-config admin page's Pipeline sub-tab is contributed via
 * `entityConfigTabs` in the same manifest after the EntityConfigPage
 * extraction lands; this manifest is updated again at that step.
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
};
