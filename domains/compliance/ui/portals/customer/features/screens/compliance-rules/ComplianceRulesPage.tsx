import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus, Upload } from 'lucide-react';
import {
  DataGridShell,
  Button,
  FilterPopover,
  CoarseTabs,
  SearchInput,
  ScreenLayout,
  type ActiveFilter,
} from '@packages/ui';
import {
  LAW_GROUPS,
  MOCK_COMPLIANCE_RULES,
  COMPLIANCE_RULE_STATUS_COUNTS,
  type LawGroupKey,
  type ComplianceRule,
  type ComplianceRuleFrequency,
} from './data/complianceRulesMock';
import {
  JURISDICTION_OPTIONS,
  type JurisdictionKey,
} from './data/complianceRuleFilterOptions';
import { FREQUENCY_LABEL, FREQUENCY_OPTIONS } from './components/FrequencyPill';
import {
  COMPLIANCE_RULE_COLUMNS,
  REQUIRED_COMPLIANCE_RULE_COLUMN_KEYS,
} from './components/complianceRuleColumns';
import { NewComplianceRuleDrawer } from './components/NewComplianceRuleDrawer';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';

type StatusTab = 'all' | ComplianceRule['status'];

export function ComplianceRulesPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [lawFilter, setLawFilter] = useState<LawGroupKey[]>([]);
  const [jurisdictionFilter, setJurisdictionFilter] = useState<JurisdictionKey[]>([]);
  const [frequencyFilter, setFrequencyFilter] = useState<ComplianceRuleFrequency[]>([]);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MOCK_COMPLIANCE_RULES.filter((o) => {
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
  }, [statusTab, lawFilter, jurisdictionFilter, frequencyFilter, search]);

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

  const totalCoverage = Math.round(
    MOCK_COMPLIANCE_RULES.reduce((acc, o) => acc + o.onTimePct, 0) / MOCK_COMPLIANCE_RULES.length,
  );
  const totalFilingsThisPeriod = MOCK_COMPLIANCE_RULES.reduce(
    (acc, o) => acc + o.filingsThisPeriod,
    0,
  );

  const lawOptions = LAW_GROUPS.map((g) => ({
    value: g.key,
    label: g.label,
    count: g.count,
  }));

  const jurisdictionOptions = JURISDICTION_OPTIONS.map((j) => ({
    value: j.value,
    label: j.label,
    count: MOCK_COMPLIANCE_RULES.filter((o) => o.jurisdiction === j.value).length,
  }));

  const frequencyOptions = FREQUENCY_OPTIONS.map((f) => ({
    value: f.value,
    label: f.label,
    count: MOCK_COMPLIANCE_RULES.filter((o) => o.frequency === f.value).length,
  }));

  const statusTabs = [
    { value: 'all' as const, label: 'All', count: MOCK_COMPLIANCE_RULES.length },
    { value: 'active' as const, label: 'Active', count: COMPLIANCE_RULE_STATUS_COUNTS.active },
    { value: 'draft' as const, label: 'Draft', count: COMPLIANCE_RULE_STATUS_COUNTS.draft },
    {
      value: 'deprecated' as const,
      label: 'Deprecated',
      count: COMPLIANCE_RULE_STATUS_COUNTS.deprecated,
    },
  ];

  return (
    <>
      <ScreenLayout
        topBar={<ScreenPreviewTopBar active="compliance-rules" />}
        breadcrumb={['Knowledge base', 'Laws', 'Compliance Rules']}
        title="Compliance Rules"
        subtitle={
          <>
            {MOCK_COMPLIANCE_RULES.length} rules across {LAW_GROUPS.length} law groups — the
            canonical catalog used to generate filings for every client on roll-over.
          </>
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
            value: String(MOCK_COMPLIANCE_RULES.length),
            unit: 'rules',
            delta: `${LAW_GROUPS.length} law groups`,
            deltaTone: 'neutral',
            accent: 'authority',
            sparklineData: [72, 75, 78, 82, 83, 85, MOCK_COMPLIANCE_RULES.length],
            sparklineTone: 'authority',
            footnote: 'catalog size',
          },
          {
            label: 'Active',
            value: String(COMPLIANCE_RULE_STATUS_COUNTS.active),
            unit: 'rules',
            delta: '▲ 2 since last review',
            deltaTone: 'positive',
            accent: 'filed',
            sparklineData: [68, 70, 71, 72, 73, 74, COMPLIANCE_RULE_STATUS_COUNTS.active],
            sparklineTone: 'filed',
            footnote: `of ${MOCK_COMPLIANCE_RULES.length} total`,
          },
          {
            label: 'In draft',
            value: String(COMPLIANCE_RULE_STATUS_COUNTS.draft),
            unit: 'rules',
            delta: 'awaiting review',
            deltaTone: 'neutral',
            accent: 'due-soon',
            sparklineData: [4, 6, 7, 8, 6, 5, COMPLIANCE_RULE_STATUS_COUNTS.draft],
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
            columns={COMPLIANCE_RULE_COLUMNS}
            rows={filtered}
            getRowKey={(o) => o.id}
            requiredColumns={REQUIRED_COMPLIANCE_RULE_COLUMN_KEYS}
            totalRows={MOCK_COMPLIANCE_RULES.length}
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
                    onChange={(v) => setFrequencyFilter(v as ComplianceRuleFrequency[])}
                  />
                </div>
              </>
            }
          />
        </section>
      </ScreenLayout>

      <AnimatePresence>
        {drawerOpen && <NewComplianceRuleDrawer onClose={() => setDrawerOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
