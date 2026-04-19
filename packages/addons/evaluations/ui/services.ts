import type { PaginatedResponse } from '@packages/common';
import type { ApiFn } from '@packages/platform-ui';
import type {
  EvaluationWithScores,
  EvaluationTemplate,
  CreateEvaluationRequest,
  UpdateEvaluationRequest,
} from './types';

export function createEvaluationsApi(api: ApiFn) {
  return {
    listEvaluations(params: { entityType: string; entityId: string; page?: number; limit?: number }): Promise<PaginatedResponse<EvaluationWithScores>> {
      const searchParams = new URLSearchParams();
      searchParams.set('entityType', params.entityType);
      searchParams.set('entityId', params.entityId);
      if (params.page && params.page > 1) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      return api.get<PaginatedResponse<EvaluationWithScores>>(`/evaluations?${searchParams.toString()}`);
    },

    getEvaluation(id: string): Promise<EvaluationWithScores> {
      return api.get<EvaluationWithScores>(`/evaluations/${id}`);
    },

    createEvaluation(data: CreateEvaluationRequest): Promise<EvaluationWithScores> {
      return api.post<EvaluationWithScores>('/evaluations', data);
    },

    updateEvaluation(id: string, data: UpdateEvaluationRequest): Promise<EvaluationWithScores> {
      return api.patch<EvaluationWithScores>(`/evaluations/${id}`, data);
    },

    deleteEvaluation(id: string): Promise<void> {
      return api.delete<void>(`/evaluations/${id}`);
    },

    listTemplates(params: { entityType?: string; isActive?: boolean; page?: number; limit?: number }): Promise<PaginatedResponse<EvaluationTemplate>> {
      const searchParams = new URLSearchParams();
      if (params.entityType) searchParams.set('entityType', params.entityType);
      if (params.isActive !== undefined) searchParams.set('isActive', String(params.isActive));
      if (params.page && params.page > 1) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      const qs = searchParams.toString();
      return api.get<PaginatedResponse<EvaluationTemplate>>(`/evaluation-templates${qs ? `?${qs}` : ''}`);
    },
  };
}

export type EvaluationsUiApi = ReturnType<typeof createEvaluationsApi>;
