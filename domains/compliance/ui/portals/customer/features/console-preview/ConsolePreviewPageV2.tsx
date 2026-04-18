import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Search,
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
  Pencil,
  Trash2,
  Copy,
  Download,
  Archive,
  ChevronsUpDown,
  Filter,
  RotateCw,
  Eye,
  GripVertical,
} from 'lucide-react';
import {
  Scales,
  Gavel,
  BookOpenText,
  Feather,
  Scroll,
  Stamp,
} from '@phosphor-icons/react';
import {
  SectionRule,
  Eyebrow,
  MetricKPI,
  StatusDonut,
  DataTable,
  FilterBar,
  HierarchyTreeView,
  EmptyState,
  CommandPalette,
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
  createRowActionsColumn,
  type DataGridBulkAction,
  type DataGridFilterField,
  type FilterExpression,
  // Extended kit (§ X)
  ButtonGroup,
  Badge,
  DateFormat,
  NumberFormat,
  CurrencyFormat,
  Combobox,
  MultiSelect,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Progress,
  FormDatePicker,
  FormDateRangePicker,
  KanbanBoard,
  Sortable,
  SortableItem,
  SortableHandle,
  type KanbanColumnDef,
  type KanbanCardData,
  type KanbanCardMoveEvent,
  CoarseTabs,
  toast,
  type DataTableColumn,
  type FilterChip,
  type CommandGroup,
  type ComboboxOption,
} from '@packages/ui';
import {
  PageMasthead,
  UrgencyBadge,
  JurisdictionTag,
  OrdinalDate,
  StampMark,
  ConsoleHeaderBar,
  PageSection,
  Panel,
  PanelHeading,
} from '../../../../components';
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

const PIPELINE_COLUMNS: KanbanColumnDef[] = [
  { id: 'draft', label: 'Draft', color: '#A39889' },
  { id: 'review', label: 'In review', color: '#C7923D', limit: 5 },
  { id: 'ready', label: 'Ready to file', color: '#3F7B5A' },
  { id: 'filed', label: 'Filed', color: '#557A92' },
];

const WORKSHOP_FILTER_FIELDS: DataGridFilterField[] = [
  {
    key: 'status',
    label: 'Status',
    fieldType: 'picklist',
    options: [
      { label: 'Ready to file', value: 'ready' },
      { label: 'Draft', value: 'draft' },
      { label: 'Blocked', value: 'blocked' },
    ],
  },
  {
    key: 'code',
    label: 'Return type',
    fieldType: 'picklist',
    options: [
      { label: 'GSTR-3B', value: 'GSTR-3B' },
      { label: 'GSTR-1', value: 'GSTR-1' },
      { label: 'GSTR-9', value: 'GSTR-9' },
      { label: 'ITR-6', value: 'ITR-6' },
      { label: 'TDS 24Q', value: 'TDS 24Q' },
    ],
  },
  { key: 'client', label: 'Client', fieldType: 'text' },
  { key: 'amount', label: 'Amount', fieldType: 'number' },
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
  createRowActionsColumn<WorkshopRow>({
    actions: [
      {
        label: 'View return',
        icon: Eye,
        onClick: (row) => toast.info(`Viewing ${row.code} · ${row.client}`),
      },
      {
        label: 'Edit',
        icon: Pencil,
        onClick: (row) => toast.info(`Editing ${row.code}`),
      },
      {
        label: 'Duplicate',
        icon: Copy,
        onClick: (row) => toast.success(`Duplicated ${row.code}`),
      },
      {
        label: 'Archive',
        icon: Archive,
        separatorBefore: true,
        onClick: (row) => toast.warning(`Archived ${row.code}`),
        disabled: (row) => row.status === 'blocked',
      },
      {
        label: 'Delete',
        icon: Trash2,
        variant: 'destructive',
        onClick: (row) => toast.error(`Deleted ${row.code}`),
      },
    ],
  }),
];

const JURISDICTION_OPTIONS: ComboboxOption[] = [
  { label: 'Central', value: 'central' },
  { label: 'Maharashtra', value: 'mh' },
  { label: 'Karnataka', value: 'ka' },
  { label: 'Tamil Nadu', value: 'tn' },
  { label: 'Gujarat', value: 'gj' },
  { label: 'Delhi', value: 'dl' },
  { label: 'West Bengal', value: 'wb' },
  { label: 'Telangana', value: 'tg' },
];

