export interface EvaluationCriterion {
  name: string;
  description: string;
}

export interface EvaluationTemplate {
  id: string;
  slug: string;
  name: string;
  entityType: string;
  criteria: EvaluationCriterion[];
  blindingEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationScore {
  id: string;
  evaluationId: string;
  criteriaName: string;
  score: number;
  note: string | null;
  createdAt: string;
}

export interface Evaluator {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export type Recommendation = 'strong_no' | 'no' | 'yes' | 'strong_yes';

export const RECOMMENDATION_OPTIONS: { value: Recommendation; label: string; color: string }[] = [
  { value: 'strong_no', label: 'Definitely Not', color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' },
  { value: 'no', label: 'No', color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400' },
  { value: 'yes', label: 'Yes', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
  { value: 'strong_yes', label: 'Strong Yes', color: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400' },
];

export interface EvaluationWithScores {
  id: string;
  templateId: string;
  entityType: string;
  entityId: string;
  evaluatorId: string;
  overallRating: number;
  recommendation: Recommendation | null;
  comment: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  scores: EvaluationScore[];
  template?: EvaluationTemplate;
  evaluator?: Evaluator;
  isBlinded?: boolean;
}

export interface CreateEvaluationRequest {
  templateId: string;
  entityType: string;
  entityId: string;
  overallRating: number;
  recommendation: Recommendation;
  comment?: string;
  scores: {
    criteriaName: string;
    score: number;
    note?: string;
  }[];
}

export interface UpdateEvaluationRequest {
  overallRating?: number;
  recommendation?: Recommendation;
  comment?: string;
  scores?: {
    criteriaName: string;
    score: number;
    note?: string;
  }[];
}
