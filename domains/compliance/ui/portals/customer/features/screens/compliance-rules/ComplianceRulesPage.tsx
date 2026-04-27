import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence } from 'framer-motion';
import { Plus, Upload } from 'lucide-react';
import {
  DataGridShell,
  Button,
  FilterPopover,
  CoarseTabs,
  SearchInput,
  ScreenLayout,
  toast,
  type ActiveFilter,
} from '@packages/ui';
import { useEntityHooks } from '@packages/entity-engine-ui';
import { type ComplianceFrequency } from '@domains/compliance-contract';
import {
  LAW_GROUPS,
  type LawGroupKey,
  type ComplianceRule,
} from './data/complianceRulesMock';
import {
  JURISDICTION_OPTIONS,
  type JurisdictionKey,
} from './data/complianceRuleFilterOptions';
import { FREQUENCY_LABEL, FREQUENCY_OPTIONS } from './components/FrequencyPill';
import {
  makeComplianceRuleColumns,
  REQUIRED_COMPLIANCE_RULE_COLUMN_KEYS,
} from './components/complianceRuleColumns';
import { RuleDeprecationDialog } from './components/RuleDeprecationDialog';
import {
  NewComplianceRuleDrawer,
  type NewComplianceRuleValues,
} from './components/NewComplianceRuleDrawer';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import {
  useComplianceRulesList,
  useLawsLookup,
  type LawRecord,
} from '../../../../../hooks/useComplianceRulesApi';
import { mapComplianceRuleRecord } from './api/mapComplianceRuleRecord';

type StatusTab = 'all' | ComplianceRule['status'];