const TAG_OPTIONS: ComboboxOption[] = [
  { label: 'GST', value: 'gst' },
  { label: 'Income tax', value: 'it' },
  { label: 'TDS', value: 'tds' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Annual', value: 'annual' },
  { label: 'High priority', value: 'high' },
  { label: 'Audit', value: 'audit' },
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

export function ConsolePreviewPageV2() {
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
  const [workshopSelection, setWorkshopSelection] = useState<string[]>([]);
  const [workshopFilters, setWorkshopFilters] = useState<FilterExpression[]>([]);
  const [workshopSort, setWorkshopSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  // § X — extended kit state
  const [isDark, setIsDark] = useState(false);
  const [filterTier, setFilterTier] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [coarseUnderline, setCoarseUnderline] = useState('all');
  const [coarseSegmented, setCoarseSegmented] = useState('monthly');
  const [tags, setTags] = useState<string[]>(['gst', 'quarterly']);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>('mh');
  const [selectedDate, setSelectedDate] = useState('2026-04-20');
  const [dateRange, setDateRange] = useState({ from: '2026-04-01', to: '2026-04-30' });
  const [filingProgress] = useState(68);

  // § XI — drag/drop state
  const [handlerOrder, setHandlerOrder] = useState<{ id: string; name: string; load: number }[]>([
    { id: 'h1', name: 'Priya Menon', load: 18 },
    { id: 'h2', name: 'Rohan Shetty', load: 14 },
    { id: 'h3', name: 'Karthik Iyer', load: 22 },
    { id: 'h4', name: 'Anika Das', load: 9 },
    { id: 'h5', name: 'Shreya Kulkarni', load: 12 },
  ]);
  const [pipelineCards, setPipelineCards] = useState<KanbanCardData[]>([
    { id: 'p1', columnId: 'draft', code: 'GSTR-3B', client: 'Nilkanth Traders', due: 'Apr 20' },
    { id: 'p2', columnId: 'draft', code: 'ITR-6', client: 'Arbitrage Holdings', due: 'Apr 30' },
    { id: 'p3', columnId: 'review', code: 'GSTR-1', client: 'Khandwala & Sons', due: 'Apr 22' },
    { id: 'p4', columnId: 'review', code: 'TDS 24Q', client: 'Prism Analytics', due: 'Apr 25' },
    { id: 'p5', columnId: 'ready', code: 'GSTR-9', client: 'Velocity Retail', due: 'May 05' },
    { id: 'p6', columnId: 'ready', code: 'ROC MGT-7', client: 'Summit Ventures', due: 'May 08' },
    { id: 'p7', columnId: 'filed', code: 'GSTR-3B', client: 'Delta Agro', due: 'Filed' },
    { id: 'p8', columnId: 'filed', code: 'TDS 26Q', client: 'Orion Labs', due: 'Filed' },
  ]);

  // Dark-mode toggle — flip a class on the same subtree that carries
  // `.theme-instrument`. The compliance app applies that class on <body>.
  const toggleDark = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        document.body.classList.toggle('dark', next);
      }
      return next;
    });
  };

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
      <ConsoleHeaderBar
        nav={[
          { label: 'Console', to: '/console-preview-v2', active: true },
          { label: 'Clients', to: '/screens/clients' },
          { label: 'Laws', to: '/screens/laws' },
          { label: 'Obligations', to: '/screens/obligations' },
          { label: 'Filings', to: '/screens/filings' },
          { label: 'Reports', to: '/screens/reports' },
        ]}
        user={{ initials: 'AG', name: 'Ashish Goel', role: 'Partner' }}
        isDark={isDark}
        onToggleDark={toggleDark}
        onSearchOpen={() => setPaletteOpen(true)}
      />

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
        <PageSection mark="§ II — The Next Fortnight">
          <FilingTimeline filings={MOCK_FILINGS} start={PREVIEW_TODAY} days={14} />
        </PageSection>

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
        <PageSection mark="§ IV — Laws Library">
          <div className="grid grid-cols-12 gap-6">
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
        </PageSection>

        {/* §  V — CLIENTS × LAWS  ──────────────────────────────────────── */}
        <PageSection mark="§ V — Client × Law Registration">
          <ClientLawMatrix
            clients={MOCK_CLIENTS}
            laws={MOCK_LAWS}
            cells={MOCK_MATRIX_CELLS}
          />
        </PageSection>

        {/* §  VI — BULK FILING DRAWER (inline preview)  ────────────────── */}
        <PageSection mark="§ VI — Bulk Filing (drawer preview)">
          <div className="grid grid-cols-12 gap-6">
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
        </PageSection>

        {/* §  VII — KIT SPECIMENS  ─────────────────────────────────────── */}
        <PageSection
          mark="§ VII — Specimens"
          intro="Every mark, chip and stamp used across the console — set as a type specimen so the kit can be reviewed without context."
          bodyClassName="grid grid-cols-12 gap-6"
        >
          <Panel padding="md" className="col-span-12 md:col-span-6">
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
          </Panel>

          <Panel padding="md" className="col-span-12 md:col-span-6">
            <Eyebrow tone="muted" mark="b.">Jurisdiction Tags</Eyebrow>
            <div className="mt-4 flex flex-wrap gap-2">
              <JurisdictionTag jurisdiction="central" />
              <JurisdictionTag jurisdiction="state" locality="Maharashtra" />
              <JurisdictionTag jurisdiction="municipal" locality="Pune" />
              <JurisdictionTag jurisdiction="international" locality="UAE" />
            </div>
          </Panel>

          <Panel padding="lg" className="col-span-12">
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
          </Panel>

          <Panel padding="md" className="col-span-12 md:col-span-6">
            <Eyebrow tone="muted" mark="d.">Ordinal Dates</Eyebrow>
            <div className="mt-4 space-y-2 text-lg text-ink">
              <div><OrdinalDate date={PREVIEW_TODAY} variant="long" /></div>
              <div><OrdinalDate date={PREVIEW_TODAY} variant="long" withWeekday /></div>
              <div><OrdinalDate date={PREVIEW_TODAY} variant="short" /></div>
              <div><OrdinalDate date={PREVIEW_TODAY} variant="numeric" /></div>
            </div>
          </Panel>

          <Panel padding="md" className="col-span-12 md:col-span-6">
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
          </Panel>
        </PageSection>

        {/* §  VIII — COMMAND PALETTE PREVIEW  ──────────────────────────── */}
        <PageSection mark="§ VIII — ⌘K Command Palette" bodyClassName="flex justify-center">
          <CommandPalette open groups={COMMAND_GROUPS} onOpenChange={() => {}} inline />
        </PageSection>

        {/* §  IX — CONTROLS WORKSHOP  ──────────────────────────────────── */}
        <PageSection
          mark="§ IX — Controls Workshop"
          intro={
            <>
              The generic shadcn primitives — Dialog, Sheet, Tooltip, Slider, Input, Select,
              Checkbox, Radio, DataGrid — retuned for warm paper. Every control below is the
              production component from <span className="font-mono not-italic text-[12px]">@packages/ui</span>;
              only the theme changes.
            </>
          }
          bodyClassName="mt-8"
        >
          <TooltipProvider delayDuration={150}>
            <div className="grid grid-cols-12 gap-8">
              {/* ─── Column A: Dialog + Sheet + Tooltip triggers ─── */}
              <div className="col-span-4">
                <Eyebrow tone="muted" mark="a">Overlay surfaces</Eyebrow>
                <Panel className="mt-4">
                  <div className="px-5 py-5 space-y-4">
                    <PanelHeading title="Dialog" subtitle="Confirmation & focused tasks" />
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
                    <PanelHeading title="Sheet" subtitle="Right drawer for longer tasks" />
                    <Sheet open={sheetOpen} onOpenChange={setSheetOpen} modal={false}>
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
                    <PanelHeading title="Tooltip" subtitle="Ink chip with small-caps copy" />
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
                </Panel>
              </div>

              {/* ─── Column B: Sliders + Radio + Checkbox ─── */}
              <div className="col-span-4">
                <Eyebrow tone="muted" mark="b">Controls</Eyebrow>
                <Panel className="mt-4">
                  <div className="px-5 py-5">
                    <PanelHeading title="Slider" subtitle="Hairline track, ink thumb" className="mb-4" />
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
                    <PanelHeading title="Radio" subtitle="Ink dot, square-ish paper bed" className="mb-4" />
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
                    <PanelHeading title="Checkbox" subtitle="Ink fill when checked" className="mb-4" />
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
                </Panel>
              </div>

              {/* ─── Column C: Form specimen ─── */}
              <div className="col-span-4">
                <Eyebrow tone="muted" mark="c">Form — register client</Eyebrow>
                <Panel padding="sm" className="mt-4">
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
                </Panel>
              </div>
            </div>
          </TooltipProvider>

          {/* ─── Full-width DataGrid ─── */}
          <div className="mt-10">
            <Eyebrow tone="muted" mark="d">DataGrid — ready for filing</Eyebrow>
            <div className="mt-4">
              <DataGrid<WorkshopRow>
                columns={WORKSHOP_COLUMNS}
                data={(() => {
                  const filtered = WORKSHOP_ROWS.filter((row) =>
                    workshopFilters.every((f) => {
                      const val = row[f.field as keyof WorkshopRow];
                      if (f.operator === 'eq') return String(val) === String(f.value);
                      if (f.operator === 'in') return Array.isArray(f.value) && (f.value as string[]).includes(String(val));
                      if (f.operator === 'contains') return String(val).toLowerCase().includes(String(f.value).toLowerCase());
                      if (f.operator === 'gt') return Number(val) > Number(f.value);
                      if (f.operator === 'lt') return Number(val) < Number(f.value);
                      return true;
                    }),
                  );
                  if (!workshopSort) return filtered;
                  const { column, direction } = workshopSort;
                  const mult = direction === 'asc' ? 1 : -1;
                  return [...filtered].sort((a, b) => {
                    const av = a[column as keyof WorkshopRow];
                    const bv = b[column as keyof WorkshopRow];
                    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult;
                    return String(av).localeCompare(String(bv)) * mult;
                  });
                })()}
                sortColumn={workshopSort?.column}
                sortDirection={workshopSort?.direction}
                onSortChange={(column, direction) => setWorkshopSort({ column, direction })}
                filterFields={WORKSHOP_FILTER_FIELDS}
                filters={workshopFilters}
                onFilterAdd={(expr) => setWorkshopFilters((prev) => [...prev.filter((f) => f.field !== expr.field), expr])}
                onStructuredFilterRemove={(field) => setWorkshopFilters((prev) => prev.filter((f) => f.field !== field))}
                onFilterUpdate={(index, expr) => setWorkshopFilters((prev) => prev.map((f, i) => (i === index ? expr : f)))}
                onStructuredFiltersClear={() => setWorkshopFilters([])}
                enableSelection
                onSelectionChange={setWorkshopSelection}
                rowAttributes={(row) => ({
                  'data-status':
                    row.status === 'ready'
                      ? 'filed'
                      : row.status === 'blocked'
                        ? 'overdue'
                        : 'due-soon',
                })}
                bulkActions={[
                  {
                    label: 'Mark ready to file',
                    icon: CheckCircle2,
                    onClick: (ids) => toast.success(`Marked ${ids.length} as ready`),
                  },
                  {
                    label: 'Export selected',
                    icon: Download,
                    onClick: (ids) => toast.info(`Exporting ${ids.length} filings`),
                  },
                  {
                    label: 'Archive',
                    icon: Archive,
                    onClick: (ids) => toast.warning(`Archived ${ids.length}`),
                  },
                  {
                    label: 'Delete',
                    icon: Trash2,
                    variant: 'destructive',
                    onClick: (ids) => toast.error(`Deleted ${ids.length}`),
                  },
                ]}
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
              <p className="mt-3 text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                {workshopSelection.length > 0
                  ? `${workshopSelection.length} selected — Actions menu shows in toolbar`
                  : 'Try the Filter button (next to search) · select rows to reveal the Actions menu'}
              </p>
            </div>
          </div>
        </PageSection>

        {/* §  X — EXTENDED KIT  ────────────────────────────────────────── */}
        <PageSection
          mark="§ X — Extended Kit"
          intro="The second half of the surface area — buttons with tone, format displays, standalone comboboxes, tabs, accordions, breadcrumbs, progress, and a working dark mode. Same tokens, every piece."
          bodyClassName="mt-8"
        >
          {/* ─── Palette strip ─── */}
          <div>
            <Eyebrow tone="muted" mark="a">Palette</Eyebrow>
            <div className="mt-4 grid grid-cols-8 border border-rule bg-paper-raised">
              {[
                { label: 'Paper', bg: 'bg-paper', text: 'text-ink' },
                { label: 'Paper raised', bg: 'bg-paper-raised', text: 'text-ink' },
                { label: 'Paper sunken', bg: 'bg-paper-sunken', text: 'text-ink' },
                { label: 'Ink', bg: 'bg-ink', text: 'text-paper' },
                { label: 'Authority', bg: 'bg-authority', text: 'text-paper' },
                { label: 'Filed', bg: 'bg-filed', text: 'text-paper' },
                { label: 'Due soon', bg: 'bg-due-soon', text: 'text-paper' },
                { label: 'Signal', bg: 'bg-signal', text: 'text-paper' },
              ].map((tone) => (
                <div
                  key={tone.label}
                  className={`${tone.bg} ${tone.text} aspect-[2/1] flex items-end p-3 border-r border-rule/40 last:border-r-0`}
                >
                  <span className="text-[10px] uppercase tracking-[0.14em] font-sans font-medium">
                    {tone.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Buttons + ButtonGroup ─── */}
          <div className="mt-10 grid grid-cols-12 gap-8">
            <div className="col-span-6">
              <Eyebrow tone="muted" mark="b">Buttons · tone variants</Eyebrow>
              <div className="mt-4 border border-rule bg-paper-raised p-5 space-y-5">
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                    Solid fills
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button tone="authority">Authority</Button>
                    <Button tone="filed">Mark filed</Button>
                    <Button tone="due-soon">Remind client</Button>
                    <Button tone="signal">Escalate</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                    Hairline outlines
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" tone="authority">Authority</Button>
                    <Button variant="outline" tone="filed">Filed</Button>
                    <Button variant="outline" tone="due-soon">Due soon</Button>
                    <Button variant="outline" tone="signal">Signal</Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-6">
              <Eyebrow tone="muted" mark="c">Button groups</Eyebrow>
              <div className="mt-4 border border-rule bg-paper-raised p-5 space-y-5">
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                    View switcher
                  </div>
                  <ButtonGroup>
                    <Button
                      variant={filterTier === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterTier('all')}
                    >
                      All
                    </Button>
                    <Button
                      variant={filterTier === 'ready' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterTier('ready')}
                    >
                      Ready
                    </Button>
                    <Button
                      variant={filterTier === 'draft' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterTier('draft')}
                    >
                      Draft
                    </Button>
                    <Button
                      variant={filterTier === 'blocked' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterTier('blocked')}
                    >
                      Blocked
                    </Button>
                  </ButtonGroup>
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                    Toolbar cluster
                  </div>
                  <ButtonGroup>
                    <Button variant="outline" size="sm"><Filter className="w-3 h-3" /></Button>
                    <Button variant="outline" size="sm"><RotateCw className="w-3 h-3" /></Button>
                    <Button variant="outline" size="sm"><Download className="w-3 h-3" /></Button>
                    <Button variant="outline" size="sm"><ChevronsUpDown className="w-3 h-3" /></Button>
                  </ButtonGroup>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Format displays ─── */}
          <div className="mt-10">
            <Eyebrow tone="muted" mark="d">Format displays</Eyebrow>
            <div className="mt-4 grid grid-cols-12 gap-0 border border-rule bg-paper-raised">
              <div className="col-span-4 p-5 border-r border-rule">
                <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                  Date format
                </div>
                <div className="mt-3 space-y-2 text-sm text-ink">
                  <div>
                    <span className="text-ink-muted text-[11px] block">Long</span>
                    <DateFormat value="2026-04-15" format="long" />
                  </div>
                  <div>
                    <span className="text-ink-muted text-[11px] block">Short</span>
                    <DateFormat value="2026-04-15" format="short" />
                  </div>
                  <div>
                    <span className="text-ink-muted text-[11px] block">Relative</span>
                    <DateFormat value="2026-04-12" format="relative" />
                  </div>
                </div>
              </div>
              <div className="col-span-4 p-5 border-r border-rule">
                <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                  Number format
                </div>
                <div className="mt-3 space-y-2 text-sm text-ink">
                  <div>
                    <span className="text-ink-muted text-[11px] block">Integer</span>
                    <NumberFormat value={184526} />
                  </div>
                  <div>
                    <span className="text-ink-muted text-[11px] block">Compact</span>
                    <NumberFormat value={184526} compact />
                  </div>
                  <div>
                    <span className="text-ink-muted text-[11px] block">Percent</span>
                    <NumberFormat value={0.685} percent decimals={1} />
                  </div>
                </div>
              </div>
              <div className="col-span-4 p-5">
                <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                  Currency format
                </div>
                <div className="mt-3 space-y-2 text-sm text-ink">
                  <div>
                    <span className="text-ink-muted text-[11px] block">USD (cents)</span>
                    <CurrencyFormat value={1250050} currency="USD" />
                  </div>
                  <div>
                    <span className="text-ink-muted text-[11px] block">INR (cents)</span>
                    <CurrencyFormat value={18452600} currency="INR" />
                  </div>
                  <div>
                    <span className="text-ink-muted text-[11px] block">EUR (major)</span>
                    <CurrencyFormat value={24999.5} currency="EUR" minor={false} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Combobox + MultiSelect ─── */}
          <div className="mt-10 grid grid-cols-12 gap-8">
            <div className="col-span-6">
              <Eyebrow tone="muted" mark="e">Combobox · standalone</Eyebrow>
              <div className="mt-4 border border-rule bg-paper-raised p-5 space-y-2">
                <Label>Jurisdiction</Label>
                <Combobox
                  value={selectedJurisdiction}
                  onChange={setSelectedJurisdiction}
                  options={JURISDICTION_OPTIONS}
                  placeholder="Select jurisdiction…"
                />
                <p className="text-[11px] text-ink-muted font-serif italic mt-2">
                  cmdk-backed, search-filtered, keyboard-first
                </p>
              </div>
            </div>
            <div className="col-span-6">
              <Eyebrow tone="muted" mark="f">MultiSelect · standalone</Eyebrow>
              <div className="mt-4 border border-rule bg-paper-raised p-5 space-y-2">
                <Label>Tags</Label>
                <MultiSelect
                  value={tags}
                  onChange={setTags}
                  options={TAG_OPTIONS}
                  placeholder="Add tags…"
                />
                <p className="text-[11px] text-ink-muted font-serif italic mt-2">
                  Chips render as small-caps hairline rectangles
                </p>
              </div>
            </div>
          </div>

          {/* ─── Tabs + Accordion ─── */}
          <div className="mt-10 grid grid-cols-12 gap-8">
            <div className="col-span-6">
              <Eyebrow tone="muted" mark="g">Tabs — two registers</Eyebrow>
              <div className="mt-4 border border-rule bg-paper-raised p-5 space-y-6">
                <div>
                  <p className="mb-3 text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                    Underlined · navigation
                  </p>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="filings">Filings</TabsTrigger>
                      <TabsTrigger value="audit">Audit trail</TabsTrigger>
                      <TabsTrigger value="notes">Notes</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="pt-4 text-sm text-ink-soft leading-relaxed">
                      The <span className="text-ink font-medium">overview</span> tab summarizes
                      the filing cadence, recent returns, and outstanding actions for the selected client.
                    </TabsContent>
                    <TabsContent value="filings" className="pt-4 text-sm text-ink-soft">
                      Chronological list of all filings for this entity, filterable by law and period.
                    </TabsContent>
                    <TabsContent value="audit" className="pt-4 text-sm text-ink-soft">
                      Every state transition, every assignee change, every export — immutable.
                    </TabsContent>
                    <TabsContent value="notes" className="pt-4 text-sm text-ink-soft">
                      Private notes and flags kept by the handling team.
                    </TabsContent>
                  </Tabs>
                </div>
                <div className="border-t border-rule pt-5">
                  <p className="mb-3 text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                    Segmented · filing toggle
                  </p>
                  <Tabs defaultValue="monthly">
                    <TabsList variant="segmented">
                      <TabsTrigger value="monthly">Monthly</TabsTrigger>
                      <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
                      <TabsTrigger value="annual">Annual</TabsTrigger>
                    </TabsList>
                    <TabsContent value="monthly" className="pt-4 text-sm text-ink-soft">
                      GSTR-1, GSTR-3B, TDS — the regular rhythm. Twelve cycles a year.
                    </TabsContent>
                    <TabsContent value="quarterly" className="pt-4 text-sm text-ink-soft">
                      Advance tax, TDS returns (24Q / 26Q). Four cycles.
                    </TabsContent>
                    <TabsContent value="annual" className="pt-4 text-sm text-ink-soft">
                      GSTR-9 reconciliation, income tax return, tax audit report.
                    </TabsContent>
                  </Tabs>
                </div>
                <div className="border-t border-rule pt-5">
                  <p className="mb-3 text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                    CoarseTabs · underline (with counts)
                  </p>
                  <CoarseTabs
                    tabs={[
                      { value: 'all', label: 'All', count: 15 },
                      { value: 'active', label: 'Active', count: 11 },
                      { value: 'draft', label: 'Draft', count: 3 },
                      { value: 'deprecated', label: 'Deprecated', count: 1 },
                    ]}
                    value={coarseUnderline}
                    onChange={setCoarseUnderline}
                    animated
                  />
                  <p className="pt-4 text-sm text-ink-soft">
                    Underline variant with count pips — used for list-screen status cuts.
                  </p>
                </div>
                <div className="border-t border-rule pt-5">
                  <p className="mb-3 text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                    CoarseTabs · segmented
                  </p>
                  <CoarseTabs
                    variant="segmented"
                    tabs={[
                      { value: 'monthly', label: 'Monthly' },
                      { value: 'quarterly', label: 'Quarterly' },
                      { value: 'annual', label: 'Annual' },
                    ]}
                    value={coarseSegmented}
                    onChange={setCoarseSegmented}
                  />
                  <p className="pt-4 text-sm text-ink-soft">
                    Segmented variant — bordered slab with ink-inverted active cell. Filing toggle.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-span-6">
              <Eyebrow tone="muted" mark="h">Accordion</Eyebrow>
              <div className="mt-4 border border-rule bg-paper-raised p-5">
                <Accordion type="single" collapsible defaultValue="item-1">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>Filing cadence</AccordionTrigger>
                    <AccordionContent>
                      GSTR-3B is filed on the 20th of every month. Client has elected a
                      7-day grace buffer for reconciliation. ITRs are filed annually by
                      September 30.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2">
                    <AccordionTrigger>Handler assignments</AccordionTrigger>
                    <AccordionContent>
                      Priya Iyer is the primary handler for all GST filings. Arjun Rao
                      handles income tax. Escalations route to the partner-in-charge.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-3">
                    <AccordionTrigger>Notification rules</AccordionTrigger>
                    <AccordionContent>
                      The client receives a reminder 7 days before a filing due date,
                      another 48 hours before, and a final call on the morning of.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          </div>

          {/* ─── Breadcrumb + Progress + Badges ─── */}
          <div className="mt-10 grid grid-cols-12 gap-8">
            <div className="col-span-7">
              <Eyebrow tone="muted" mark="i">Breadcrumb</Eyebrow>
              <div className="mt-4 border border-rule bg-paper-raised p-5">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="#">Clients</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink href="#">Nilkanth Traders</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink href="#">Filings</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>GSTR-3B · Mar 2026</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </div>
            <div className="col-span-5">
              <Eyebrow tone="muted" mark="j">Badges · tones</Eyebrow>
              <div className="mt-4 border border-rule bg-paper-raised p-5 flex flex-wrap gap-2">
                <Badge tone="authority">In review</Badge>
                <Badge tone="filed">Filed</Badge>
                <Badge tone="due-soon">Due in 3d</Badge>
                <Badge tone="signal">Overdue</Badge>
                <Badge>Draft</Badge>
              </div>
            </div>
          </div>

          <div className="mt-10">
            <Eyebrow tone="muted" mark="k">Progress · this quarter</Eyebrow>
            <div className="mt-4 grid grid-cols-4 gap-4">
              <div className="border border-rule bg-paper-raised p-5 space-y-2">
                <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                  Filed (authority)
                </div>
                <Progress value={filingProgress} />
                <div className="text-[11px] text-ink font-mono tabular-nums">{filingProgress}%</div>
              </div>
              <div className="border border-rule bg-paper-raised p-5 space-y-2">
                <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                  Compliance (filed)
                </div>
                <Progress value={82} tone="filed" />
                <div className="text-[11px] text-ink font-mono tabular-nums">82%</div>
              </div>
              <div className="border border-rule bg-paper-raised p-5 space-y-2">
                <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                  Due this week (due-soon)
                </div>
                <Progress value={45} tone="due-soon" />
                <div className="text-[11px] text-ink font-mono tabular-nums">45%</div>
              </div>
              <div className="border border-rule bg-paper-raised p-5 space-y-2">
                <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                  Escalations (signal)
                </div>
                <Progress value={12} tone="signal" />
                <div className="text-[11px] text-ink font-mono tabular-nums">12%</div>
              </div>
            </div>
          </div>

          {/* ─── Date pickers ─── */}
          <div className="mt-10 grid grid-cols-12 gap-8">
            <div className="col-span-6">
              <Eyebrow tone="muted" mark="l">Date picker</Eyebrow>
              <div className="mt-4 border border-rule bg-paper-raised p-5 space-y-2">
                <Label>Filing date</Label>
                <FormDatePicker
                  value={selectedDate}
                  onChange={setSelectedDate}
                  placeholder="Pick a filing date…"
                />
                <p className="text-[11px] text-ink-muted font-serif italic mt-2">
                  Selected day fills authority; today is underlined in signal
                </p>
              </div>
            </div>
            <div className="col-span-6">
              <Eyebrow tone="muted" mark="m">Date range picker</Eyebrow>
              <div className="mt-4 border border-rule bg-paper-raised p-5 space-y-2">
                <Label>Reporting period</Label>
                <FormDateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  placeholder="Pick a reporting period…"
                />
                <p className="text-[11px] text-ink-muted font-serif italic mt-2">
                  Two-month view with range highlighting
                </p>
              </div>
            </div>
          </div>

          {/* ─── Tint washes ─── */}
          <div className="mt-10">
            <Eyebrow tone="muted" mark="n">Tint washes</Eyebrow>
            <div className="mt-4 grid grid-cols-4 gap-4">
              <div className="tint-authority py-4 pr-4">
                <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium">
                  Authority
                </div>
                <div className="mt-1 font-serif text-base text-ink">Awaiting review</div>
                <div className="text-[11px] text-ink-soft mt-1">4 filings in the queue</div>
              </div>
              <div className="tint-filed py-4 pr-4">
                <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium">
                  Filed
                </div>
                <div className="mt-1 font-serif text-base text-ink">68 this month</div>
                <div className="text-[11px] text-ink-soft mt-1">On pace for the quarter</div>
              </div>
              <div className="tint-due py-4 pr-4">
                <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium">
                  Due soon
                </div>
                <div className="mt-1 font-serif text-base text-ink">12 within 7 days</div>
                <div className="text-[11px] text-ink-soft mt-1">Reminders dispatched</div>
              </div>
              <div className="tint-signal py-4 pr-4">
                <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium">
                  Overdue
                </div>
                <div className="mt-1 font-serif text-base text-ink">3 escalations</div>
                <div className="text-[11px] text-ink-soft mt-1">Handler notified</div>
              </div>
            </div>
          </div>
        </PageSection>

        {/* §  XI — MOTION  ─────────────────────────────────────────────── */}
        <PageSection
          mark="§ XI — Motion"
          intro="Two ways to rearrange paper. A sortable list when order is all that matters, and a kanban board when the shape of a pipeline does. Both are built on the mature @dnd-kit/sortable line — the cards lift, the columns accept, and nothing flickers mid-drag."
          bodyClassName="mt-8"
        >
          {/* ─── Sortable list: handler priority ─── */}
          <div>
            <Eyebrow tone="muted" mark="a">Sortable list — reorder handlers</Eyebrow>
            <p className="mt-2 max-w-[56ch] text-[12px] text-ink-soft font-serif italic leading-snug">
              Drag a row by its handle to change the rotation order. The count
              column is the handler's live workload.
            </p>
            <div className="mt-4 max-w-md rounded-md border border-rule bg-paper-raised p-1.5">
              <Sortable items={handlerOrder} onReorder={setHandlerOrder}>
                {handlerOrder.map((handler, idx) => (
                  <SortableItem
                    key={handler.id}
                    id={handler.id}
                    withHandle
                    className="mb-1 last:mb-0 flex items-center gap-3 rounded-sm bg-paper px-2.5 py-2 text-sm"
                  >
                    <SortableHandle className="p-1 text-ink-muted">
                      <GripVertical className="h-4 w-4" />
                    </SortableHandle>
                    <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink-muted tabular-nums w-4">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 font-serif text-ink">{handler.name}</span>
                    <span className="font-mono text-[11px] tabular-nums text-ink-soft">
                      {handler.load}
                    </span>
                  </SortableItem>
                ))}
              </Sortable>
            </div>
          </div>

          {/* ─── Kanban board: filing pipeline ─── */}
          <div className="mt-10">
            <Eyebrow tone="muted" mark="b">Kanban — filing pipeline</Eyebrow>
            <p className="mt-2 max-w-[56ch] text-[12px] text-ink-soft font-serif italic leading-snug">
              Drag a filing between columns to move it through the pipeline.
              The in-review column has a soft cap of five — cards keep stacking
              but the count turns into the authority brass to signal the limit.
            </p>
            <div className="mt-4">
              <KanbanBoard
                columns={PIPELINE_COLUMNS}
                cards={pipelineCards}
                onCardMove={(event: KanbanCardMoveEvent) => {
                  setPipelineCards((prev) => {
                    const next = prev.filter((c) => c.id !== event.cardId);
                    const moved = { ...prev.find((c) => c.id === event.cardId)!, columnId: event.toColumnId };
                    const inTarget = next.filter((c) => c.columnId === event.toColumnId);
                    const others = next.filter((c) => c.columnId !== event.toColumnId);
                    inTarget.splice(event.toIndex, 0, moved);
                    return [...others, ...inTarget];
                  });
                  toast.info(`Moved ${event.cardId} → ${event.toColumnId}`);
                }}
                renderCard={(card) => {
                  const isFiled = card.columnId === 'filed';
                  return (
                    <div>
                      <div className="font-mono text-[12px] text-ink">{String(card.code)}</div>
                      <div className="mt-0.5 font-serif text-ink-soft">{String(card.client)}</div>
                      <div data-slot="kanban-card-meta">
                        {isFiled ? <CheckCircle2 className="h-3 w-3 text-filed" /> : <Calendar className="h-3 w-3" />}
                        <span>{String(card.due)}</span>
                      </div>
                    </div>
                  );
                }}
              />
            </div>
          </div>
        </PageSection>

        {/* §  XII — ICONOGRAPHY  ───────────────────────────────────────── */}
        <PageSection
          mark="§ XII — Iconography"
          intro="Two registers, kept in their lanes. Lucide sets the functional vocabulary — toolbar actions, form affordances, the small clerical gestures. Phosphor Thin handles the editorial motifs — scales, quills, stamps — that want to feel printed rather than drawn. Every icon defaults to the muted ink of the surrounding text; opt into color only when the icon is itself the signal."
          bodyClassName="mt-8"
        >

          {/* ─── Register A: Lucide (functional) ─── */}
          <div className="mt-8">
            <Eyebrow tone="muted" mark="a">Lucide — functional register</Eyebrow>
            <p className="mt-2 max-w-[56ch] text-[12px] text-ink-soft font-serif italic leading-snug">
              Paired with labels, stroked at 1.5px, sized to the text. They
              inherit ink-muted by default and lift to full ink on hover or
              active state.
            </p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-px bg-rule border border-rule">
              {[
                { Icon: Search, label: 'Search' },
                { Icon: Filter, label: 'Filter' },
                { Icon: Pencil, label: 'Edit' },
                { Icon: Trash2, label: 'Delete' },
                { Icon: Download, label: 'Export' },
                { Icon: Archive, label: 'Archive' },
                { Icon: Send, label: 'Send' },
                { Icon: CheckCircle2, label: 'Approve' },
                { Icon: Calendar, label: 'Schedule' },
                { Icon: Users, label: 'Assign' },
                { Icon: Mail, label: 'Notify' },
                { Icon: FileText, label: 'Draft' },
              ].map(({ Icon, label }) => (
                <div
                  key={label}
                  className="bg-paper-raised px-4 py-5 flex flex-col items-center gap-2"
                >
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                  <span className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Register B: Phosphor Thin (editorial) ─── */}
          <div className="mt-10">
            <Eyebrow tone="muted" mark="b">Phosphor Thin — editorial register</Eyebrow>
            <p className="mt-2 max-w-[56ch] text-[12px] text-ink-soft font-serif italic leading-snug">
              Used at display sizes as motif marks — section openers, empty
              states, the colophon. Thin weight reads like pen on paper and
              recedes into the serif body without demanding attention.
            </p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-px bg-rule border border-rule">
              {[
                { Icon: Scales, label: 'Law' },
                { Icon: Gavel, label: 'Ruling' },
                { Icon: BookOpenText, label: 'Library' },
                { Icon: Feather, label: 'Draft' },
                { Icon: Scroll, label: 'Filing' },
                { Icon: Stamp, label: 'Stamped' },
              ].map(({ Icon, label }) => (
                <div
                  key={label}
                  className="bg-paper-raised px-4 py-8 flex flex-col items-center gap-3"
                >
                  <Icon size={40} weight="thin" />
                  <span className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Tones: when an icon is itself the signal ─── */}
          <div className="mt-10">
            <Eyebrow tone="muted" mark="c">Tones — opt-in color</Eyebrow>
            <p className="mt-2 max-w-[56ch] text-[12px] text-ink-soft font-serif italic leading-snug">
              Set <code className="font-mono text-[11px] text-ink">data-tone</code> on
              any SVG to escape the muted default. Reserved for moments where
              the icon is the meaning — a stamped filing, a due-soon warning,
              the authority brass on a signature mark.
            </p>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-px bg-rule border border-rule">
              {[
                { Icon: AlertTriangle, label: 'Default', tone: undefined },
                { Icon: AlertTriangle, label: 'Ink', tone: 'ink' as const },
                { Icon: AlertTriangle, label: 'Authority', tone: 'authority' as const },
                { Icon: AlertTriangle, label: 'Due soon', tone: 'due-soon' as const },
                { Icon: CheckCircle2, label: 'Filed', tone: 'filed' as const },
              ].map(({ Icon, label, tone }) => (
                <div
                  key={label}
                  className="bg-paper-raised px-4 py-5 flex flex-col items-center gap-2"
                >
                  <Icon className="h-5 w-5" strokeWidth={1.5} data-tone={tone} />
                  <span className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                    {label}
                  </span>
                  <code className="font-mono text-[9px] text-ink-muted">
                    {tone ? `data-tone="${tone}"` : '—'}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </PageSection>

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
