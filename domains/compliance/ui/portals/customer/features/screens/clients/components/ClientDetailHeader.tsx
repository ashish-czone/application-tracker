import { Building2, Calendar } from 'lucide-react';
import { OrdinalDate, Pill } from '../../../../../../components';
import type { MOCK_CLIENT_DETAIL } from '../data/clientDetailMock';
import { RiskPill } from './RiskPill';

type ClientDetail = typeof MOCK_CLIENT_DETAIL;

export interface ClientDetailHeaderProps {
  client: ClientDetail;
}

export function ClientDetailHeader({ client }: ClientDetailHeaderProps) {
  return (
    <div className="border border-rule bg-paper-raised p-6 mb-6">
      <div className="flex items-start gap-5">
        <span
          aria-hidden
          className="w-14 h-14 flex-none flex items-center justify-center text-lg font-sans font-semibold text-paper-raised"
          style={{ backgroundColor: client.color }}
        >
          {client.initials}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl text-ink leading-none">{client.name}</h1>
            <RiskPill risk={client.risk} />
            <Pill>{client.status}</Pill>
          </div>
          <p className="font-serif italic text-ink-soft mt-1">{client.legalName}</p>
          <div className="flex items-center gap-6 mt-3">
            <span className="font-mono text-[11px] text-ink-muted tracking-wide">
              {client.taxIdentifier}
            </span>
            <span className="text-[11px] text-ink-muted font-sans flex items-center gap-1">
              <Building2 className="w-3 h-3" strokeWidth={1.5} />
              {client.industry}
            </span>
            <span className="text-[11px] text-ink-muted font-sans flex items-center gap-1">
              <Calendar className="w-3 h-3" strokeWidth={1.5} />
              Since{' '}
              <OrdinalDate
                date={client.onboardedDate}
                variant="short"
                className="text-[11px] inline"
              />
            </span>
          </div>
        </div>

        <div className="flex-none flex gap-6 text-center">
          <div>
            <div className="font-mono text-2xl tabular-nums text-ink">{client.openFilings}</div>
            <div className="text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted mt-0.5">
              Open
            </div>
          </div>
          <div>
            <div
              className={`font-mono text-2xl tabular-nums ${client.overdueFilings > 0 ? 'text-signal' : 'text-ink'}`}
            >
              {client.overdueFilings}
            </div>
            <div className="text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted mt-0.5">
              Overdue
            </div>
          </div>
          <div>
            <div className="font-mono text-2xl tabular-nums text-ink">{client.onTimePct}%</div>
            <div className="text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted mt-0.5">
              On-time
            </div>
          </div>
          <div>
            <div className="font-mono text-2xl tabular-nums text-ink">{client.registeredLaws}</div>
            <div className="text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted mt-0.5">
              Laws
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
