// --- Shared types ---

export type TriggerType = 'event' | 'schedule_once' | 'schedule_recurring';
export type NotificationChannel = 'email' | 'in_app' | 'whatsapp';
export type ConditionOperator = 'eq' | 'neq' | 'in' | 'gt' | 'lt' | 'is_null' | 'is_not_null' | 'changed' | 'changed_to' | 'changed_from_to';
export type ScheduleDateOperator = 'before' | 'after';
export type ScheduleUnit = 'minutes' | 'hours' | 'days';
export type UserResolutionStrategy = 'actor' | 'entity_field' | 'role';

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

// --- Automation Rules ---

export interface UserResolution {
  strategy: UserResolutionStrategy;
  config?: Record<string, unknown>;
}

export interface ActionLink {
  as: string;
}

export interface ActionConfig {
  type: string;
  config: Record<string, unknown>;
  users?: Record<string, UserResolution>;
  link?: ActionLink;
}

export interface LifecycleUpdateBinding {
  conditions?: Condition[];
  linked: string;
  action: 'update';
  set: Record<string, unknown>;
}

export interface LifecycleDeleteBinding {
  linked: string;
  action: 'update' | 'delete';
  set?: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  triggerType: TriggerType;
  eventName: string | null;
  delayAmount: number | null;
  delayUnit: ScheduleUnit | null;
  scheduleEntityType: string | null;
  scheduleDateField: string | null;
  scheduleDateOperator: ScheduleDateOperator | null;
  scheduleDateAmounts: number[] | null;
  scheduleDateUnit: ScheduleUnit | null;
  scheduleDaysOfWeek: number[] | null;
  conditions: Condition[] | null;
  actions: ActionConfig[];
  onSourceUpdated: LifecycleUpdateBinding[] | null;
  onSourceDeleted: LifecycleDeleteBinding[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutomationRuleRequest {
  name: string;
  description?: string;
  triggerType: TriggerType;
  eventName?: string;
  delayAmount?: number;
  delayUnit?: ScheduleUnit;
  scheduleEntityType?: string;
  scheduleDateField?: string;
  scheduleDateOperator?: ScheduleDateOperator;
  scheduleDateAmounts?: number[];
  scheduleDateUnit?: ScheduleUnit;
  scheduleDaysOfWeek?: number[];
  conditions?: Condition[];
  actions: ActionConfig[];
  onSourceUpdated?: LifecycleUpdateBinding[];
  onSourceDeleted?: LifecycleDeleteBinding[];
}

export interface UpdateAutomationRuleRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
  conditions?: Condition[];
  actions?: ActionConfig[];
  onSourceUpdated?: LifecycleUpdateBinding[];
  onSourceDeleted?: LifecycleDeleteBinding[];
}

export interface ListAutomationRulesParams {
  page?: number;
  limit?: number;
  search?: string;
  eventName?: string;
  isActive?: boolean;
  sort?: 'name' | 'createdAt';
  order?: 'asc' | 'desc';
}

// --- Notification Templates ---

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateRequest {
  name: string;
  channel: NotificationChannel;
  subject?: string;
  body: string;
}

export interface UpdateTemplateRequest {
  name?: string;
  subject?: string;
  body?: string;
}

export interface ListTemplatesParams {
  page?: number;
  limit?: number;
  search?: string;
  channel?: NotificationChannel;
  sort?: 'name' | 'createdAt';
  order?: 'asc' | 'desc';
}

// --- Registry metadata ---

export interface EventMetadata {
  eventName: string;
  group: string;
  description: string;
  payloadSchema: Record<string, { type: string; label: string }>;
}

export type FieldType = 'text' | 'number' | 'date' | 'enum' | 'uuid' | 'boolean';

export interface FieldConfig {
  type: FieldType;
  label: string;
  options?: string[];
}

export interface UserFieldConfig {
  label: string;
}

export interface EntityMetadata {
  entityType: string;
  fields: Record<string, FieldConfig>;
  userFields: Record<string, UserFieldConfig>;
}

export interface ActionTypeMetadata {
  type: string;
  label: string;
  userSlots: { name: string; label: string; required: boolean }[];
  configSchema: Record<string, unknown>;
}

export interface UserStrategyMetadata {
  type: string;
  label: string;
  configSchema: Record<string, unknown>;
}

// --- Entity fields (generic endpoint) ---

export interface EntityField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  isSystem: boolean;
  isCustom: boolean;
  isUnique: boolean;
  maxLength: number | null;
  defaultValue: string | null;
  options?: string[];
}
