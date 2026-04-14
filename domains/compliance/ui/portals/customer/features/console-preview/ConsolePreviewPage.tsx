import { useState } from 'react';
import {
  Search,
  Command as CommandIcon,
  Plus,
  FileText,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  Building2,
  Calendar,
  Users,
} from 'lucide-react';
import {
  PageMasthead,
  SectionRule,
  Eyebrow,
  MetricKPI,
  StatusDonut,
  DataTable,
  FilterBar,
  HierarchyTreeView,
  EmptyState,
  CommandPalette,
  UrgencyBadge,
  JurisdictionTag,
  OrdinalDate,
  StampMark,
  type DataTableColumn,
  type FilterChip,
  type CommandGroup,
} from '@packages/ui';
import {
  LawCard,
  FilingTaskCard,
  FilingTimeline,
  ComplianceCalendar,
  ClientLawMatrix,
  HandlerWorkloadList,
  BulkFilingDrawer,
  type Filing,
} from '../../../../shared';
import {
  PREVIEW_TODAY,
  MOCK_FILINGS,
  MOCK_LAWS,
  MOCK_CLIENTS,
  MOCK_WORKLOADS,
  MOCK_MATRIX_CELLS,
  MOCK_GST_HIERARCHY,
} from './mockData';

const FILTER_CHIPS_INITIAL: FilterChip[] = [
  { key: 'overdue', label: 'Overdue', active: true, tone: 'signal' },
  { key: 'this-week', label: 'Due this week', active: true, tone: 'due-soon' },
  { key: 'gst', label: 'Law: GST', tone: 'authority' },
  { key: 'priya', label: 'Handler: Priya', tone: 'authority' },
  { key: 'central', label: 'Central', tone: 'ink' },
];

const COMMAND_GROUPS: CommandGroup[] = [
  {
    id: 'nav',
    heading: 'Navigate',
    items: [
      { id: 'n1', label: 'Compliance Console', hint: 'G C', icon: <Building2 className="w-4 h-4" /> },
      { id: 'n2', label: 'Clients', hint: 'G L', icon: <Users className="w-4 h-4" /> },
      { id: 'n3', label: 'Filing Calendar', hint: 'G F', icon: <Calendar className="w-4 h-4" /> },
      { id: 'n4', label: 'Laws Library', hint: 'G W', icon: <BookOpen className="w-4 h-4" /> },
    ],
  },
  {
    id: 'create',
    heading: 'Create',
    items: [
      { id: 'c1', label: 'New client', hint: '⌘N', icon: <Plus className="w-4 h-4" /> },
      { id: 'c2', label: 'Register client under law', hint: '⌘⇧R', icon: <FileText className="w-4 h-4" /> },
      { id: 'c3', label: 'New compliance rule', hint: '⌘⇧N', icon: <FileText className="w-4 h-4" /> },
    ],
  },
  {
    id: 'action',
    heading: 'Actions',
    items: [
      { id: 'a1', label: 'Mark filings filed…', hint: 'F', icon: <CheckCircle2 className="w-4 h-4" /> },
      { id: 'a2', label: 'Generate next 6 months', hint: 'R', icon: <Calendar className="w-4 h-4" /> },
    ],
  },
  {
    id: 'help',
    heading: 'Help',
    items: [
      { id: 'h1', label: 'Keyboard shortcuts', hint: '?', icon: <HelpCircle className="w-4 h-4" /> },
      { id: 'h2', label: 'What\'s new', icon: <HelpCircle className="w-4 h-4" /> },
    ],
  },
];

