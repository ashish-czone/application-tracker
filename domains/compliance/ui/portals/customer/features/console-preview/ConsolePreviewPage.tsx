import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { ColumnDef } from '@tanstack/react-table';
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
  Info,
  Mail,
  Send,
  AlertTriangle,
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
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Slider,
  FormSlider,
  Form,
  FormInput,
  FormTextarea,
  FormSelect,
  FormCheckbox,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Label,
  DataGrid,
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

// ---------------------------------------------------------------------------
// §  IX — CONTROLS WORKSHOP — mock data                                    ---
// ---------------------------------------------------------------------------
interface WorkshopRow {
  id: string;
  code: string;
  client: string;
  period: string;
  amount: number;
  status: 'ready' | 'draft' | 'blocked';
}
const WORKSHOP_ROWS: WorkshopRow[] = [
  { id: 'w1', code: 'GSTR-3B', client: 'Nilkanth Traders', period: 'Mar 2026', amount: 184500, status: 'ready' },
  { id: 'w2', code: 'GSTR-1', client: 'Khandwala & Sons', period: 'Mar 2026', amount: 62850, status: 'ready' },
  { id: 'w3', code: 'ITR-6', client: 'Arbitrage Holdings', period: 'FY 25-26', amount: 0, status: 'draft' },
  { id: 'w4', code: 'TDS 24Q', client: 'Prism Analytics', period: 'Q4 2026', amount: 41200, status: 'blocked' },
  { id: 'w5', code: 'GSTR-9', client: 'Velocity Retail', period: 'FY 25-26', amount: 0, status: 'draft' },
];

