import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { KanbanBoard, type KanbanColumnDef, type KanbanCardData } from '@packages/ui';
import { useEntityConfig, useEntityHooks } from '../EntityEngineProvider';
import { useEntityLayout } from '../helpers/useEntityLayout';

interface EntityBoardViewProps {
  entityType: string;
  groupByField: string;
}

export function EntityBoardView({ entityType, groupByField }: EntityBoardViewProps) {
  const navigate = useNavigate();
  const entity = useEntityConfig(entityType);
  const hooks = useEntityHooks(entityType);
  const { data: layout } = useEntityLayout(entityType);

  const updateMutation = hooks.useUpdate({});

  // Fetch all records (board view shows everything, paginated high)
  const { data, isLoading } = hooks.useList({ page: 1, limit: 500 });

  // Build columns from picklist options of the groupBy field
  const columns = useMemo<KanbanColumnDef[]>(() => {
    if (!layout) return [];
    const allFields = layout.sections.flatMap((s) => s.fields);
    const field = allFields.find((f) => f.fieldKey === groupByField);
    if (!field || !field.picklistOptions?.length) return [];

    return field.picklistOptions.map((opt) => ({
      id: opt.value,
      label: opt.label,
    }));
  }, [layout, groupByField]);

  // Map entity records to kanban cards
  const cards = useMemo<KanbanCardData[]>(() => {
    if (!data?.data) return [];
    return data.data.map((record: Record<string, unknown>) => ({
      id: record.id as string,
      columnId: (record[groupByField] as string) ?? '',
      ...record,
    }));
  }, [data, groupByField]);

  // Get display name from entity config
  const getDisplayName = (card: KanbanCardData): string => {
    const { nameField } = entity;
    if (Array.isArray(nameField)) {
      return nameField.map((f) => card[f] ?? '').filter(Boolean).join(' ');
    }
    return String(card[nameField] ?? card.id ?? '');
  };

  const getSubtitle = (card: KanbanCardData): string | null => {
    const { subtitleField } = entity.ui;
    if (!subtitleField) return null;
    const val = card[subtitleField];
    return val ? String(val) : null;
  };

  // Format relative time
  const getTimeAgo = (card: KanbanCardData): string | null => {
    const created = card.createdAt;
    if (!created) return null;
    const date = new Date(created as string);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  const handleCardMove = ({ cardId, toColumnId }: { cardId: string; toColumnId: string }) => {
    updateMutation.mutate({ id: cardId, data: { [groupByField]: toColumnId } });
  };

  return (
    <KanbanBoard
      columns={columns}
      cards={cards}
      onCardMove={handleCardMove}
      isLoading={isLoading}
      renderCard={(card) => (
        <button
          type="button"
          onClick={() => navigate(`/${entity.slug}/${card.id}`)}
          className="w-full text-left group/card"
        >
          <div className="text-[13px] font-medium text-foreground group-hover/card:text-primary transition-colors leading-snug">
            {getDisplayName(card)}
          </div>
          {getSubtitle(card) && (
            <div className="text-[11px] text-muted-foreground mt-1 truncate">
              {getSubtitle(card)}
            </div>
          )}
          {getTimeAgo(card) && (
            <div className="text-[10px] text-muted-foreground/60 mt-1.5">
              {getTimeAgo(card)}
            </div>
          )}
        </button>
      )}
    />
  );
}
