import type { PaginatedResponse } from '@packages/common';
import type { ApiFn } from '../PlatformUIProvider';
import type {
  AutomationRule,
  CreateAutomationRuleRequest,
  UpdateAutomationRuleRequest,
  ListAutomationRulesParams,
  EventMetadata,
  EntityMetadata,
  ActionTypeMetadata,
  UserStrategyMetadata,
  EntityField,
} from './types';

export function createAutomationsApi(api: ApiFn) {
  return {
    // --- Automation Rules ---

    listAutomationRules(params: ListAutomationRulesParams): Promise<PaginatedResponse<AutomationRule>> {
      const sp = new URLSearchParams();
      if (params.page && params.page > 1) sp.set('page', String(params.page));
      if (params.limit) sp.set('limit', String(params.limit));
      if (params.search) sp.set('search', params.search);
      if (params.eventName) sp.set('eventName', params.eventName);
      if (params.isActive !== undefined) sp.set('isActive', String(params.isActive));
      if (params.sort) sp.set('sort', params.sort);
      if (params.order) sp.set('order', params.order);
      const qs = sp.toString();
      return api.get<PaginatedResponse<AutomationRule>>(`/automation-rules${qs ? `?${qs}` : ''}`);
    },

    getAutomationRule(id: string): Promise<AutomationRule> {
      return api.get<AutomationRule>(`/automation-rules/${id}`);
    },

    createAutomationRule(data: CreateAutomationRuleRequest): Promise<AutomationRule> {
      return api.post<AutomationRule>('/automation-rules', data);
    },

    updateAutomationRule(id: string, data: UpdateAutomationRuleRequest): Promise<AutomationRule> {
      return api.patch<AutomationRule>(`/automation-rules/${id}`, data);
    },

    deleteAutomationRule(id: string): Promise<void> {
      return api.delete<void>(`/automation-rules/${id}`);
    },

    // --- Metadata ---

    listEvents(): Promise<EventMetadata[]> {
      return api.get<EventMetadata[]>('/automations/events');
    },

    listEntities(): Promise<EntityMetadata[]> {
      return api.get<EntityMetadata[]>('/automations/entities');
    },

    listActionTypes(): Promise<ActionTypeMetadata[]> {
      return api.get<ActionTypeMetadata[]>('/automations/action-types');
    },

    listUserStrategies(): Promise<UserStrategyMetadata[]> {
      return api.get<UserStrategyMetadata[]>('/automations/user-strategies');
    },

    getEntityFields(entityType: string): Promise<EntityField[]> {
      return api.get<EntityField[]>(`/entities/${entityType}/fields`);
    },
  };
}

export type AutomationsApi = ReturnType<typeof createAutomationsApi>;