const FILING_COLUMNS: DataTableColumn<Filing>[] = [
  {
    key: 'status',
    header: 'Status',
    width: '170px',
    cell: (f) => <UrgencyBadge urgency={f.status} />,
  },
  {
    key: 'client',
    header: 'Client',
    cell: (f) => (
      <div className="flex flex-col">
        <span className="text-ink font-sans">{f.clientName}</span>
        <span className="font-serif italic text-[11px] text-ink-muted">{f.periodLabel}</span>
      </div>
    ),
  },
  {
    key: 'law',
    header: 'Law',
    cell: (f) => (
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-ink-muted tracking-tabular uppercase">
          {f.lawCode}
        </span>
        <JurisdictionTag jurisdiction={f.jurisdiction} />
      </div>
    ),
  },
  {
    key: 'rule',
    header: 'Rule',
    cell: (f) => <span className="text-ink-soft">{f.ruleName}</span>,
  },
  {
    key: 'due',
    header: 'Due',
    align: 'left',
    cell: (f) => <OrdinalDate date={f.dueDate} variant="short" className="text-sm" />,
  },
  {
    key: 'handler',
    header: 'Handler',
    width: '170px',
    cell: (f) =>
      f.handler ? (
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="w-6 h-6 flex items-center justify-center text-[10px] font-sans font-semibold bg-authority text-paper-raised"
          >
            {f.handler.initials}
          </span>
          <span className="text-sm text-ink">{f.handler.name}</span>
        </div>
      ) : (
        <span className="text-ink-muted italic font-serif">unassigned</span>
      ),
  },
];

