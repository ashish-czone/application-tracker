import { useState, useCallback, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@packages/ui';
import { useAuth } from '@packages/platform-ui/auth/hooks/useAuth';
import {
  useEvaluations,
  useCreateEvaluation,
  useUpdateEvaluation,
  useDeleteEvaluation,
} from '../hooks';
import type { EvaluationWithScores } from '../types';
import { EvaluationForm, type EvaluationFormValues } from './EvaluationForm';
import { EvaluationsList } from './EvaluationsList';
import { EvaluationSummary } from './EvaluationSummary';

interface EvaluationsSectionProps {
  entityType: string;
  entityId: string;
}

export function EvaluationsSection({ entityType, entityId }: EvaluationsSectionProps) {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<EvaluationWithScores | null>(null);
  const { user } = useAuth();

  const { data, isLoading } = useEvaluations(entityType, entityId, page);
  const createMutation = useCreateEvaluation();
  const updateMutation = useUpdateEvaluation();
  const deleteMutation = useDeleteEvaluation();

  const evaluations = data?.data ?? [];
  const meta = data?.meta;

  // Compute summary from loaded evaluations
  const summary = useMemo(() => {
    if (evaluations.length === 0) return { average: null, count: 0 };
    const total = evaluations.reduce((sum, e) => sum + e.overallRating, 0);
    return {
      average: total / evaluations.length,
      count: meta?.total ?? evaluations.length,
    };
  }, [evaluations, meta]);

  const handleCreate = useCallback((data: EvaluationFormValues) => {
    createMutation.mutate(
      { ...data, entityType, entityId },
      {
        onSuccess: () => {
          setShowForm(false);
        },
      },
    );
  }, [createMutation, entityType, entityId]);

  const handleUpdate = useCallback((data: EvaluationFormValues) => {
    if (!editingEvaluation) return;
    updateMutation.mutate(
      { id: editingEvaluation.id, data },
      {
        onSuccess: () => {
          setEditingEvaluation(null);
        },
      },
    );
  }, [updateMutation, editingEvaluation]);

  const handleEdit = useCallback((evaluation: EvaluationWithScores) => {
    setEditingEvaluation(evaluation);
    setShowForm(false);
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingEvaluation(null);
  }, []);

  if (!user) return null;

  const hasNextPage = meta ? meta.page < meta.totalPages : false;
  const hasPrevPage = page > 1;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <EvaluationSummary averageRating={summary.average} count={summary.count} />

      {/* Add button */}
      {!showForm && !editingEvaluation && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Evaluation
        </Button>
      )}

      {/* New evaluation form */}
      {showForm && (
        <EvaluationForm
          entityType={entityType}
          entityId={entityId}
          onSubmit={handleCreate}
          onCancel={handleCancel}
          isSubmitting={createMutation.isPending}
        />
      )}

      {/* Edit form */}
      {editingEvaluation && (
        <EvaluationForm
          entityType={entityType}
          entityId={entityId}
          onSubmit={handleUpdate}
          onCancel={handleCancel}
          isSubmitting={updateMutation.isPending}
          editingEvaluation={editingEvaluation}
        />
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-4 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-12 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EvaluationsList
          evaluations={evaluations}
          currentUserId={user.userId}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages} ({meta.total} evaluations)
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={!hasPrevPage}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNextPage}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
