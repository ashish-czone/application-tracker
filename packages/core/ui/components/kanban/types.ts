export interface KanbanColumnDef {
  id: string;
  label: string;
  color?: string;
  /** Soft cap on cards — rendered as "(N/limit)" in the column header. Purely presentational. */
  limit?: number;
}

export interface KanbanCardData {
  id: string;
  columnId: string;
  [key: string]: unknown;
}

export interface KanbanCardMoveEvent {
  cardId: string;
  fromColumnId: string;
  toColumnId: string;
  /** Destination index within the target column after the move. */
  toIndex: number;
}

export interface KanbanColumnReorderEvent {
  columnId: string;
  fromIndex: number;
  toIndex: number;
}

/**
 * Per-column metadata for paginated kanban boards. All fields optional —
 * a column with no entry behaves as today (header shows the rendered card
 * count, no footer, no skeleton).
 */
export interface KanbanColumnState {
  /**
   * Server-known total for this column. Used as the denominator in the
   * header count: "{rendered}/{total}". When unset, falls back to the
   * legacy `column.limit` soft cap, then to a bare "{rendered}".
   */
  total?: number;
  /**
   * Footer rendered below the cards (outside the SortableContext, so it
   * doesn't behave as a drop target). Typical use: a "Load more" button.
   */
  footer?: React.ReactNode;
  /**
   * The column is fetching its initial page. With cards still empty,
   * the body renders a skeleton instead of the "Drop here" empty state.
   */
  isLoading?: boolean;
}

export interface KanbanBoardProps {
  columns: KanbanColumnDef[];
  cards: KanbanCardData[];
  /**
   * Per-column overlay metadata for paginated boards. Keyed by column id;
   * absent columns use today's defaults.
   */
  columnState?: Record<string, KanbanColumnState>;
  onCardMove: (event: KanbanCardMoveEvent) => void;
  onColumnReorder?: (event: KanbanColumnReorderEvent) => void;
  renderCard: (card: KanbanCardData) => React.ReactNode;
  isLoading?: boolean;
}
