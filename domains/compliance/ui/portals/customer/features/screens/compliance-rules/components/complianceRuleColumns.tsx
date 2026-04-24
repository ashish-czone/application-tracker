import { Button, type DataTableColumn } from '@packages/ui';
import { HealthBar, JurisdictionTag, HandlerPill } from '../../../../../../components';
import type { ComplianceRule } from '../data/complianceRulesMock';
import { FrequencyPill } from './FrequencyPill';

const STATUS_TONE: Record<ComplianceRule['status'], string> = {
  active: 'bg-filed',
  draft: 'bg-due-soon',
  deprecated: 'bg-ink-muted',
};

export const REQUIRED_COMPLIANCE_RULE_COLUMN_KEYS: string[] = ['code', 'name'];

export interface ComplianceRuleColumnsOptions {
  onDeprecate: (rule: ComplianceRule) => void;
  onEdit: (rule: ComplianceRule) => void;
}

export function makeComplianceRuleColumns({
  onDeprecate,
  onEdit,
}: ComplianceRuleColumnsOptions): DataTableColumn<ComplianceRule>[] {
  return [...BASE_COMPLIANCE_RULE_COLUMNS, {
    key: 'actions',
    header: '',
    width: '160px',
    align: 'right',
    cell: (o) => (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-ink-muted hover:text-ink"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(o);
          }}
        >
          Edit
        </Button>
        {o.status !== 'deprecated' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-ink-muted hover:text-signal"
            onClick={(e) => {
              e.stopPropagation();
              onDeprecate(o);
            }}
          >
            Deprecate
          </Button>
        )}
      </div>
    ),
  }];
}

const BASE_COMPLIANCE_RULE_COLUMNS: DataTableColumn<ComplianceRule>[] = [
  {
    key: 'code',
    header: 'Code',
    width: '110px',
    cell: (o) => (
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          title={o.status}
          className={`w-1.5 h-1.5 flex-none ${STATUS_TONE[o.status]}`}
        />
        <span className="font-mono text-[11px] tracking-tabular uppercase text-ink">{o.code}</span>
      </div>
    ),
  },
  {
    key: 'name',
    header: 'Rule',
    cell: (o) => (
      <div className="flex flex-col min-w-0">
        <span className="text-sm text-ink font-sans leading-snug truncate">{o.name}</span>
        <span className="font-serif italic text-[11px] text-ink-muted truncate">
          {o.description}
        </span>
      </div>
    ),
  },
  {
    key: 'law',
    header: 'Law',
    width: '130px',
    cell: (o) => (
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-ink-muted tracking-tabular uppercase">
          {o.lawCode}
        </span>
        <JurisdictionTag jurisdiction={o.jurisdiction} />
      </div>
    ),
  },
  {
    key: 'frequency',
    header: 'Cadence',
    width: '100px',
    cell: (o) => <FrequencyPill frequency={o.frequency} />,
  },
  {
    key: 'applicable',
    header: 'Applies to',
    width: '110px',
    align: 'right',
    cell: (o) => (
      <div className="flex items-baseline justify-end gap-1.5">
        <span className="font-mono text-sm tabular-nums text-ink">{o.applicableClients}</span>
        <span className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
          clients
        </span>
      </div>
    ),
  },
  {
    key: 'health',
    header: 'On-time rate',
    width: '150px',
    cell: (o) => <HealthBar pct={o.onTimePct} />,
  },
  {
    key: 'owner',
    header: 'Owner',
    width: '110px',
    cell: (o) => <HandlerPill initials={o.owner.initials} name={o.owner.name} />,
  },
];
