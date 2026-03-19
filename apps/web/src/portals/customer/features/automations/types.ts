// --- Notification Rules ---

export type TriggerType = 'event' | 'schedule_once' | 'schedule_recurring';
export type NotificationChannel = 'email' | 'in_app' | 'whatsapp';
export type RecipientStrategy = 'actor' | 'entity_owner' | 'role';
export type ConditionOperator = 'eq' | 'neq' | 'in' | 'gt' | 'lt' | 'is_null' | 'is_not_null';
export type ScheduleDateOperator = 'before' | 'after';
export type ScheduleUnit = 'minutes' | 'hours' | 'days';

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface RuleChannel {
  channel: NotificationChannel;
  templateId: string;
}

export interface NotificationRule {
  id: string;
  name: string;
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
  recipientStrategy: RecipientStrategy;
  recipientConfig: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  channels: RuleChannel[];
}

export interface CreateRuleRequest {
  name: string;
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
  recipientStrategy: RecipientStrategy;
  recipientConfig?: Record<string, unknown>;
  channels: RuleChannel[];
}

export interface UpdateRuleRequest {
  name?: string;
  recipientStrategy?: RecipientStrategy;
  recipientConfig?: Record<string, unknown>;
  isActive?: boolean;
  conditions?: Condition[];
  scheduleDaysOfWeek?: number[];
}

export interface ListRulesParams {
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

export interface RecipientFieldConfig {
  label: string;
}

export interface EntityMetadata {
  entityType: string;
  fields: Record<string, FieldConfig>;
  recipientFields: Record<string, RecipientFieldConfig>;
}
