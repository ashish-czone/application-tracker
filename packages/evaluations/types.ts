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

export interface EvaluationWithScores extends Evaluation {
  scores: EvaluationScore[];
  template?: EvaluationTemplate;
}
