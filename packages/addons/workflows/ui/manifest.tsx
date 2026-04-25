import type { WebFeatureManifest } from '@packages/domains';
import { PipelineProgressInline } from './components/PipelineProgressInline';

/**
 * Frontend manifest for the workflows addon. Currently contributes only the
 * pipeline-progress column renderer, registered under the canonical
 * `PipelineProgressRenderer` key so entity configs can reference it from
 * column metadata.
 *
 * Workflows has additional integrations with the platform shell — transition
 * buttons inside EntityDetailPage and the workflow editor inside
 * EntityConfigPage — that are still wired directly in app-shell-ui rather
 * than via this manifest. Extracting those requires the entity detail page
 * to expose a plugin slot for header actions; that is a separate refactor.
 */
export const workflowsWeb: WebFeatureManifest = {
  name: 'workflows',
  columnRenderers: {
    PipelineProgressRenderer: { component: PipelineProgressInline },
  },
};
