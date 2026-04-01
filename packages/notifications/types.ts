export type NotificationChannel = 'email' | 'in_app' | 'whatsapp';

export type RecipientStrategy = 'actor' | 'entity_owner' | 'role';

export type TriggerType = 'event' | 'schedule_once' | 'schedule_recurring';

export type ScheduleDateOperator = 'before' | 'after';

export type ScheduleUnit = 'minutes' | 'hours' | 'days';

export type { Condition, ConditionOperator } from '@packages/common';

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
  createdAt: Date;
}

export interface NotificationRuleChannel {
  ruleId: string;
  channel: NotificationChannel;
  templateId: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RenderedNotification {
  title: string;
  body: string;
  subject?: string;
}

export interface ChannelProvider {
  readonly channel: NotificationChannel;
  send(recipientId: string, content: RenderedNotification, context: ChannelContext): Promise<void>;
}

export interface ChannelContext {
  eventName: string;
  entityType: string;
  entityId: string;
  correlationId: string;
}

export type FieldType = 'text' | 'number' | 'date' | 'enum' | 'uuid' | 'boolean';

export interface FieldConfig {
  type: FieldType;
  label: string;
  options?: string[];
  resolveOptions?: () => Promise<string[]> | string[];
}

/** FieldConfig with options resolved — returned by the metadata API */
export interface ResolvedFieldConfig {
  type: FieldType;
  label: string;
  options?: string[];
}

export interface RecipientFieldConfig {
  label: string;
}

export interface EntityResolverConfig {
  table: any;
  fields: Record<string, FieldConfig>;
  recipientFields: Record<string, RecipientFieldConfig>;
}
