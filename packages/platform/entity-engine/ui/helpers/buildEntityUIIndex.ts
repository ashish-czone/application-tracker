import type { EntityUIConfig, EntityUIPresentation, FieldUI, ActionUI } from '../types';

export interface EntityUIIndex {
  presentation: Map<string, EntityUIPresentation>;
  fieldUI: Map<string, Map<string, FieldUI>>;
  actionUI: Map<string, Map<string, ActionUI>>;
}

export function buildEntityUIIndex(configs: EntityUIConfig[]): EntityUIIndex {
  const presentation = new Map<string, EntityUIPresentation>();
  const fieldUI = new Map<string, Map<string, FieldUI>>();
  const actionUI = new Map<string, Map<string, ActionUI>>();

  for (const config of configs) {
    if (config.presentation) {
      presentation.set(config.entityType, config.presentation);
    }
    if (config.fieldUI) {
      fieldUI.set(config.entityType, new Map(Object.entries(config.fieldUI)));
    }
    if (config.actionUI) {
      actionUI.set(config.entityType, new Map(Object.entries(config.actionUI)));
    }
  }

  return { presentation, fieldUI, actionUI };
}