export function ConsolePreviewPage() {
  const [chips, setChips] = useState<FilterChip[]>(FILTER_CHIPS_INITIAL);
  const [search, setSearch] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);

  const toggleChip = (key: string) =>
    setChips((c) => c.map((chip) => (chip.key === key ? { ...chip, active: !chip.active } : chip)));

  const dueTodayFilings = MOCK_FILINGS.filter(
    (f) => f.status === 'due-today' || f.status === 'overdue',
  ).slice(0, 3);

  const filingsToFile = MOCK_FILINGS.filter((f) => f.status === 'due-today' || f.status === 'due-this-week').slice(
    0,
    4,
  );

  const donutSegments = [
    { key: 'filed', label: 'Filed', value: 68, color: 'hsl(var(--filed))' },
    { key: 'due', label: 'Due', value: 22, color: 'hsl(var(--due-soon))' },
    { key: 'overdue', label: 'Overdue', value: 10, color: 'hsl(var(--signal))' },
  ];

  // Trim filings list for table so DataTable doesn't overflow demo
  const tableRows = MOCK_FILINGS.slice(0, 12);

  return (
    <div className="min-h-screen bg-paper paper-grain">
      {/* Atmospheric header bar — thin, editorial. Replaces a traditional app chrome. */}
      <div className="border-b border-rule bg-paper-raised">
        <div className="max-w-[1480px] mx-auto px-10 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-serif text-2xl italic text-ink leading-none">
              Compliance<span className="text-signal">.</span>
            </span>
            <nav className="flex items-center gap-6 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-soft">
              <a className="text-ink border-b border-ink pb-0.5">Console</a>
              <a className="hover:text-ink">Clients</a>
              <a className="hover:text-ink">Laws</a>
              <a className="hover:text-ink">Filings</a>
              <a className="hover:text-ink">Reports</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 border border-rule hover:border-ink text-[11px] text-ink-muted hover:text-ink font-sans transition-colors group"
            >
              <Search className="w-3 h-3" strokeWidth={1.5} />
              <span>Search or command</span>
              <span className="ml-4 flex items-center gap-0.5 font-mono text-[10px] text-ink-muted/80">
                <CommandIcon className="w-3 h-3" strokeWidth={1.5} />K
              </span>
            </button>
            <div className="flex items-center gap-2 pl-4 border-l border-rule">
              <span
                aria-hidden
                className="w-7 h-7 bg-authority text-paper-raised text-[10px] font-sans font-semibold flex items-center justify-center"
              >
                AG
              </span>
              <div className="text-right">
                <div className="text-xs text-ink font-sans leading-none">Ashish Goel</div>
                <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans mt-0.5">
                  Partner
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1480px] mx-auto px-10 pb-24">
        {/* §  MASTHEAD  ─────────────────────────────────────────────────── */}
        <PageMasthead
          sectionMark="§ I"
          eyebrow="Partner Desk — April 2026"
          title={
            <>
              The Compliance <span className="italic">Console</span>
            </>
          }
          subtitle="Every filing, every client, every law — at one desk."
          date={PREVIEW_TODAY}
        />

        {/* §  KPI ROW  ──────────────────────────────────────────────────── */}
        <section className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-rule border border-rule">
          <MetricKPI
            label="Overdue"
            value="12"
            unit="filings"
            delta="▲ 3 since yesterday"
            deltaTone="negative"
            accent="signal"
            sparklineData={[4, 6, 5, 9, 8, 11, 12]}
            sparklineTone="signal"
            footnote="across 9 clients"
            index={0}
          />
          <MetricKPI
            label="Due this week"
            value="28"
            unit="filings"
            delta="— no change"
            deltaTone="neutral"
            accent="due-soon"
            sparklineData={[22, 19, 25, 27, 30, 28, 28]}
            sparklineTone="due-soon"
            footnote="11 today + 17 ahead"
            index={1}
          />
          <MetricKPI
            label="Active clients"
            value="147"
            unit=""
            delta="▲ 4 this quarter"
            deltaTone="positive"
            accent="authority"
            sparklineData={[130, 134, 138, 140, 142, 145, 147]}
            sparklineTone="authority"
            footnote="62 registered under GST"
            index={2}
          />
          <MetricKPI
            label="Filings · Q4"
            value="412"
            unit=""
            delta="▲ 18% vs Q3"
            deltaTone="positive"
            accent="filed"
            sparklineData={[310, 330, 345, 370, 385, 398, 412]}
            sparklineTone="filed"
            footnote="68% already stamped"
            index={3}
          />
        </section>

        {/* §  CALENDAR + SIDE RAIL  ─────────────────────────────────────── */}
        <section className="mt-12 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <ComplianceCalendar filings={MOCK_FILINGS} month={PREVIEW_TODAY} />
          </div>
          <aside className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            <div className="bg-paper-raised border border-rule p-5">
              <Eyebrow tone="muted">Filing Progress</Eyebrow>
              <h3 className="font-serif text-xl text-ink leading-tight mt-0.5 mb-5">Q4 FY 2025-26</h3>
              <StatusDonut
                segments={donutSegments}
                centerValue="68%"
                centerLabel="Filed"
                size={196}
              />
            </div>
            <HandlerWorkloadList workloads={MOCK_WORKLOADS} />
          </aside>
        </section>

        {/* §  II — THIS WEEK TIMELINE  ──────────────────────────────────── */}
        <section className="mt-16">
          <SectionRule label="§ II — The Next Fortnight" align="left" />
          <div className="mt-4">
            <FilingTimeline filings={MOCK_FILINGS} start={PREVIEW_TODAY} days={14} />
          </div>
        </section>

        {/* §  III — FILINGS TABLE + RIGHT RAIL  ─────────────────────────── */}
        <section className="mt-16 grid grid-cols-12 gap-6">
          <div className="col-span-12 xl:col-span-8">
            <SectionRule label="§ III — Filings Desk" align="left" />
            <div className="mt-4 bg-paper-raised border border-rule">
              <FilterBar
                chips={chips.map((c) => ({ ...c, onClick: () => toggleChip(c.key) }))}
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search client, law, rule…"
                savedView="Partner — weekly"
                resultCount={`${tableRows.length} of ${MOCK_FILINGS.length}`}
                onClearAll={() => setChips((c) => c.map((chip) => ({ ...chip, active: false })))}
                className="px-5 border-y-0"
              />
              <DataTable
                columns={FILING_COLUMNS}
                rows={tableRows}
                getRowKey={(f) => f.id}
                onRowClick={() => {}}
                staggerReveal
                rowOverlay={(f) =>
                  f.status === 'filed' ? <StampMark kind="filed" size="sm" sub={f.periodLabel} /> : null
                }
              />
            </div>
          </div>

          <aside className="col-span-12 xl:col-span-4">
            <SectionRule label="§ Today's Brief" align="left" />
            <div className="mt-4 flex flex-col gap-3">
              <div className="bg-paper-raised border border-rule p-5 pb-4">
                <Eyebrow tone="signal" mark="●">
                  Requires Partner Sign-off
                </Eyebrow>
                <h4 className="font-serif text-2xl text-ink leading-tight mt-1 mb-0.5">
                  {dueTodayFilings.length} filings on the desk
                </h4>
                <p className="font-serif italic text-sm text-ink-soft">
                  Two are already past the filing window. Review before 18:00 today.
                </p>
              </div>
              {dueTodayFilings.map((f) => (
                <FilingTaskCard key={f.id} filing={f} variant="brief" today={PREVIEW_TODAY} />
              ))}
              <button
                type="button"
                className="mt-1 self-start px-4 py-2 border border-ink text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-ink hover:bg-ink hover:text-paper-raised transition-colors"
              >
                Open all in bulk-file →
              </button>
            </div>
          </aside>
        </section>

        {/* §  IV — LAWS LIBRARY  ───────────────────────────────────────── */}
        <section className="mt-16">
          <SectionRule label="§ IV — Laws Library" align="left" />
          <div className="mt-4 grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-5">
              <LawCard
                law={MOCK_LAWS[0]}
                ruleCount={12}
                handlerCount={3}
                clientCount={62}
                description="Central indirect tax applicable on the supply of goods and services in India. Rules include return filing (GSTR-1, GSTR-3B, GSTR-9), refunds, and e-way bill generation."
              />
              <div className="mt-6">
                <FilingTaskCard
                  filing={MOCK_FILINGS[1]}
                  today={PREVIEW_TODAY}
                  action={
                    <button
                      type="button"
                      className="px-3 py-1.5 border border-filed text-filed text-[11px] uppercase tracking-eyebrow font-sans font-semibold hover:bg-filed hover:text-paper-raised transition-colors"
                    >
                      Mark filed
                    </button>
                  }
                />
              </div>
            </div>
            <div className="col-span-12 lg:col-span-7">
              <div className="bg-paper-raised border border-rule">
                <div className="px-5 py-3 border-b border-rule flex items-center justify-between">
                  <div>
                    <Eyebrow tone="muted">Hierarchy</Eyebrow>
                    <h3 className="font-serif text-xl text-ink leading-none mt-0.5">
                      Laws → Rules tree
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-ink-muted">
                    2 laws · 20 rules
                  </span>
                </div>
                <HierarchyTreeView nodes={MOCK_GST_HIERARCHY} />
              </div>
            </div>
          </div>
        </section>

        {/* §  V — CLIENTS × LAWS  ──────────────────────────────────────── */}
        <section className="mt-16">
          <SectionRule label="§ V — Client × Law Registration" align="left" />
          <div className="mt-4">
            <ClientLawMatrix
              clients={MOCK_CLIENTS}
              laws={MOCK_LAWS}
              cells={MOCK_MATRIX_CELLS}
            />
          </div>
        </section>

        {/* §  VI — BULK FILING DRAWER (inline preview)  ────────────────── */}
        <section className="mt-16">
          <SectionRule label="§ VI — Bulk Filing (drawer preview)" align="left" />
          <div className="mt-4 grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-7">
              <EmptyState
                eyebrow="§ Empty State Pattern"
                quote="Nothing filed today. The ledger is quiet — but not for long."
                attribution="from the Empty Page specimen"
                cta={
                  <button
                    type="button"
                    className="px-5 py-2.5 border border-ink text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-ink hover:bg-ink hover:text-paper-raised transition-colors"
                  >
                    Generate next 6 months
                  </button>
                }
              />
            </div>
            <div className="col-span-12 lg:col-span-5">
              <BulkFilingDrawer filings={filingsToFile} inline />
            </div>
          </div>
        </section>

        {/* §  VII — KIT SPECIMENS  ─────────────────────────────────────── */}
        <section className="mt-16">
          <SectionRule label="§ VII — Specimens" align="left" />
          <p className="mt-3 font-serif italic text-ink-soft text-sm max-w-xl">
            Every mark, chip and stamp used across the console — set as a type specimen so the
            kit can be reviewed without context.
          </p>

          <div className="mt-6 grid grid-cols-12 gap-6">
            {/* Urgency badges */}
            <div className="col-span-12 md:col-span-6 bg-paper-raised border border-rule p-6">
              <Eyebrow tone="muted" mark="a.">Urgency Badges</Eyebrow>
              <div className="mt-4 flex flex-wrap gap-2">
                <UrgencyBadge urgency="overdue" tail="3 d" />
                <UrgencyBadge urgency="due-today" />
                <UrgencyBadge urgency="due-this-week" tail="4 d" />
                <UrgencyBadge urgency="upcoming" tail="14 d" />
                <UrgencyBadge urgency="filed" />
                <UrgencyBadge urgency="draft" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <UrgencyBadge urgency="overdue" variant="solid" />
                <UrgencyBadge urgency="due-today" variant="solid" />
                <UrgencyBadge urgency="filed" variant="solid" />
              </div>
            </div>

            {/* Jurisdiction tags */}
            <div className="col-span-12 md:col-span-6 bg-paper-raised border border-rule p-6">
              <Eyebrow tone="muted" mark="b.">Jurisdiction Tags</Eyebrow>
              <div className="mt-4 flex flex-wrap gap-2">
                <JurisdictionTag jurisdiction="central" />
                <JurisdictionTag jurisdiction="state" locality="Maharashtra" />
                <JurisdictionTag jurisdiction="municipal" locality="Pune" />
                <JurisdictionTag jurisdiction="international" locality="UAE" />
              </div>
            </div>

            {/* Stamp marks */}
            <div className="col-span-12 bg-paper-raised border border-rule p-8">
              <Eyebrow tone="muted" mark="c.">Stamp Marks</Eyebrow>
              <div className="mt-6 flex flex-wrap items-center gap-10">
                <StampMark kind="filed" size="lg" sub="14 Apr 26" />
                <StampMark kind="overdue" size="lg" sub="3 days" />
                <StampMark kind="draft" size="md" />
                <StampMark kind="confidential" size="md" />
                <StampMark kind="void" size="md" />
                <StampMark kind="review" size="md" sub="Partner" />
                <StampMark kind="filed" size="sm" sub="Q4 FY26" />
              </div>
            </div>

            {/* Ordinal dates */}
            <div className="col-span-12 md:col-span-6 bg-paper-raised border border-rule p-6">
              <Eyebrow tone="muted" mark="d.">Ordinal Dates</Eyebrow>
              <div className="mt-4 space-y-2 text-lg text-ink">
                <div><OrdinalDate date={PREVIEW_TODAY} variant="long" /></div>
                <div><OrdinalDate date={PREVIEW_TODAY} variant="long" withWeekday /></div>
                <div><OrdinalDate date={PREVIEW_TODAY} variant="short" /></div>
                <div><OrdinalDate date={PREVIEW_TODAY} variant="numeric" /></div>
              </div>
            </div>

            {/* Typography scale */}
            <div className="col-span-12 md:col-span-6 bg-paper-raised border border-rule p-6">
              <Eyebrow tone="muted" mark="e.">Typography</Eyebrow>
              <div className="mt-4 space-y-3">
                <div className="font-serif text-4xl text-ink leading-none">
                  The quiet <span className="italic">ledger</span>.
                </div>
                <div className="font-sans text-sm text-ink-soft">
                  General Sans · 14px body with warm neutral ink color for sustained reading.
                </div>
                <div className="font-mono tabular-nums text-sm text-ink">
                  0 1 2 3 4 5 6 7 8 9 · 27AABCA1234H1Z5 · ₹ 12,55,000.00
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* §  VIII — COMMAND PALETTE PREVIEW  ──────────────────────────── */}
        <section className="mt-16">
          <SectionRule label="§ VIII — ⌘K Command Palette" align="left" />
          <div className="mt-4 flex justify-center">
            <CommandPalette open groups={COMMAND_GROUPS} onOpenChange={() => {}} inline />
          </div>
        </section>

        {/* §  COLOPHON  ────────────────────────────────────────────────── */}
        <footer className="mt-24">
          <SectionRule
            label="Compliance · Set in Instrument Serif & General Sans · Printed on Paper"
            align="center"
          />
          <div className="mt-4 text-center text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
            Design preview — all data is fictional · © 2026
          </div>
        </footer>
      </main>

      {/* Modal command palette overlay — rendered at viewport level */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} groups={COMMAND_GROUPS} />
    </div>
  );
}
