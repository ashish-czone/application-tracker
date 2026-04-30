import { Mail, Phone, MapPin, AlertTriangle, FileText, Plus, UserPlus } from 'lucide-react';
import { ActivityTimeline, AvatarBadge } from '@packages/ui';
import { OrdinalDate } from '../../../../../components';
import type { ClientDetail } from '../types';
import { InfoRow } from './InfoRow';
import { CLIENT_ACTIVITY_ICONS } from './clientActivityIcons';

export interface ClientDetailOverviewProps {
  client: ClientDetail;
}

const QUICK_ACTIONS = [
  { label: 'View all filings', icon: FileText },
  { label: 'Add law registration', icon: Plus },
  { label: 'Change handler', icon: UserPlus },
];

export function ClientDetailOverview({ client }: ClientDetailOverviewProps) {
  const snapshotStats = [
    { label: 'Total filings', value: String(client.totalFilings) },
    { label: 'Filed on time', value: String(client.filedOnTime) },
    { label: 'Filed this month', value: String(client.filedThisMonth) },
    { label: 'On-time rate', value: `${client.onTimePct}%` },
  ];

  return (
    <div className="grid grid-cols-[1fr_340px] gap-6">
      <div className="space-y-6">
        <section className="border border-rule bg-paper-raised p-5">
          <h3 className="text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted mb-3">
            Entity details
          </h3>
          <InfoRow label="Legal name">{client.legalName}</InfoRow>
          <InfoRow label="Tax ID">
            <span className="font-mono text-[12px] tracking-wide">{client.taxIdentifier}</span>
          </InfoRow>
          <InfoRow label="Industry">{client.industry}</InfoRow>
          <InfoRow label="Address">
            <span className="flex items-start gap-1.5">
              <MapPin className="w-3 h-3 mt-0.5 flex-none text-ink-muted" strokeWidth={1.5} />
              {client.address}
            </span>
          </InfoRow>
          <InfoRow label="Handler">
            <div className="flex items-center gap-2">
              <AvatarBadge initials={client.primaryHandler.initials} size="sm" />
              <span className="text-sm text-ink">{client.primaryHandler.name}</span>
              {client.primaryHandler.role && (
                <span className="text-[11px] text-ink-muted">· {client.primaryHandler.role}</span>
              )}
            </div>
          </InfoRow>
          <InfoRow label="Onboarded">
            <OrdinalDate date={client.onboardedDate} variant="long" className="text-sm" />
          </InfoRow>
        </section>

        <section className="border border-rule bg-paper-raised p-5">
          <h3 className="text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted mb-3">
            Contacts
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-sans font-medium text-ink">
                  {client.primaryContact.name}
                </span>
                <span className="text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted border border-rule px-1.5 py-[1px]">
                  Primary
                </span>
              </div>
              <p className="text-[11px] text-ink-muted font-sans mb-1.5">
                {client.primaryContact.designation}
              </p>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-[11px] text-ink-soft font-sans">
                  <Mail className="w-3 h-3" strokeWidth={1.5} />
                  {client.primaryContact.email}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-ink-soft font-sans">
                  <Phone className="w-3 h-3" strokeWidth={1.5} />
                  {client.primaryContact.phone}
                </span>
              </div>
            </div>
            {client.secondaryContact && (
              <div className="pt-3 border-t border-rule">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-sans font-medium text-ink">
                    {client.secondaryContact.name}
                  </span>
                  <span className="text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted border border-rule px-1.5 py-[1px]">
                    Secondary
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted font-sans mb-1.5">
                  {client.secondaryContact.designation}
                </p>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-[11px] text-ink-soft font-sans">
                    <Mail className="w-3 h-3" strokeWidth={1.5} />
                    {client.secondaryContact.email}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-ink-soft font-sans">
                    <Phone className="w-3 h-3" strokeWidth={1.5} />
                    {client.secondaryContact.phone}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="border border-rule bg-paper-raised p-5">
          <h3 className="text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted mb-3">
            Compliance snapshot
          </h3>
          <div className="grid grid-cols-4 gap-px bg-rule">
            {snapshotStats.map((stat) => (
              <div key={stat.label} className="bg-paper-raised p-3 text-center">
                <div className="font-mono text-lg tabular-nums text-ink">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-6">
        {client.overdueFilings > 0 && (
          <div className="border border-signal/40 bg-signal/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-signal" strokeWidth={2} />
              <span className="text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-signal">
                Action required
              </span>
            </div>
            <p className="text-sm text-ink font-sans">
              {client.overdueFilings} filing{client.overdueFilings !== 1 ? 's' : ''} overdue. Review
              and file immediately to avoid penalties.
            </p>
          </div>
        )}

        {client.recentActivity.length > 0 && (
          <section className="border border-rule bg-paper-raised p-5">
            <h3 className="text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted mb-4">
              Recent activity
            </h3>
            <ActivityTimeline
              events={client.recentActivity}
              iconConfig={CLIENT_ACTIVITY_ICONS}
              variant="feed"
            />
          </section>
        )}

        <section className="border border-rule bg-paper-raised p-5">
          <h3 className="text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted mb-3">
            Quick actions
          </h3>
          <div className="space-y-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-sans text-ink-soft hover:text-ink hover:bg-paper border border-transparent hover:border-rule transition-colors text-left"
              >
                <action.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                {action.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
