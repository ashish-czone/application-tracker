export const RECOMMENDATION_VALUES = ['strong_no', 'no', 'yes', 'strong_yes'] as const;
export type Recommendation = typeof RECOMMENDATION_VALUES[number];

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  strong_no: 'Definitely Not',
  no: 'No',
  yes: 'Yes',
  strong_yes: 'Strong Yes',
};

export interface EvaluationTemplateCriteria {
  name: string;
  description: string;
}

export interface EvaluationTemplate {
  id: string;
  slug: string;
  name: string;
  entityType: string;
  criteria: EvaluationTemplateCriteria[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Evaluation {
  id: string;
  templateId: string;
  entityType: string;
  entityId: string;
  evaluatorId: string;
  overallRating: number;
  recommendation: Recommendation | null;
  comment: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvaluationScore {
  id: string;
  evaluationId: string;
  criteriaName: string;
  score: number;
  note: string | null;
  createdAt: Date;
}

export interface EvaluationEvaluator {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

export interface EvaluationWithScores extends Evaluation {
  scores: EvaluationScore[];
  template?: EvaluationTemplate;
  evaluator?: EvaluationEvaluator;
}
