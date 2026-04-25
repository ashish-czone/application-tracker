/**
 * Client-side reader for the evaluations addon feature key.
 */

export const EVALUATIONS_FEATURE_KEY = 'evaluations';

export interface EvaluationsFeatureValue {
  enabled: true;
}

export function readEvaluationsFeature(
  features: Record<string, unknown> | undefined,
): EvaluationsFeatureValue | undefined {
  const value = features?.[EVALUATIONS_FEATURE_KEY];
  if (!value || typeof value !== 'object') return undefined;
  return value as EvaluationsFeatureValue;
}
