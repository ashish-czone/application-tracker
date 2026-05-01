import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { defaultCellRenderers, type CellRendererRegistry } from './cell-renderers';

export interface EntityListViewApiFn {
  get: <T>(path: string) => Promise<T>;
}

interface EntityListViewContextValue {
  cellRenderers: CellRendererRegistry;
  apiFn: EntityListViewApiFn;
}

const EntityListViewContext = createContext<EntityListViewContextValue | null>(null);

interface EntityListViewProviderProps {
  children: ReactNode;
  /**
   * The app's api object — must have a `.get<T>(path)` method. Used by
   * cell renderers that fetch reference data (e.g. WorkflowCell pulls
   * the workflow def for state colors).
   */
  apiFn: EntityListViewApiFn;
  /**
   * Optional renderer registry. Defaults to `defaultCellRenderers`
   * (text/lookup/workflow). Apps spread the defaults and add their own:
   *
   *   <EntityListViewProvider cellRenderers={{ ...defaultCellRenderers, currency: CurrencyCell }} />
   */
  cellRenderers?: CellRendererRegistry;
}

/**
 * Mount near the app root, ABOVE every page that uses `<EntityListView>`.
 * Provides the cell renderer registry + api function the renderers need.
 *
 * Required because cell renderers are decoupled from the layout config —
 * the layout says `cell: 'workflow'` (a string name); this provider
 * resolves names to React components.
 */
export function EntityListViewProvider({
  children,
  apiFn,
  cellRenderers,
}: EntityListViewProviderProps) {
  const value = useMemo<EntityListViewContextValue>(
    () => ({
      cellRenderers: cellRenderers ?? defaultCellRenderers,
      apiFn,
    }),
    [cellRenderers, apiFn],
  );

  return <EntityListViewContext.Provider value={value}>{children}</EntityListViewContext.Provider>;
}

export function useEntityListViewContext(): EntityListViewContextValue {
  const ctx = useContext(EntityListViewContext);
  if (!ctx) {
    throw new Error(
      'useEntityListViewContext must be used inside <EntityListViewProvider>. ' +
        'Mount the provider near the app root and pass an apiFn.',
    );
  }
  return ctx;
}
