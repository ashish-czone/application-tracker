/**
 * Evaluations addon feature contract.
 *
 * Entity authors opt in by spreading `evaluationsFeature()` into their
 * `defineEntity({ features: ... })`.
 */

export const EVALUATIONS_FEATURE_KEY = 'evaluations';

export interface EvaluationsFeatureConfig {
  /** Reserved for future per-entity options. */
}

export type EvaluationsFeatureValue = EvaluationsFeatureConfig & { enabled: true };

export function evaluationsFeature(
  config: EvaluationsFeatureConfig = {},
): Record<string, EvaluationsFeatureValue> {
  return { [EVALUATIONS_FEATURE_KEY]: { ...config, enabled: true } };
}

export function readEvaluationsFeature(
  features: Record<string, unknown> | undefined,
): EvaluationsFeatureValue | undefined {
  const value = features?.[EVALUATIONS_FEATURE_KEY];
  if (!value || typeof value !== 'object') return undefined;
  return value as EvaluationsFeatureValue;
}