export function ComplianceRulesPage() {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deprecating, setDeprecating] = useState<ComplianceRule | null>(null);

  const [lawFilter, setLawFilter] = useState<LawGroupKey[]>([]);
  const [jurisdictionFilter, setJurisdictionFilter] = useState<JurisdictionKey[]>([]);
  const [frequencyFilter, setFrequencyFilter] = useState<ComplianceFrequency[]>([]);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');

  const { data: rulesPage, isLoading, isError } = useComplianceRulesList({ limit: 200 });
  const { data: lawsPage } = useLawsLookup();

  const rulesHooks = useEntityHooks('compliance-rules');
  const createRule = rulesHooks.useCreate({ onSuccess: () => setDrawerOpen(false) });

  const lawById = useMemo(() => {
    const map = new Map<string, LawRecord>();
    for (const law of lawsPage?.data ?? []) map.set(law.id, law);
    return map;
  }, [lawsPage]);

  const rows = useMemo<ComplianceRule[]>(() => {
    const records = rulesPage?.data;
    if (!records) return [];
    return records.map((r) => mapComplianceRuleRecord(r, lawById.get(r.lawId)));
  }, [rulesPage, lawById]);

  const statusCounts = useMemo(
    () => ({
      active: rows.filter((r) => r.status === 'active').length,
      draft: rows.filter((r) => r.status === 'draft').length,
      deprecated: rows.filter((r) => r.status === 'deprecated').length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((o) => {
      if (statusTab !== 'all' && o.status !== statusTab) return false;
      if (lawFilter.length > 0 && !lawFilter.includes(o.lawGroup)) return false;
      if (
        jurisdictionFilter.length > 0 &&
        !jurisdictionFilter.includes(o.jurisdiction as JurisdictionKey)
      )
        return false;
      if (frequencyFilter.length > 0 && !frequencyFilter.includes(o.frequency)) return false;
      if (q && !`${o.code} ${o.name} ${o.lawName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, statusTab, lawFilter, jurisdictionFilter, frequencyFilter, search]);

  const activeFilters: ActiveFilter[] = useMemo(() => {
    const chips: ActiveFilter[] = [];
    for (const key of lawFilter) {
      const group = LAW_GROUPS.find((g) => g.key === key);
      chips.push({
        key: `law:${key}`,
        group: 'Law',
        value: group?.label ?? key,
        onRemove: () => setLawFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    for (const key of jurisdictionFilter) {
      chips.push({
        key: `jurisdiction:${key}`,
        group: 'Jurisdiction',
        value: JURISDICTION_OPTIONS.find((j) => j.value === key)?.label ?? key,
        onRemove: () => setJurisdictionFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    for (const key of frequencyFilter) {
      chips.push({
        key: `frequency:${key}`,
        group: 'Cadence',
        value: FREQUENCY_LABEL[key],
        onRemove: () => setFrequencyFilter((prev) => prev.filter((k) => k !== key)),
      });
    }
    return chips;
  }, [lawFilter, jurisdictionFilter, frequencyFilter]);

  const clearAll = () => {
    setLawFilter([]);
    setJurisdictionFilter([]);
    setFrequencyFilter([]);
  };

  const totalRows = rows.length;
  const onTimeRows = rows.filter((o) => o.onTimePct > 0);
  const totalCoverage =
    onTimeRows.length > 0
      ? Math.round(onTimeRows.reduce((acc, o) => acc + o.onTimePct, 0) / onTimeRows.length)
      : 0;
  const totalFilingsThisPeriod = rows.reduce((acc, o) => acc + o.filingsThisPeriod, 0);

  const lawOptions = LAW_GROUPS.map((g) => ({
    value: g.key,
    label: g.label,
    count: g.count,
  }));

  const jurisdictionOptions = JURISDICTION_OPTIONS.map((j) => ({
    value: j.value,
    label: j.label,
    count: rows.filter((o) => o.jurisdiction === j.value).length,
  }));

  const frequencyOptions = FREQUENCY_OPTIONS.map((f) => ({
    value: f.value,
    label: f.label,
    count: rows.filter((o) => o.frequency === f.value).length,
  }));

  const ruleColumns = useMemo(
    () => makeComplianceRuleColumns({
      onDeprecate: setDeprecating,
      onEdit: (rule) => navigate(`/compliance-rules/${rule.id}/edit`),
    }),
    [navigate],
  );

  const statusTabs = [
    { value: 'all' as const, label: 'All', count: totalRows },
    { value: 'active' as const, label: 'Active', count: statusCounts.active },
    { value: 'draft' as const, label: 'Draft', count: statusCounts.draft },
    {
      value: 'deprecated' as const,
      label: 'Deprecated',
      count: statusCounts.deprecated,
    },
  ];

  return (
    <>
      <ScreenLayout
        topBar={<ScreenPreviewTopBar active="compliance-rules" />}
        breadcrumb={['Knowledge base', 'Laws', 'Compliance Rules']}
        title="Compliance Rules"
        subtitle={
          isLoading ? (
            <>Loading rules…</>
          ) : isError ? (
            <span className="text-signal">Failed to load rules. Refresh to retry.</span>
          ) : (
            <>
              {totalRows} rules across {LAW_GROUPS.length} law groups — the canonical catalog used
              to generate filings for every client on roll-over.
            </>
          )
        }
        actions={
          <>
            <Button variant="outline" size="sm">
              <Upload className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
              Import
            </Button>
            <Button size="sm" onClick={() => setDrawerOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
              New rule
            </Button>
          </>
        }
        kpis={[
          {
            label: 'Total rules',
            value: String(totalRows),
            unit: 'rules',
            delta: `${LAW_GROUPS.length} law groups`,
            deltaTone: 'neutral',
            accent: 'authority',
            sparklineData: [72, 75, 78, 82, 83, 85, totalRows],
            sparklineTone: 'authority',
            footnote: 'catalog size',
          },
          {
            label: 'Active',
            value: String(statusCounts.active),
            unit: 'rules',
            delta: '▲ 2 since last review',
            deltaTone: 'positive',
            accent: 'filed',
            sparklineData: [68, 70, 71, 72, 73, 74, statusCounts.active],
            sparklineTone: 'filed',
            footnote: `of ${totalRows} total`,
          },
          {
            label: 'In draft',
            value: String(statusCounts.draft),
            unit: 'rules',
            delta: 'awaiting review',
            deltaTone: 'neutral',
            accent: 'due-soon',
            sparklineData: [4, 6, 7, 8, 6, 5, statusCounts.draft],
            sparklineTone: 'due-soon',
            footnote: 'open for edits',
          },
          {
            label: 'Avg. on-time rate',
            value: `${totalCoverage}`,
            unit: '%',
            delta: '▲ 2.1 vs Q4',
            deltaTone: 'positive',
            accent: 'filed',
            sparklineData: [84, 86, 87, 88, 89, 90, totalCoverage],
            sparklineTone: 'filed',
            footnote: `${totalFilingsThisPeriod} filings this period`,
          },
        ]}
      >
        <section className="mt-10">
          <CoarseTabs tabs={statusTabs} value={statusTab} onChange={setStatusTab} animated />

          <DataGridShell
            columns={ruleColumns}
            rows={filtered}
            getRowKey={(o) => o.id}
            requiredColumns={REQUIRED_COMPLIANCE_RULE_COLUMN_KEYS}
            totalRows={totalRows}
            activeFilters={activeFilters}
            onClearFilters={clearAll}
            filters={
              <>
                <SearchInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search rules…"
                  wrapperClassName="min-w-[200px] max-w-xs flex-1"
                />
                <div className="flex items-center gap-2">
                  <FilterPopover
                    label="Law group"
                    options={lawOptions}
                    value={lawFilter}
                    onChange={(v) => setLawFilter(v as LawGroupKey[])}
                  />
                  <FilterPopover
                    label="Jurisdiction"
                    options={jurisdictionOptions}
                    value={jurisdictionFilter}
                    onChange={(v) => setJurisdictionFilter(v as JurisdictionKey[])}
                  />
                  <FilterPopover
                    label="Cadence"
                    options={frequencyOptions}
                    value={frequencyFilter}
                    onChange={(v) => setFrequencyFilter(v as ComplianceFrequency[])}
                  />
                </div>
              </>
            }
          />
        </section>
      </ScreenLayout>

      <AnimatePresence>
        {drawerOpen && (
          <NewComplianceRuleDrawer
            onClose={() => setDrawerOpen(false)}
            laws={lawsPage?.data ?? []}
            isSubmitting={createRule.isPending}
            onCreate={(values) => {
              const payload = toCreatePayload(values);
              if (!payload) {
                toast.error('Frequency or numeric values are missing');
                return;
              }
              createRule.mutate(payload);
            }}
          />
        )}
      </AnimatePresence>

      {deprecating && (
        <RuleDeprecationDialog
          open
          onOpenChange={(o) => !o && setDeprecating(null)}
          ruleId={deprecating.id}
          ruleLabel={`${deprecating.code} — ${deprecating.name}`}
        />
      )}
    </>
  );
}

function toCreatePayload(values: NewComplianceRuleValues): Record<string, unknown> | null {
  if (!values.frequency) return null;
  const dueDayOfMonth = Number(values.dueDayOfMonth);
  const dueMonthOffset = Number(values.dueMonthOffset);
  const gracePeriodDays = Number(values.gracePeriodDays);
  if (!Number.isFinite(dueDayOfMonth) || dueDayOfMonth < 1 || dueDayOfMonth > 31) return null;
  if (!Number.isFinite(dueMonthOffset)) return null;
  if (!Number.isFinite(gracePeriodDays)) return null;
  return {
    code: values.code,
    name: values.name,
    lawId: values.lawId,
    frequency: values.frequency,
    status: 'draft',
    dueDayOfMonth,
    dueMonthOffset,
    gracePeriodDays,
    description: values.description || undefined,
  };
}
