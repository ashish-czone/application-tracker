/**
 * Public API for @packages/entity-views-ui.
 *
 * Frontend layout package for the camp-B / decoupled entity path. Each list
 * page declares its own `defineListLayout(...)` config and renders via
 * `<EntityListView layout={...} useList={...}>`. No backend layout endpoint,
 * no implicit registry — layout is per-page data, hooks are per-page code.
 */

// Layout factories
export { defineListLayout } from './define-list-layout';
export type {
  ListLayoutDefinition,
  ListColumnDefinition,
  ListColumnLookupConfig,
  ListColumnAlign,
} from './define-list-layout';

export { defineDetailLayout } from './define-detail-layout';
export type { DetailLayoutDefinition, DetailLayoutSection } from './define-detail-layout';

export { defineFormLayout, flattenFormFields } from './define-form-layout';
export type {
  FormLayoutDefinition,
  FormSectionDefinition,
  FormFieldDefinition,
} from './define-form-layout';

export { buildFormSchema, adaptFormFieldDefinition } from './helpers/build-form-schema';

// Components
export { EntityFormFields } from './EntityFormFields';
export type { FormFieldOverride, LookupSearchFn } from './EntityFormFields';

export { EntityListView } from './EntityListView';
export type { UseListHook, UseListQuery, UseListResult } from './EntityListView';

export { EntityListViewProvider, useEntityListViewContext } from './EntityListViewProvider';
export type { EntityListViewApiFn } from './EntityListViewProvider';

// Cell renderers
export {
  TextCell,
  LookupCell,
  WorkflowCell,
  defaultCellRenderers,
} from './cell-renderers';
export type {
  CellRenderer,
  CellRendererProps,
  CellRendererRegistry,
} from './cell-renderers';
