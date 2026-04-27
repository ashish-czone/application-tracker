import { type HTMLAttributes } from 'react';
import { Eyebrow } from '@packages/ui';
import { ColoredInitialsAvatar } from '..';
import type { Client, Law } from '../../types';

export type MatrixCellState = 'none' | 'overdue' | 'due-this-week' | 'filed' | 'upcoming' | 'pending';

export interface ClientLawMatrixProps extends HTMLAttributes<HTMLDivElement> {
  clients: Client[];
  laws: Law[];
  /** Sparse lookup: cell[clientId][lawId] → state + optional period label. */
  cells: Record<string, Record<string, { state: MatrixCellState; period?: string }>>;
  onCellClick?: (client: Client, law: Law) => void;
}

const CELL_STYLE: Record<MatrixCellState, string> = {
  none: 'bg-paper-sunken/50 text-ink-muted/40',
  overdue: 'bg-signal-soft/80 text-signal',
  'due-this-week': 'bg-due-soon-soft/90 text-due-soon',
  filed: 'bg-filed-soft/70 text-filed',
  upcoming: 'bg-paper-raised text-ink-soft',
  pending: 'bg-paper-raised text-ink-muted',
};

const CELL_MARK: Record<MatrixCellState, string> = {
  none: '—',
  overdue: '●',
  'due-this-week': '◆',
  filed: '✓',
  upcoming: '·',
  pending: '○',
};

/**
 * The partner-level oversight view — clients as rows, laws as columns,
 * each cell shows the next filing status at a glance. Clicking a cell
 * opens a drawer with the filing detail (in the demo, it just no-ops).
 */
export function ClientLawMatrix({
  clients,
  laws,
  cells,
  onCellClick,
  className = '',
  ...rest
}: ClientLawMatrixProps) {
  return (
    <div className={`bg-paper-raised border border-rule overflow-hidden ${className}`} {...rest}>
      <div className="px-5 py-3 border-b border-rule">
        <Eyebrow tone="muted">Registration Matrix</Eyebrow>
        <h3 className="font-serif text-2xl text-ink leading-tight mt-0.5">
          Clients{' '}
          <span className="font-serif italic text-ink-soft text-xl">×</span> Laws
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-paper-raised z-10 text-left py-3 px-4 border-b border-r border-rule min-w-[220px]">
                <Eyebrow tone="muted">Client</Eyebrow>
              </th>
              {laws.map((law) => (
                <th
                  key={law.id}
                  className="text-center py-3 px-3 border-b border-r border-rule/60 last:border-r-0 min-w-[88px]"
                >
                  <div className="font-mono text-[11px] text-ink tracking-tabular uppercase">
                    {law.code}
                  </div>
                  <div className="font-serif italic text-[10px] text-ink-muted mt-0.5">
                    {law.jurisdiction}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-b border-rule/60 last:border-b-0">
                <th className="sticky left-0 bg-paper-raised z-10 text-left py-3 px-4 border-r border-rule align-middle">
                  <div className="flex items-center gap-3">
                    <ColoredInitialsAvatar
                      initials={client.initials}
                      color={client.color}
                      size="lg"
                      rounded
                    />
                    <div className="min-w-0">
                      <div className="text-sm text-ink font-sans truncate">{client.name}</div>
                      {client.taxIdentifier && (
                        <div className="text-[10px] font-mono tabular-nums text-ink-muted">
                          {client.taxIdentifier}
                        </div>
                      )}
                    </div>
                  </div>
                </th>
                {laws.map((law) => {
                  const cell = cells[client.id]?.[law.id] ?? { state: 'none' as const };
                  return (
                    <td
                      key={law.id}
                      className="p-0 border-r border-rule/60 last:border-r-0 text-center align-middle"
                    >
                      <button
                        type="button"
                        onClick={() => onCellClick?.(client, law)}
                        className={`w-full h-full min-h-[52px] flex flex-col items-center justify-center gap-0.5 transition-colors hover:brightness-95 ${CELL_STYLE[cell.state]}`}
                      >
                        <span className="text-lg leading-none">{CELL_MARK[cell.state]}</span>
                        {cell.period && (
                          <span className="font-mono tabular-nums text-[9px] opacity-75">
                            {cell.period}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-5 px-5 py-3 border-t border-rule text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
        <span className="flex items-center gap-1.5">
          <span className="text-signal text-base leading-none">●</span> Overdue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-due-soon text-base leading-none">◆</span> Due this week
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-filed text-base leading-none">✓</span> Filed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-ink-muted text-base leading-none">○</span> Pending
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-ink-muted/60 leading-none">—</span> Not registered
        </span>
      </div>
    </div>
  );
}
