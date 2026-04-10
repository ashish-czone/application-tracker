export interface KanbanColumnDef {
  id: string;
  label: string;
  color?: string;
}

export interface KanbanCardData {
  id: string;
  columnId: string;
  [key: string]: unknown;
}

export interface KanbanBoardProps {
  columns: KanbanColumnDef[];
  cards: KanbanCardData[];
  onCardMove: (cardId: string, toColumnId: string) => void;
  renderCard: (card: KanbanCardData) => React.ReactNode;
  isLoading?: boolean;
}
