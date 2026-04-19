import { ClipboardList } from 'lucide-react';
import type { EvaluationWithScores } from '../types';
import { EvaluationItem } from './EvaluationItem';

interface EvaluationsListProps {
  evaluations: EvaluationWithScores[];
  currentUserId: string;
  onEdit: (evaluation: EvaluationWithScores) => void;
  onDelete: (id: string) => void;
}

export function EvaluationsList({ evaluations, currentUserId, onEdit, onDelete }: EvaluationsListProps) {
  if (evaluations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ClipboardList className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No evaluations yet</p>
        <p className="text-xs text-muted-foreground mt-1">Add an evaluation to rate this record</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {evaluations.map((evaluation) => (
        <EvaluationItem
          key={evaluation.id}
          evaluation={evaluation}
          currentUserId={currentUserId}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
