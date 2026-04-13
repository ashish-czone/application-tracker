import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Clock, MessageSquare } from 'lucide-react';
import { Button, ConfirmDialog, cn, toast } from '@packages/ui';
import { useEntityEngine } from '@packages/entity-engine-ui';
import { useAuth } from '@packages/auth-ui';
import { formatDateTime } from '@packages/common';

interface Approval {
  id: string;
  offerId: string;
  approverId: string;
  decision: string;
  comment: string | null;
  decidedAt: string | null;
  createdAt: string;
}

interface OfferApprovalPanelProps {
  entity: Record<string, unknown>;
}

const DECISION_STYLES: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  approved: { icon: CheckCircle2, color: 'text-success', label: 'Approved' },
  rejected: { icon: XCircle, color: 'text-destructive', label: 'Rejected' },
  pending: { icon: Clock, color: 'text-warning', label: 'Pending' },
};

export function OfferApprovalPanel({ entity }: OfferApprovalPanelProps) {
  const offerId = entity.id as string;
  const offerStatus = entity.status as string;
  const { user } = useAuth();
  const currentUserId = user?.userId ?? '';
  const { apiFn } = useEntityEngine();
  const queryClient = useQueryClient();
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['offers', offerId, 'approvals'],
    queryFn: () => apiFn.get<Approval[]>(`/offers/${offerId}/approvals`),
  });

  const submitMutation = useMutation({
    mutationFn: (params: { decision: 'approved' | 'rejected'; comment?: string }) =>
      apiFn.post(`/offers/${offerId}/approvals`, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers', offerId, 'approvals'] });
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      toast.success('Decision submitted');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to submit decision');
    },
  });

  const currentUserApproval = useMemo(
    () => approvals.find((a) => a.approverId === currentUserId),
    [approvals, currentUserId],
  );

  const canDecide = currentUserApproval?.decision === 'pending' && offerStatus === 'pending-approval';
  const approvedCount = approvals.filter((a) => a.decision === 'approved').length;
  const totalCount = approvals.length;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-muted mb-3" />
        <div className="space-y-2">
          <div className="h-8 animate-pulse rounded bg-muted" />
          <div className="h-8 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (approvals.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Approval Chain</h3>
          <span className="text-xs text-muted-foreground">
            {approvedCount}/{totalCount} approved
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-success transition-all duration-300"
            style={{ width: `${totalCount > 0 ? (approvedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-border">
        {approvals.map((approval) => {
          const style = DECISION_STYLES[approval.decision] ?? DECISION_STYLES.pending;
          const Icon = style.icon;
          const isCurrentUser = approval.approverId === currentUserId;

          return (
            <div key={approval.id} className={cn('px-4 py-3', isCurrentUser && 'bg-primary/5')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Icon className={cn('h-4 w-4 shrink-0', style.color)} />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {isCurrentUser ? 'You' : `Approver`}
                    </p>
                    {approval.decidedAt && (
                      <p className="text-xs text-muted-foreground">
                        {style.label} {formatDateTime(approval.decidedAt)}
                      </p>
                    )}
                  </div>
                </div>
                <span className={cn('text-xs font-medium', style.color)}>{style.label}</span>
              </div>
              {approval.comment && (
                <div className="mt-2 flex items-start gap-1.5 ml-6.5">
                  <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">{approval.comment}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {canDecide && (
        <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => submitMutation.mutate({ decision: 'approved' })}
            disabled={submitMutation.isPending}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => { setRejectComment(''); setShowRejectDialog(true); }}
            disabled={submitMutation.isPending}
          >
            <XCircle className="h-3.5 w-3.5 mr-1.5" />
            Reject
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        title="Reject offer"
        description="Are you sure you want to reject this offer?"
        confirmLabel="Reject"
        isPending={submitMutation.isPending}
        onConfirm={() => {
          submitMutation.mutate(
            { decision: 'rejected', comment: rejectComment || undefined },
            { onSuccess: () => setShowRejectDialog(false) },
          );
        }}
      >
        <textarea
          value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
          placeholder="Reason for rejection (optional)"
          rows={3}
          className="mt-2 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
        />
      </ConfirmDialog>
    </div>
  );
}
