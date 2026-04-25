// Components
export { EvaluationsSection } from './components/EvaluationsSection';
export { EvaluationForm } from './components/EvaluationForm';
export { EvaluationsList } from './components/EvaluationsList';
export { EvaluationItem } from './components/EvaluationItem';
export { EvaluationSummary } from './components/EvaluationSummary';
export { StarRating } from './components/StarRating';
export { FormRatingInput } from './components/FormRatingInput';

// Field type registration
export { registerRatingFieldType } from './field-types/register';

// Hooks
export { useEvaluations, useEvaluationTemplates, useCreateEvaluation, useUpdateEvaluation, useDeleteEvaluation } from './hooks';

// Services
export { createEvaluationsApi, type EvaluationsUiApi } from './services';

// Types
export type {
  EvaluationTemplate,
  EvaluationCriterion,
  EvaluationWithScores,
  EvaluationScore,
  Evaluator,
  CreateEvaluationRequest,
  UpdateEvaluationRequest,
} from './types';

// Feature contract + plugin descriptors
export { EVALUATIONS_FEATURE_KEY, readEvaluationsFeature } from './feature';
export type { EvaluationsFeatureValue } from './feature';
export { evaluationsDetailTab, evaluationsSidebarPanel } from './plugins';
