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

export interface EvaluationWithScores {
  id: string;
  templateId: string;
  entityType: string;
  entityId: string;
  evaluatorId: string;
  overallRating: number;
  comment: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  scores: EvaluationScore[];
  template?: EvaluationTemplate;
  evaluator?: Evaluator;
}

export interface CreateEvaluationRequest {
  templateId: string;
  entityType: string;
  entityId: string;
  overallRating: number;
  comment?: string;
  scores: {
    criteriaName: string;
    score: number;
    note?: string;
  }[];
}

export interface UpdateEvaluationRequest {
  overallRating?: number;
  comment?: string;
  scores?: {
    criteriaName: string;
    score: number;
    note?: string;
  }[];
}
