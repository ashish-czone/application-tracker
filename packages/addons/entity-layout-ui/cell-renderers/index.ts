export { TextCell } from './text';
export { LookupCell } from './lookup';
export { WorkflowCell } from './workflow';
export type { CellRenderer, CellRendererProps, CellRendererRegistry } from './types';

import { TextCell } from './text';
import { LookupCell } from './lookup';
import { WorkflowCell } from './workflow';
import type { CellRendererRegistry } from './types';

/**
 * Default cell renderer registry shipped with @packages/entity-layout-ui.
 * Apps spread this and add their own:
 *
 *   <EntityListViewProvider cellRenderers={{ ...defaultCellRenderers, currency: CurrencyCell }} />
 */
export const defaultCellRenderers: CellRendererRegistry = {
  text: TextCell,
  lookup: LookupCell,
  workflow: WorkflowCell,
};
