import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronUp, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@packages/ui';
import type { EvaluationWithScores } from '../types';
import { RECOMMENDATION_OPTIONS } from '../types';
import { StarRating } from './StarRating';

interface EvaluationItemProps {
  evaluation: EvaluationWithScores;
  currentUserId: string;
  onEdit: (evaluation: EvaluationWithScores) => void;
  onDelete: (id: string) => void;
}

export function EvaluationItem({ evaluation, currentUserId, onEdit, onDelete }: EvaluationItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isAuthor = evaluation.evaluatorId === currentUserId;
  const evaluator = evaluation.evaluator;
  const initials = evaluator
    ? `${evaluator.firstName?.[0] ?? ''}${evaluator.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';
  const authorName = evaluator
    ? `${evaluator.firstName} ${evaluator.lastName}`.trim()
    : 'Unknown';
  const timeAgo = formatDistanceToNow(new Date(evaluation.createdAt), { addSuffix: true });

  return (
    <div className="py-4">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {initials}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground">{authorName}</span>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>

          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StarRating value={evaluation.overallRating} size="sm" />
            <span className="text-sm font-medium">{evaluation.overallRating}/5</span>
            {evaluation.recommendation && (() => {
              const rec = RECOMMENDATION_OPTIONS.find((r) => r.value === evaluation.recommendation);
              return rec ? (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${rec.color}`}>
                  {rec.label}
                </span>
              ) : null;
            })()}
            {evaluation.template && (
              <span className="text-xs text-muted-foreground">
                ({evaluation.template.name})
              </span>
            )}
          </div>

          {evaluation.comment && (
            <p className="text-sm text-muted-foreground mt-1">{evaluation.comment}</p>
          )}

          {/* Expandable criteria scores */}
          {evaluation.scores.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {expanded ? 'Hide' : 'Show'} criteria ({evaluation.scores.length})
              </button>
              {expanded && (
                <div className="mt-2 space-y-1.5 pl-1">
                  {evaluation.scores.map((score) => (
                    <div key={score.id} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-32 truncate">
                        {score.criteriaName}
                      </span>
                      <StarRating value={score.score} size="sm" />
                      {score.note && (
                        <span className="text-xs text-muted-foreground italic truncate">
                          {score.note}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {isAuthor && (
          <div className="flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(evaluation)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete evaluation"
        description="Are you sure you want to delete this evaluation? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          onDelete(evaluation.id);
          setShowDeleteConfirm(false);
        }}
      />
    </div>
  );
}
