import { useEffect, useMemo, useState } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { useEntityEngine } from '@packages/entity-engine-ui';
import {
  type ComplianceFrequency,
  type LawGroupKey,
} from '@domains/compliance-contract';
import { LAW_GROUPS, JURISDICTION_OPTIONS, type JurisdictionKey } from './filterOptions';
import { type ComplianceRule } from './types';
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
  rulesQueries,
  useComplianceRulesSummary,
  useCreateComplianceRule,
} from '../../../../hooks/useComplianceRulesApi';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';
import { mapComplianceRuleRecord } from './api/mapComplianceRuleRecord';

type StatusTab = 'all' | ComplianceRule['status'];

const PAGE_LIMIT = 25;

function toCreatePayload(values: NewComplianceRuleValues): Record<string, unknown> | null {
  if (!values.frequency) return null;
  return {
    code: values.code,
    name: values.name,
    lawId: values.lawId,
    frequency: values.frequency,
    description: values.description || undefined,
    dueDayOfMonth: Number(values.dueDayOfMonth),
    dueMonthOffset: Number(values.dueMonthOffset),
    gracePeriodDays: Number(values.gracePeriodDays),
  };
}

export function ComplianceRulesPage() {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deprecating, setDeprecating] = useState<ComplianceRule | null>(null);

  const [lawFilter, setLawFilter] = useState<LawGroupKey[]>([]);
  const [jurisdictionFilter, setJurisdictionFilter] = useState<JurisdictionKey[]>([]);
  const [frequencyFilter, setFrequencyFilter] = useState<ComplianceFrequency[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [statusTab, lawFilter, jurisdictionFilter, frequencyFilter, debouncedSearch]);

  const { apiFn } = useEntityEngine();
  const {
    data: rulesPage,
    isLoading,
    isError,
  } = useQuery(
    rulesQueries(apiFn).list({
      page,
      limit: PAGE_LIMIT,
      status: statusTab === 'all' ? undefined : statusTab,
      lawGroup: lawFilter.length > 0 ? lawFilter.join(',') : undefined,
      jurisdiction: jurisdictionFilter.length > 0 ? jurisdictionFilter.join(',') : undefined,
      frequency: frequencyFilter.length > 0 ? frequencyFilter.join(',') : undefined,
      q: debouncedSearch || undefined,
    }),
  );
  const { data: summary } = useComplianceRulesSummary();

  const createRule = useCreateComplianceRule({ onSuccess: () => setDrawerOpen(false) });

  const rows = useMemo<ComplianceRule[]>(
    () => rulesPage?.data?.map((r) => mapComplianceRuleRecord(r)) ?? [],
    [rulesPage],
  );
  const totalRows = rulesPage?.meta?.total ?? 0;
  const totalPages = rulesPage?.meta?.totalPages ?? 1;

  const totalRules = summary?.total ?? 0;
  const statusCounts = summary?.byStatus ?? { active: 0, draft: 0, deprecated: 0 };

  const lawOptions = LAW_GROUPS.map((g) => ({
    value: g.key,
    label: g.label,
  }));

  const jurisdictionOptions = JURISDICTION_OPTIONS.map((j) => ({
    value: j.value,
    label: j.label,
  }));

  const frequencyOptions = FREQUENCY_OPTIONS.map((f) => ({
    value: f.value,
    label: f.label,
  }));

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

  const ruleColumns = useMemo(
    () =>
      makeComplianceRuleColumns({
        onDeprecate: setDeprecating,
        onEdit: (rule) => navigate(`/compliance-rules/${rule.id}/edit`),
      }),
    [navigate],
  );

  const statusTabs = [
    { value: 'all' as const, label: 'All', count: totalRules },
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
              {totalRules} rules across {LAW_GROUPS.length} law groups — the canonical catalog used
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
            value: String(totalRules),
            unit: 'rules',
            delta: `${LAW_GROUPS.length} law groups`,
            deltaTone: 'neutral',
            accent: 'authority',
            sparklineData: [totalRules, totalRules, totalRules, totalRules, totalRules, totalRules, totalRules],
            sparklineTone: 'authority',
            footnote: 'catalog size',
          },
          {
            label: 'Active',
            value: String(statusCounts.active),
            unit: 'rules',
            delta: `${Math.round((statusCounts.active / Math.max(totalRules, 1)) * 100)}% of catalog`,
            deltaTone: 'neutral',
            accent: 'filed',
            sparklineData: [statusCounts.active, statusCounts.active, statusCounts.active, statusCounts.active, statusCounts.active, statusCounts.active, statusCounts.active],
            sparklineTone: 'filed',
            footnote: `of ${totalRules} total`,
          },
          {
            label: 'In draft',
            value: String(statusCounts.draft),
            unit: 'rules',
            delta: 'awaiting review',
            deltaTone: 'neutral',
            accent: 'due-soon',
            sparklineData: [statusCounts.draft, statusCounts.draft, statusCounts.draft, statusCounts.draft, statusCounts.draft, statusCounts.draft, statusCounts.draft],
            sparklineTone: 'due-soon',
            footnote: 'open for edits',
          },
          {
            label: 'Deprecated',
            value: String(statusCounts.deprecated),
            unit: 'rules',
            delta: 'historical only',
            deltaTone: 'neutral',
            accent: 'authority',
            sparklineData: [statusCounts.deprecated, statusCounts.deprecated, statusCounts.deprecated, statusCounts.deprecated, statusCounts.deprecated, statusCounts.deprecated, statusCounts.deprecated],
            sparklineTone: 'authority',
            footnote: 'no new filings',
          },
        ]}
      >
        <section className="mt-10">
          <CoarseTabs tabs={statusTabs} value={statusTab} onChange={setStatusTab} animated />

          <DataGridShell
            columns={ruleColumns}
            rows={rows}
            getRowKey={(o) => o.id}
            requiredColumns={REQUIRED_COMPLIANCE_RULE_COLUMN_KEYS}
            totalRows={totalRows}
            defaultPageSize={PAGE_LIMIT}
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-3 border-t border-rule mt-2">
              <span className="text-[11px] font-sans tabular-nums text-ink-soft">
                Page {page} of {totalPages} · {totalRows} rules
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1 text-[11px] uppercase tracking-eyebrow font-sans font-medium border border-rule text-ink-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="px-3 py-1 text-[11px] uppercase tracking-eyebrow font-sans font-medium border border-rule text-ink-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </ScreenLayout>

      <AnimatePresence>
        {drawerOpen && (
          <NewComplianceRuleDrawer
            onClose={() => setDrawerOpen(false)}
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
