import { AuditTimeline } from '@packages/audit-ui';
import { useAuth } from '@packages/auth-ui';

export function ActivityLogSection() {
  const { user, isLoading } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-ink leading-tight">Activity log</h2>
        <p className="mt-1 font-serif italic text-sm text-ink-soft">
          Your recent actions and login history.
        </p>
      </div>

      {isLoading ? (
        <p className="font-mono text-[11px] tracking-tabular text-ink-muted">Loading activity…</p>
      ) : !user ? (
        <p className="font-serif italic text-ink-soft text-sm">
          Sign in to view your activity.
        </p>
      ) : (
        <AuditTimeline actorId={user.userId} />
      )}
    </div>
  );
}
