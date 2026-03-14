import type { DomainEvent } from '@packages/events';

export const SETTINGS_SETTING_UPDATED = 'settings.SettingUpdated';

export interface SettingUpdatedPayload {
  module: string;
  keys: string[];
}

export interface SettingUpdatedEvent extends DomainEvent {
  eventName: typeof SETTINGS_SETTING_UPDATED;
  entityType: 'setting';
  payload: SettingUpdatedPayload;
}
