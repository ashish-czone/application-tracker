import { Smartphone, Monitor, Globe } from 'lucide-react';
import { OrdinalDate } from '../../../../../components';
import type { ActiveSession } from '../placeholders';

export interface SessionCardProps {
  session: ActiveSession;
}

export function SessionCard({ session }: SessionCardProps) {
  const DeviceIcon = session.device.includes('iPhone') || session.device.includes('iPad')
    ? Smartphone
    : Monitor;

  return (
    <div className="flex items-center justify-between px-4 py-3 border border-rule bg-paper">
      <div className="flex items-center gap-3">
        <DeviceIcon className="w-4 h-4 text-ink-muted flex-none" strokeWidth={1.5} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-sans text-ink">{session.device}</span>
            <span className="text-[11px] font-mono text-ink-muted">{session.browser}</span>
            {session.isCurrent && (
              <span className="inline-flex items-center px-1.5 py-[1px] bg-filed/10 border border-filed/30 text-[9px] uppercase tracking-eyebrow font-sans font-semibold text-filed">
                Current
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Globe className="w-3 h-3 text-ink-muted" strokeWidth={1.5} />
            <span className="text-[11px] font-mono text-ink-muted">
              {session.ip} &middot; {session.location}
            </span>
            <span className="text-[11px] text-ink-muted">&middot;</span>
            <OrdinalDate
              date={session.lastActiveAt}
              variant="short"
              className="text-[11px] text-ink-muted"
            />
          </div>
        </div>
      </div>
      {!session.isCurrent && (
        <button
          type="button"
          className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-signal hover:text-signal/80 transition-colors flex-none"
        >
          Revoke
        </button>
      )}
    </div>
  );
}
