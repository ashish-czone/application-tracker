import type { DetailTabPlugin, RightSidebarPanel } from '@packages/entity-engine-ui';
import { EvaluationsSection } from './components/EvaluationsSection';
import { readEvaluationsFeature } from './feature';

export const evaluationsDetailTab: DetailTabPlugin = {
  key: 'evaluations',
  label: 'Evaluations',
  order: 300,
  component: EvaluationsSection,
  enabledFor: (entity) => !!readEvaluationsFeature(entity.features),
};

export const evaluationsSidebarPanel: RightSidebarPanel = {
  key: 'evaluations',
  label: 'Evaluations',
  order: 300,
  component: EvaluationsSection,
  enabledFor: (entity) => !!readEvaluationsFeature(entity.features),
};
