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

export interface KanbanBoardProps {
  columns: KanbanColumnDef[];
  cards: KanbanCardData[];
  onCardMove: (event: KanbanCardMoveEvent) => void;
  onColumnReorder?: (event: KanbanColumnReorderEvent) => void;
  renderCard: (card: KanbanCardData) => React.ReactNode;
  isLoading?: boolean;
}
