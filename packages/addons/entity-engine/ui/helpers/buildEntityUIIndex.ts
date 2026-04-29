import type {
  EntityUIConfig,
  EntityUIPresentation,
  FieldUI,
  ActionUI,
  FormLayoutConfig,
  ListColumnConfig,
} from '../types';

export interface EntityUIIndex {
  presentation: Map<string, EntityUIPresentation>;
  fieldUI: Map<string, Map<string, FieldUI>>;
  actionUI: Map<string, Map<string, ActionUI>>;
  formLayout: Map<string, FormLayoutConfig>;
  listColumns: Map<string, ListColumnConfig[]>;
}

export function buildEntityUIIndex(configs: EntityUIConfig[]): EntityUIIndex {
  const presentation = new Map<string, EntityUIPresentation>();
  const fieldUI = new Map<string, Map<string, FieldUI>>();
  const actionUI = new Map<string, Map<string, ActionUI>>();
  const formLayout = new Map<string, FormLayoutConfig>();
  const listColumns = new Map<string, ListColumnConfig[]>();

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
    if (config.formLayout) {
      formLayout.set(config.entityType, config.formLayout);
    }
    if (config.listColumns) {
      listColumns.set(config.entityType, config.listColumns);
    }
  }

  return { presentation, fieldUI, actionUI, formLayout, listColumns };
}
