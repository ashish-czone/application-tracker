import { AvatarBadge } from '@packages/ui';
import { ColoredInitialsAvatar } from '../../../../../components';
import type { ClientRow } from '../types';
import { RiskPill } from './RiskPill';

export interface ClientPreviewPopoverProps {
  client: ClientRow;
  anchorRect: DOMRect | null;
}

export function ClientPreviewPopover({ client, anchorRect }: ClientPreviewPopoverProps) {
  if (!anchorRect) return null;

  const top = anchorRect.bottom + 6;
  const left = Math.max(16, anchorRect.left);
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 900;
  const wouldOverflow = top + 200 > viewportH;
  const finalTop = wouldOverflow ? anchorRect.top - 206 : top;

  return (
    <div
      className="fixed z-50 w-[320px] border border-rule bg-paper-raised shadow-lg"
      style={{ top: finalTop, left }}
    >
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <ColoredInitialsAvatar initials={client.initials} color={client.color} size="xl" />
          <div className="min-w-0">
            <div className="text-sm font-sans font-medium text-ink leading-snug truncate">
              {client.name}
            </div>
            <div className="font-serif italic text-[11px] text-ink-muted truncate">
              {client.legalName}
            </div>
          </div>
        </div>

        <div className="font-mono text-[10px] tracking-wide text-ink-muted mb-3">
          {client.taxIdentifier}
        </div>

        <div className="grid grid-cols-3 gap-px bg-rule border border-rule mb-3">
          <div className="bg-paper-raised p-2 text-center">
            <div className="font-mono text-sm tabular-nums text-ink">
              {client.openFilings || '—'}
            </div>
            <div className="text-[9px] uppercase tracking-eyebrow font-sans text-ink-muted mt-0.5">
              Open
            </div>
          </div>
          <div className="bg-paper-raised p-2 text-center">
            <div
              className={`font-mono text-sm tabular-nums ${
                client.overdueFilings > 0 ? 'text-signal' : 'text-ink'
              }`}
            >
              {client.overdueFilings || '—'}
            </div>
            <div className="text-[9px] uppercase tracking-eyebrow font-sans text-ink-muted mt-0.5">
              Overdue
            </div>
          </div>
          <div className="bg-paper-raised p-2 text-center">
            <div className="font-mono text-sm tabular-nums text-ink">
              {client.onTimePct > 0 ? `${client.onTimePct}%` : '—'}
            </div>
            <div className="text-[9px] uppercase tracking-eyebrow font-sans text-ink-muted mt-0.5">
              On-time
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          {client.status === 'active' ? (
            <RiskPill risk={client.risk} />
          ) : (
            <span className="text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted">
              {client.status}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <AvatarBadge initials={client.primaryHandler.initials} size="xs" />
            <span className="text-[11px] font-sans text-ink-soft">
              {client.primaryHandler.name.split(' ')[0]}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-rule px-4 py-2">
        <span className="text-[10px] font-sans text-ink-muted">
          Click row to view full profile →
        </span>
      </div>
    </div>
  );
}
