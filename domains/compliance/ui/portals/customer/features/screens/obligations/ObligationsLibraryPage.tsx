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
  MOCK_OBLIGATIONS,
  OBLIGATION_STATUS_COUNTS,
  type LawGroupKey,
  type Obligation,
  type ObligationFrequency,
} from './data/obligationsMock';
import {
  JURISDICTION_OPTIONS,
  type JurisdictionKey,
} from './data/obligationFilterOptions';
import { FREQUENCY_LABEL, FREQUENCY_OPTIONS } from './components/FrequencyPill';
import {
  OBLIGATION_COLUMNS,
  REQUIRED_OBLIGATION_COLUMN_KEYS,
} from './components/obligationColumns';
import { NewObligationDrawer } from './components/NewObligationDrawer';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';

type StatusTab = 'all' | Obligation['status'];

export function ObligationsLibraryPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [lawFilter, setLawFilter] = useState<LawGroupKey[]>([]);
  const [jurisdictionFilter, setJurisdictionFilter] = useState<JurisdictionKey[]>([]);
  const [frequencyFilter, setFrequencyFilter] = useState<ObligationFrequency[]>([]);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MOCK_OBLIGATIONS.filter((o) => {
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
    MOCK_OBLIGATIONS.reduce((acc, o) => acc + o.onTimePct, 0) / MOCK_OBLIGATIONS.length,
  );
  const totalFilingsThisPeriod = MOCK_OBLIGATIONS.reduce(
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
    count: MOCK_OBLIGATIONS.filter((o) => o.jurisdiction === j.value).length,
  }));

  const frequencyOptions = FREQUENCY_OPTIONS.map((f) => ({
    value: f.value,
    label: f.label,
    count: MOCK_OBLIGATIONS.filter((o) => o.frequency === f.value).length,
  }));

  const statusTabs = [
    { value: 'all' as const, label: 'All', count: MOCK_OBLIGATIONS.length },
    { value: 'active' as const, label: 'Active', count: OBLIGATION_STATUS_COUNTS.active },
    { value: 'draft' as const, label: 'Draft', count: OBLIGATION_STATUS_COUNTS.draft },
    {
      value: 'deprecated' as const,
      label: 'Deprecated',
      count: OBLIGATION_STATUS_COUNTS.deprecated,
    },
  ];

  return (
    <>
      <ScreenLayout
        topBar={<ScreenPreviewTopBar active="obligations" />}
        breadcrumb={['Knowledge base', 'Laws', 'Obligations Library']}
        title="Obligations Library"
        subtitle={
          <>
            {MOCK_OBLIGATIONS.length} rules across {LAW_GROUPS.length} law groups — the canonical
            catalog used to generate filings for every client on roll-over.
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
              New obligation
            </Button>
          </>
        }
        kpis={[
          {
            label: 'Total obligations',
            value: String(MOCK_OBLIGATIONS.length),
            unit: 'rules',
            delta: `${LAW_GROUPS.length} law groups`,
            deltaTone: 'neutral',
            accent: 'authority',
            sparklineData: [72, 75, 78, 82, 83, 85, MOCK_OBLIGATIONS.length],
            sparklineTone: 'authority',
            footnote: 'catalog size',
          },
          {
            label: 'Active',
            value: String(OBLIGATION_STATUS_COUNTS.active),
            unit: 'rules',
            delta: '▲ 2 since last review',
            deltaTone: 'positive',
            accent: 'filed',
            sparklineData: [68, 70, 71, 72, 73, 74, OBLIGATION_STATUS_COUNTS.active],
            sparklineTone: 'filed',
            footnote: `of ${MOCK_OBLIGATIONS.length} total`,
          },
          {
            label: 'In draft',
            value: String(OBLIGATION_STATUS_COUNTS.draft),
            unit: 'rules',
            delta: 'awaiting review',
            deltaTone: 'neutral',
            accent: 'due-soon',
            sparklineData: [4, 6, 7, 8, 6, 5, OBLIGATION_STATUS_COUNTS.draft],
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
            columns={OBLIGATION_COLUMNS}
            rows={filtered}
            getRowKey={(o) => o.id}
            requiredColumns={REQUIRED_OBLIGATION_COLUMN_KEYS}
            totalRows={MOCK_OBLIGATIONS.length}
            activeFilters={activeFilters}
            onClearFilters={clearAll}
            filters={
              <>
                <SearchInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search obligations…"
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
                    onChange={(v) => setFrequencyFilter(v as ObligationFrequency[])}
                  />
                </div>
              </>
            }
          />
        </section>
      </ScreenLayout>

      <AnimatePresence>
        {drawerOpen && <NewObligationDrawer onClose={() => setDrawerOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