const WORKSHOP_COLUMNS: ColumnDef<WorkshopRow>[] = [
  {
    id: 'code',
    header: 'Return',
    accessorKey: 'code',
    cell: ({ row }) => <span className="font-mono text-[13px] text-ink">{row.original.code}</span>,
  },
  {
    id: 'client',
    header: 'Client',
    accessorKey: 'client',
  },
  {
    id: 'period',
    header: 'Period',
    accessorKey: 'period',
    cell: ({ row }) => <span className="text-ink-soft">{row.original.period}</span>,
  },
  {
    id: 'amount',
    header: 'Amount (₹)',
    accessorKey: 'amount',
    cell: ({ row }) => (
      <span data-numeric="true" className="font-mono tabular-nums text-right block">
        {row.original.amount > 0 ? row.original.amount.toLocaleString('en-IN') : '—'}
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    accessorKey: 'status',
    cell: ({ row }) => {
      const s = row.original.status;
      const copy =
        s === 'ready' ? 'Ready to file' : s === 'draft' ? 'Draft' : 'Blocked';
      const tone =
        s === 'ready'
          ? 'text-filed'
          : s === 'draft'
            ? 'text-ink-muted'
            : 'text-signal';
      return (
        <span className={`text-[10px] uppercase tracking-[0.14em] ${tone}`}>{copy}</span>
      );
    },
  },
];

interface WorkshopFormValues {
  clientName: string;
  reference: string;
  jurisdiction: string;
  returnType: string;
  notes: string;
  priority: number;
  confirmed: boolean;
}

export function ConsolePreviewPage() {
  const [chips, setChips] = useState<FilterChip[]>(FILTER_CHIPS_INITIAL);
  const [search, setSearch] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);

  // § IX — controls workshop state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [gracePeriod, setGracePeriod] = useState(7);
  const [bulkTier, setBulkTier] = useState('handler-primary');
  const [allowOverride, setAllowOverride] = useState(true);
  const [workshopPage, setWorkshopPage] = useState(1);

  const workshopForm = useForm<WorkshopFormValues>({
    defaultValues: {
      clientName: 'Nilkanth Traders Pvt Ltd',
      reference: 'GSTIN 27AAACN1234A1Z5',
      jurisdiction: 'central',
      returnType: 'gstr-3b',
      notes: 'Client has elected to file on the 16th to allow for reconciliation with purchase register.',
      priority: 72,
      confirmed: false,
    },
  });

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

        {/* §  IX — CONTROLS WORKSHOP  ──────────────────────────────────── */}
        <section className="mt-16">
          <SectionRule label="§ IX — Controls Workshop" align="left" />
          <p className="mt-3 max-w-[62ch] text-sm text-ink-soft font-serif italic leading-relaxed">
            The generic shadcn primitives — Dialog, Sheet, Tooltip, Slider, Input, Select,
            Checkbox, Radio, DataGrid — retuned for warm paper. Every control below is the
            production component from <span className="font-mono not-italic text-[12px]">@packages/ui</span>;
            only the theme changes.
          </p>

          <TooltipProvider delayDuration={150}>
            <div className="mt-8 grid grid-cols-12 gap-8">
              {/* ─── Column A: Dialog + Sheet + Tooltip triggers ─── */}
              <div className="col-span-4">
                <Eyebrow tone="muted" mark="a">Overlay surfaces</Eyebrow>
                <div className="mt-4 border border-rule bg-paper-raised">
                  <div className="px-5 py-5 space-y-4">
                    <div className="space-y-1">
                      <div className="font-serif text-xl text-ink leading-tight">Dialog</div>
                      <p className="text-xs text-ink-muted">Confirmation & focused tasks</p>
                    </div>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <span>Mark 12 filings as filed</span>
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Confirm bulk filing</DialogTitle>
                          <DialogDescription>
                            You are about to mark <span className="font-mono text-ink">12</span>{' '}
                            filings as filed on <OrdinalDate date={PREVIEW_TODAY} variant="long" />.
                            This will trigger client notifications and lock the associated periods.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="mt-2 border-y border-rule py-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-4 h-4 text-signal mt-0.5 shrink-0" />
                            <div className="text-sm text-ink-soft">
                              <span className="text-ink">3 of these</span> are past their grace
                              period. The audit log will flag them as late filings.
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="dialog-ack"
                              checked={allowOverride}
                              onCheckedChange={(v) => setAllowOverride(v === true)}
                            />
                            <label htmlFor="dialog-ack" className="text-xs text-ink-soft cursor-pointer">
                              I have reviewed each filing and acknowledge the late flags
                            </label>
                          </div>
                        </div>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="ghost">Cancel</Button>
                          </DialogClose>
                          <Button disabled={!allowOverride} onClick={() => setDialogOpen(false)}>
                            File 12 returns
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="border-t border-rule px-5 py-5 space-y-4">
                    <div className="space-y-1">
                      <div className="font-serif text-xl text-ink leading-tight">Sheet</div>
                      <p className="text-xs text-ink-muted">Right drawer for longer tasks</p>
                    </div>
                    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                      <SheetTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <span>Edit client profile</span>
                          <Users className="w-4 h-4" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="right">
                        <SheetHeader>
                          <SheetTitle>Nilkanth Traders</SheetTitle>
                          <SheetDescription>
                            Registered under GST · Income Tax · TDS. Last filing 14 days ago.
                          </SheetDescription>
                        </SheetHeader>
                        <div className="px-6 py-6 space-y-4 flex-1 overflow-auto">
                          <div>
                            <Label htmlFor="sheet-name">Legal name</Label>
                            <input
                              id="sheet-name"
                              data-slot="input"
                              defaultValue="Nilkanth Traders Pvt Ltd"
                              className="mt-1 w-full"
                            />
                          </div>
                          <div>
                            <Label htmlFor="sheet-gstin">GSTIN</Label>
                            <input
                              id="sheet-gstin"
                              data-slot="input"
                              type="text"
                              inputMode="numeric"
                              defaultValue="27AAACN1234A1Z5"
                              className="mt-1 w-full"
                            />
                          </div>
                          <div>
                            <Label htmlFor="sheet-notes">Handler notes</Label>
                            <textarea
                              id="sheet-notes"
                              data-slot="textarea"
                              rows={4}
                              defaultValue="Books closed on 12th of each month. GSTR-1 filed first, then 3B on the 20th."
                              className="mt-1 w-full"
                            />
                          </div>
                        </div>
                        <SheetFooter>
                          <Button variant="ghost" onClick={() => setSheetOpen(false)}>Cancel</Button>
                          <Button onClick={() => setSheetOpen(false)}>Save profile</Button>
                        </SheetFooter>
                      </SheetContent>
                    </Sheet>
                  </div>

                  <div className="border-t border-rule px-5 py-5 space-y-4">
                    <div className="space-y-1">
                      <div className="font-serif text-xl text-ink leading-tight">Tooltip</div>
                      <p className="text-xs text-ink-muted">Ink chip with small-caps copy</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Info className="w-3.5 h-3.5" />
                            Why late?
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Filed after the 20th grace window</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="w-8 h-8 grid place-items-center border border-rule hover:border-ink text-ink-soft hover:text-ink transition-colors"
                            aria-label="Send reminder"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Send reminder ⌘R</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="w-8 h-8 grid place-items-center border border-rule hover:border-ink text-ink-soft hover:text-ink transition-colors"
                            aria-label="Compose email"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Compose email to client</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── Column B: Sliders + Radio + Checkbox ─── */}
              <div className="col-span-4">
                <Eyebrow tone="muted" mark="b">Controls</Eyebrow>
                <div className="mt-4 border border-rule bg-paper-raised">
                  <div className="px-5 py-5">
                    <div className="space-y-1 mb-4">
                      <div className="font-serif text-xl text-ink leading-tight">Slider</div>
                      <p className="text-xs text-ink-muted">Hairline track, ink thumb</p>
                    </div>
                    <div className="space-y-5">
                      <div>
                        <div className="flex items-baseline justify-between mb-1">
                          <Label htmlFor="grace">Grace period</Label>
                          <span data-numeric="true" className="font-mono text-sm text-ink">
                            {gracePeriod} day{gracePeriod === 1 ? '' : 's'}
                          </span>
                        </div>
                        <Slider
                          min={0}
                          max={30}
                          step={1}
                          value={[gracePeriod]}
                          onValueChange={(v) => setGracePeriod(v[0])}
                          ticks
                          legend={
                            <>
                              <span>0</span>
                              <span>15</span>
                              <span>30</span>
                            </>
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-rule px-5 py-5">
                    <div className="space-y-1 mb-4">
                      <div className="font-serif text-xl text-ink leading-tight">Radio</div>
                      <p className="text-xs text-ink-muted">Ink dot, square-ish paper bed</p>
                    </div>
                    <RadioGroup value={bulkTier} onValueChange={setBulkTier} className="space-y-2">
                      {[
                        { v: 'handler-primary', l: 'Primary handler', d: 'First choice, never fails open' },
                        { v: 'handler-any', l: 'Any handler', d: 'Round-robin among qualified' },
                        { v: 'global-primary', l: 'Global primary', d: 'Partner fallback only' },
                        { v: 'unassigned', l: 'Leave unassigned', d: 'Errors out at generation' },
                      ].map((opt) => (
                        <label
                          key={opt.v}
                          className="flex items-start gap-3 cursor-pointer py-1"
                        >
                          <RadioGroupItem value={opt.v} id={`tier-${opt.v}`} className="mt-0.5" />
                          <div>
                            <div className="text-[13px] text-ink">{opt.l}</div>
                            <div className="text-[11px] text-ink-muted">{opt.d}</div>
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="border-t border-rule px-5 py-5">
                    <div className="space-y-1 mb-4">
                      <div className="font-serif text-xl text-ink leading-tight">Checkbox</div>
                      <p className="text-xs text-ink-muted">Ink fill when checked</p>
                    </div>
                    <div className="space-y-2">
                      {[
                        { id: 'cb-1', label: 'Email client on creation', checked: true },
                        { id: 'cb-2', label: 'Include attachments', checked: true },
                        { id: 'cb-3', label: 'Notify handler', checked: false },
                        { id: 'cb-4', label: 'Add to partner digest', checked: false },
                      ].map((c) => (
                        <label key={c.id} className="flex items-center gap-3 cursor-pointer">
                          <Checkbox id={c.id} defaultChecked={c.checked} />
                          <span className="text-[13px] text-ink">{c.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── Column C: Form specimen ─── */}
              <div className="col-span-4">
                <Eyebrow tone="muted" mark="c">Form — register client</Eyebrow>
                <div className="mt-4 border border-rule bg-paper-raised p-5">
                  <Form form={workshopForm} onSubmit={workshopForm.handleSubmit(() => {})}>
                    <FormInput name="clientName" label="Client name" placeholder="Legal entity" />
                    <FormInput
                      name="reference"
                      label="Reference"
                      placeholder="GSTIN / PAN / Reg no."
                    />
                    <FormSelect
                      name="jurisdiction"
                      label="Jurisdiction"
                      options={[
                        { value: 'central', label: 'Central' },
                        { value: 'state', label: 'State' },
                        { value: 'municipal', label: 'Municipal' },
                        { value: 'international', label: 'International' },
                      ]}
                    />
                    <FormSelect
                      name="returnType"
                      label="Return type"
                      options={[
                        { value: 'gstr-1', label: 'GSTR-1 · Outward supplies' },
                        { value: 'gstr-3b', label: 'GSTR-3B · Summary return' },
                        { value: 'gstr-9', label: 'GSTR-9 · Annual return' },
                        { value: 'itr-6', label: 'ITR-6 · Corporate income' },
                      ]}
                    />
                    <FormSlider
                      name="priority"
                      label="Priority weight"
                      min={0}
                      max={100}
                      step={5}
                      formatValue={(v) => `${v} / 100`}
                    />
                    <FormTextarea
                      name="notes"
                      label="Handler notes"
                      rows={3}
                      description="Visible to the assigned handler only."
                    />
                    <FormCheckbox
                      name="confirmed"
                      label="I confirm the above matches the engagement letter"
                    />
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="ghost" type="button">Cancel</Button>
                      <Button type="submit">Register client</Button>
                    </div>
                  </Form>
                </div>
              </div>
            </div>
          </TooltipProvider>

          {/* ─── Full-width DataGrid ─── */}
          <div className="mt-10">
            <Eyebrow tone="muted" mark="d">DataGrid — ready for filing</Eyebrow>
            <div className="mt-4">
              <DataGrid<WorkshopRow>
                columns={WORKSHOP_COLUMNS}
                data={WORKSHOP_ROWS}
                page={workshopPage}
                pageSize={10}
                pageCount={1}
                totalRows={WORKSHOP_ROWS.length}
                onPageChange={setWorkshopPage}
                onPageSizeChange={() => {}}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search returns, clients, periods…"
              />
            </div>
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
