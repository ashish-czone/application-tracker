import { api } from '../../../../lib/api';
import type { PaginatedResponse } from '@packages/common';
import type {
  NotificationRule,
  CreateRuleRequest,
  UpdateRuleRequest,
  ListRulesParams,
  RuleChannel,
  NotificationTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  ListTemplatesParams,
  EventMetadata,
  EntityMetadata,
  EntityField,
} from './types';

// --- Rules ---

export function listRules(params: ListRulesParams): Promise<PaginatedResponse<NotificationRule>> {
  const sp = new URLSearchParams();
  if (params.page && params.page > 1) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.search) sp.set('search', params.search);
  if (params.eventName) sp.set('eventName', params.eventName);
  if (params.isActive !== undefined) sp.set('isActive', String(params.isActive));
  if (params.sort) sp.set('sort', params.sort);
  if (params.order) sp.set('order', params.order);
  const qs = sp.toString();
  return api.get<PaginatedResponse<NotificationRule>>(`/notification-rules${qs ? `?${qs}` : ''}`);
}

export function getRule(id: string): Promise<NotificationRule> {
  return api.get<NotificationRule>(`/notification-rules/${id}`);
}

export function createRule(data: CreateRuleRequest): Promise<NotificationRule> {
  return api.post<NotificationRule>('/notification-rules', data);
}

export function updateRule(id: string, data: UpdateRuleRequest): Promise<NotificationRule> {
  return api.patch<NotificationRule>(`/notification-rules/${id}`, data);
}

export function setRuleChannels(id: string, channels: RuleChannel[]): Promise<NotificationRule> {
  return api.put<NotificationRule>(`/notification-rules/${id}/channels`, { channels });
}

export function deleteRule(id: string): Promise<void> {
  return api.delete<void>(`/notification-rules/${id}`);
}

// --- Templates ---

export function listTemplates(params: ListTemplatesParams): Promise<PaginatedResponse<NotificationTemplate>> {
  const sp = new URLSearchParams();
  if (params.page && params.page > 1) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.search) sp.set('search', params.search);
  if (params.channel) sp.set('channel', params.channel);
  if (params.sort) sp.set('sort', params.sort);
  if (params.order) sp.set('order', params.order);
  const qs = sp.toString();
  return api.get<PaginatedResponse<NotificationTemplate>>(`/notification-templates${qs ? `?${qs}` : ''}`);
}

export function getTemplate(id: string): Promise<NotificationTemplate> {
  return api.get<NotificationTemplate>(`/notification-templates/${id}`);
}

export function createTemplate(data: CreateTemplateRequest): Promise<NotificationTemplate> {
  return api.post<NotificationTemplate>('/notification-templates', data);
}

export function updateTemplate(id: string, data: UpdateTemplateRequest): Promise<NotificationTemplate> {
  return api.patch<NotificationTemplate>(`/notification-templates/${id}`, data);
}

export function deleteTemplate(id: string): Promise<void> {
  return api.delete<void>(`/notification-templates/${id}`);
}

// --- Metadata registries ---

export function listEvents(): Promise<EventMetadata[]> {
  return api.get<EventMetadata[]>('/automations/events');
}

export function listEntities(): Promise<EntityMetadata[]> {
  return api.get<EntityMetadata[]>('/automations/entities');
}

// --- Entity fields (generic endpoint) ---

export function getEntityFields(entityType: string): Promise<EntityField[]> {
  return api.get<EntityField[]>(`/entities/${entityType}/fields`);
}
