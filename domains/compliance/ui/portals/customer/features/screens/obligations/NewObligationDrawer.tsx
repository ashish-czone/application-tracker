import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  ChevronDown,
  ChevronRight,
  BookTemplate,
  PenLine,
  Check,
  ArrowLeft,
} from 'lucide-react';
import { Eyebrow, SectionRule, JurisdictionTag } from '@packages/ui';
import {
  MOCK_RULE_TEMPLATES,
  LAW_GROUPS,
  type RuleTemplate,
  type ObligationFrequency,
  type LawGroupKey,
} from './obligationsMock';

// ─── Types ───────────────────────────────────────────────────────────

type DrawerMode = 'pick' | 'template' | 'scratch';
type SlideDirection = 'forward' | 'back';

// ─── Animation config ────────────────────────────────────────────────

const EASE_OUT_EXPO = [0.32, 0.72, 0, 1] as const;

const drawerVariants = {
  hidden: { x: '100%' },
  visible: { x: 0 },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants = {
  enter: (dir: SlideDirection) => ({
    opacity: 0,
    x: dir === 'forward' ? 24 : -24,
  }),
  center: { opacity: 1, x: 0 },
  exit: (dir: SlideDirection) => ({
    opacity: 0,
    x: dir === 'forward' ? -24 : 24,
  }),
};

interface FormValues {
  code: string;
  name: string;
  description: string;
  lawGroup: LawGroupKey | '';
  frequency: ObligationFrequency | '';
  dueDayOfMonth: string;
  dueMonthOffset: string;
  gracePeriodDays: string;
}

const EMPTY_FORM: FormValues = {
  code: '',
  name: '',
  description: '',
  lawGroup: '',
  frequency: '',
  dueDayOfMonth: '',
  dueMonthOffset: '0',
  gracePeriodDays: '0',
};

const FREQUENCY_LABEL: Record<ObligationFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  'half-yearly': 'Half-yearly',
  yearly: 'Yearly',
  event: 'On event',
  'ad-hoc': 'Ad-hoc',
};

// ─── Props ───────────────────────────────────────────────────────────

export interface NewObligationDrawerProps {
  onClose?: () => void;
  onCreate?: (values: FormValues, templateId?: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────

export function NewObligationDrawer({ onClose, onCreate }: NewObligationDrawerProps) {
  const [mode, setMode] = useState<DrawerMode>('pick');
  const [slideDir, setSlideDir] = useState<SlideDirection>('forward');
  const [selectedTemplate, setSelectedTemplate] = useState<RuleTemplate | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateLawFilter, setTemplateLawFilter] = useState<LawGroupKey | ''>('');
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [modified, setModified] = useState<Set<keyof FormValues>>(new Set());

  // ── Template search / filter ─────────────────────────────────────

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    return MOCK_RULE_TEMPLATES.filter((t) => {
      if (templateLawFilter && t.lawGroup !== templateLawFilter) return false;
      if (q && !`${t.code} ${t.name} ${t.lawName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [templateSearch, templateLawFilter]);

  const groupedTemplates = useMemo(() => {
    const groups: Record<string, RuleTemplate[]> = {};
    for (const t of filteredTemplates) {
      const label = LAW_GROUPS.find((g) => g.key === t.lawGroup)?.label ?? t.lawGroup;
      (groups[label] ??= []).push(t);
    }
    return groups;
  }, [filteredTemplates]);

  // ── Handlers ─────────────────────────────────────────────────────

  function pickTemplate(tpl: RuleTemplate) {
    setSelectedTemplate(tpl);
    setForm({
      code: tpl.code,
      name: tpl.name,
      description: tpl.description,
      lawGroup: tpl.lawGroup,
      frequency: tpl.frequency,
      dueDayOfMonth: String(tpl.dueDayOfMonth),
      dueMonthOffset: String(tpl.dueMonthOffset),
      gracePeriodDays: String(tpl.gracePeriodDays),
    });
    setModified(new Set());
    setScheduleOpen(false);
    setSlideDir('forward');
    setMode('template');
  }

  function startScratch() {
    setSelectedTemplate(null);
    setForm(EMPTY_FORM);
    setModified(new Set());
    setScheduleOpen(false);
    setSlideDir('forward');
    setMode('scratch');
  }

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (selectedTemplate) {
      const templateValue = String(selectedTemplate[key as keyof RuleTemplate] ?? '');
      if (value !== templateValue) {
        setModified((prev) => new Set(prev).add(key));
      } else {
        setModified((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    }
  }

  function handleBack() {
    setSlideDir('back');
    setMode('pick');
    setSelectedTemplate(null);
  }

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <motion.div
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]"
        onClick={() => onClose?.()}
        aria-hidden
      />

      {/* Drawer panel */}
      <motion.div
        variants={drawerVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
        className="relative w-full max-w-lg h-full bg-paper-raised border-l border-rule flex flex-col"
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <header className="px-6 pt-6 pb-4 border-b border-rule flex-none">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              {mode !== 'pick' && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-ink-muted hover:text-ink transition-colors -ml-1"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                </button>
              )}
              <Eyebrow tone="muted" mark="§">
                {mode === 'pick' && 'New Obligation'}
                {mode === 'template' && 'From template'}
                {mode === 'scratch' && 'From scratch'}
              </Eyebrow>
            </div>
            <button
              type="button"
              onClick={() => onClose?.()}
              className="text-ink-muted hover:text-ink transition-colors -mt-1 -mr-1"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
          <h2 className="font-serif text-3xl text-ink leading-tight">
            {mode === 'pick' && 'Add obligation'}
            {mode === 'template' && (
              <>
                <span className="font-serif italic">Customise</span>{' '}
                <span className="font-mono text-2xl">{selectedTemplate?.code}</span>
              </>
            )}
            {mode === 'scratch' && 'New obligation'}
          </h2>
          <p className="font-serif italic text-ink-soft text-sm mt-2">
            {mode === 'pick' &&
              'Start from a standard template or create a custom obligation from scratch.'}
            {mode === 'template' &&
              'Pre-filled from the template. Edit any field to customise for your firm.'}
            {mode === 'scratch' && 'Define a custom obligation not covered by standard templates.'}
          </p>
        </header>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" custom={slideDir}>
            <motion.div
              key={mode}
              custom={slideDir}
              variants={panelVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
            >
              {mode === 'pick' && (
                <PickModeBody
                  templateSearch={templateSearch}
                  setTemplateSearch={setTemplateSearch}
                  templateLawFilter={templateLawFilter}
                  setTemplateLawFilter={setTemplateLawFilter}
                  groupedTemplates={groupedTemplates}
                  filteredCount={filteredTemplates.length}
                  totalCount={MOCK_RULE_TEMPLATES.length}
                  onPickTemplate={pickTemplate}
                  onStartScratch={startScratch}
                />
              )}
              {(mode === 'template' || mode === 'scratch') && (
                <FormBody
                  form={form}
                  updateField={updateField}
                  modified={modified}
                  selectedTemplate={selectedTemplate}
                  scheduleOpen={scheduleOpen}
                  setScheduleOpen={setScheduleOpen}
                  isTemplate={mode === 'template'}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        {(mode === 'template' || mode === 'scratch') && (
          <footer className="px-6 pt-4 pb-6 border-t border-rule bg-paper-sunken/50 flex-none">
            {mode === 'template' && modified.size > 0 && (
              <p className="text-[10px] uppercase tracking-eyebrow text-due-soon font-sans font-medium mb-3">
                {modified.size} field{modified.size > 1 ? 's' : ''} modified from template
              </p>
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onClose?.()}
                className="text-[11px] uppercase tracking-eyebrow text-ink-muted font-sans font-medium hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onCreate?.(form, selectedTemplate?.id)}
                className="ml-auto px-5 py-2.5 bg-ink text-paper text-[11px] uppercase tracking-eyebrow font-sans font-semibold hover:brightness-110 transition-[filter]"
              >
                Create as draft
              </button>
            </div>
          </footer>
        )}
      </motion.div>
    </div>
  );
}

// ─── Pick mode: template catalog + scratch option ────────────────────

function PickModeBody({
  templateSearch,
  setTemplateSearch,
  templateLawFilter,
  setTemplateLawFilter,
  groupedTemplates,
  filteredCount,
  totalCount,
  onPickTemplate,
  onStartScratch,
}: {
  templateSearch: string;
  setTemplateSearch: (v: string) => void;
  templateLawFilter: LawGroupKey | '';
  setTemplateLawFilter: (v: LawGroupKey | '') => void;
  groupedTemplates: Record<string, RuleTemplate[]>;
  filteredCount: number;
  totalCount: number;
  onPickTemplate: (t: RuleTemplate) => void;
  onStartScratch: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Mode cards */}
      <div className="px-6 pt-5 pb-4 grid grid-cols-2 gap-3">
        <div className="border border-ink bg-paper-raised px-4 py-3.5 cursor-default">
          <div className="flex items-center gap-2 mb-1.5">
            <BookTemplate className="w-3.5 h-3.5 text-ink" strokeWidth={1.5} />
            <span className="text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-ink">
              From template
            </span>
          </div>
          <p className="text-[11px] text-ink-muted font-sans leading-relaxed">
            Pick a standard rule and customise schedule, grace period, or name for your firm.
          </p>
        </div>
        <button
          type="button"
          onClick={onStartScratch}
          className="border border-rule hover:border-ink bg-paper-raised px-4 py-3.5 text-left transition-colors group"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <PenLine className="w-3.5 h-3.5 text-ink-muted group-hover:text-ink" strokeWidth={1.5} />
            <span className="text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-ink-muted group-hover:text-ink">
              From scratch
            </span>
          </div>
          <p className="text-[11px] text-ink-muted font-sans leading-relaxed">
            Define a custom obligation not found in the standard catalog.
          </p>
        </button>
      </div>

      <div className="px-6">
        <SectionRule label="Template catalog" align="left" />
      </div>

      {/* Search + law filter */}
      <div className="px-6 pt-3 pb-2 flex items-center gap-3">
        <label className="flex items-center gap-2 flex-1 border-b border-rule focus-within:border-ink transition-colors pb-1">
          <Search className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
          <input
            type="text"
            value={templateSearch}
            onChange={(e) => setTemplateSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full bg-transparent outline-none text-sm text-ink placeholder:text-ink-muted font-sans"
          />
        </label>
        <div className="relative">
          <select
            value={templateLawFilter}
            onChange={(e) => setTemplateLawFilter(e.target.value as LawGroupKey | '')}
            className="appearance-none bg-transparent border border-rule px-3 py-1.5 pr-7 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted hover:text-ink hover:border-ink cursor-pointer transition-colors"
          >
            <option value="">All laws</option>
            {LAW_GROUPS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-muted pointer-events-none" strokeWidth={1.5} />
        </div>
      </div>

      {/* Result count */}
      <div className="px-6 pb-2">
        <span className="font-mono text-[11px] tabular-nums text-ink-soft">
          {filteredCount} of {totalCount}
        </span>
      </div>

      {/* Template list grouped by law */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
        {Object.entries(groupedTemplates).map(([groupLabel, templates]) => (
          <div key={groupLabel}>
            <Eyebrow tone="muted" className="mb-2">
              {groupLabel}
            </Eyebrow>
            <div className="space-y-0 border border-rule divide-y divide-rule">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onPickTemplate(tpl)}
                  className="w-full text-left px-4 py-3 hover:bg-paper-sunken/60 transition-colors group flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] tracking-tabular uppercase text-ink font-medium">
                        {tpl.code}
                      </span>
                      <JurisdictionTag jurisdiction={tpl.jurisdiction} />
                      <span className="text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted">
                        {FREQUENCY_LABEL[tpl.frequency]}
                      </span>
                    </div>
                    <p className="text-sm text-ink-soft font-sans leading-snug mt-0.5 truncate">
                      {tpl.name}
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity flex-none" strokeWidth={1.5} />
                </button>
              ))}
            </div>
          </div>
        ))}
        {filteredCount === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-ink-muted font-sans">No templates match your search.</p>
            <button
              type="button"
              onClick={onStartScratch}
              className="mt-2 text-[11px] uppercase tracking-eyebrow font-sans font-semibold text-authority hover:text-ink transition-colors"
            >
              Create from scratch instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Form body: template (pre-filled) or scratch (blank) ────────────

function FormBody({
  form,
  updateField,
  modified,
  selectedTemplate,
  scheduleOpen,
  setScheduleOpen,
  isTemplate,
}: {
  form: FormValues;
  updateField: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
  modified: Set<keyof FormValues>;
  selectedTemplate: RuleTemplate | null;
  scheduleOpen: boolean;
  setScheduleOpen: (v: boolean) => void;
  isTemplate: boolean;
}) {
  return (
    <div className="px-6 py-5 space-y-5">
      {/* Template provenance badge */}
      {isTemplate && selectedTemplate && (
        <div className="flex items-center gap-2 px-3 py-2 border border-rule bg-paper-sunken/40">
          <BookTemplate className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
          <span className="text-[11px] font-sans text-ink-muted">
            Based on template{' '}
            <span className="font-mono font-medium text-ink">{selectedTemplate.code}</span>
          </span>
          {modified.size > 0 && (
            <span className="ml-auto text-[10px] uppercase tracking-eyebrow font-sans font-medium text-due-soon">
              Modified
            </span>
          )}
        </div>
      )}

      {/* Code */}
      <FieldRow
        label="Code"
        required
        modified={modified.has('code')}
        isTemplate={isTemplate}
      >
        <input
          type="text"
          value={form.code}
          onChange={(e) => updateField('code', e.target.value.toUpperCase())}
          placeholder="e.g. GSTR-3B"
          className="w-full bg-transparent outline-none text-sm text-ink font-mono uppercase tracking-tabular placeholder:text-ink-muted placeholder:normal-case"
        />
      </FieldRow>

      {/* Name */}
      <FieldRow
        label="Name"
        required
        modified={modified.has('name')}
        isTemplate={isTemplate}
      >
        <input
          type="text"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Short title for the obligation"
          className="w-full bg-transparent outline-none text-sm text-ink font-sans placeholder:text-ink-muted"
        />
      </FieldRow>

      {/* Law */}
      <FieldRow
        label="Law"
        required
        modified={modified.has('lawGroup')}
        isTemplate={isTemplate}
      >
        <div className="relative w-full">
          <select
            value={form.lawGroup}
            onChange={(e) => updateField('lawGroup', e.target.value as LawGroupKey | '')}
            className="w-full appearance-none bg-transparent outline-none text-sm text-ink font-sans cursor-pointer pr-6"
          >
            <option value="" disabled>
              Select law group
            </option>
            {LAW_GROUPS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted pointer-events-none" strokeWidth={1.5} />
        </div>
      </FieldRow>

      {/* Frequency */}
      <FieldRow
        label="Cadence"
        required
        modified={modified.has('frequency')}
        isTemplate={isTemplate}
      >
        <div className="relative w-full">
          <select
            value={form.frequency}
            onChange={(e) => updateField('frequency', e.target.value as ObligationFrequency | '')}
            className="w-full appearance-none bg-transparent outline-none text-sm text-ink font-sans cursor-pointer pr-6"
          >
            <option value="" disabled>
              Select cadence
            </option>
            {Object.entries(FREQUENCY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted pointer-events-none" strokeWidth={1.5} />
        </div>
      </FieldRow>

      {/* Description */}
      <FieldRow
        label="Description"
        modified={modified.has('description')}
        isTemplate={isTemplate}
      >
        <textarea
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Brief description of this filing requirement"
          rows={3}
          className="w-full bg-transparent outline-none text-sm text-ink font-serif italic placeholder:text-ink-muted resize-none leading-relaxed"
        />
      </FieldRow>

      {/* Schedule details — collapsible */}
      <div>
        <button
          type="button"
          onClick={() => setScheduleOpen(!scheduleOpen)}
          className="flex items-center gap-2 w-full group"
        >
          <ChevronRight
            className={`w-3.5 h-3.5 text-ink-muted transition-transform duration-200 ${scheduleOpen ? 'rotate-90' : ''}`}
            strokeWidth={1.5}
          />
          <SectionRule label="Schedule details" align="left" className="flex-1" />
        </button>

        <div
          className="grid transition-[grid-template-rows] duration-250 ease-out"
          style={{ gridTemplateRows: scheduleOpen ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="mt-4 grid grid-cols-3 gap-4 pb-1">
              <FieldRow
                label="Due day"
                compact
                modified={modified.has('dueDayOfMonth')}
                isTemplate={isTemplate}
              >
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={form.dueDayOfMonth}
                  onChange={(e) => updateField('dueDayOfMonth', e.target.value)}
                  placeholder="20"
                  className="w-full bg-transparent outline-none text-sm text-ink font-mono tabular-nums placeholder:text-ink-muted"
                />
              </FieldRow>
              <FieldRow
                label="Month offset"
                compact
                modified={modified.has('dueMonthOffset')}
                isTemplate={isTemplate}
              >
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={form.dueMonthOffset}
                  onChange={(e) => updateField('dueMonthOffset', e.target.value)}
                  placeholder="1"
                  className="w-full bg-transparent outline-none text-sm text-ink font-mono tabular-nums placeholder:text-ink-muted"
                />
              </FieldRow>
              <FieldRow
                label="Grace days"
                compact
                modified={modified.has('gracePeriodDays')}
                isTemplate={isTemplate}
              >
                <input
                  type="number"
                  min={0}
                  value={form.gracePeriodDays}
                  onChange={(e) => updateField('gracePeriodDays', e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent outline-none text-sm text-ink font-mono tabular-nums placeholder:text-ink-muted"
                />
              </FieldRow>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Field row ───────────────────────────────────────────────────────

function FieldRow({
  label,
  required,
  modified,
  isTemplate,
  compact,
  children,
}: {
  label: string;
  required?: boolean;
  modified?: boolean;
  isTemplate?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <label
          className={`block text-[10px] uppercase tracking-eyebrow font-sans font-medium transition-colors ${
            modified ? 'text-due-soon' : 'text-ink-muted'
          }`}
        >
          {label}
          {required && <span className="text-signal ml-0.5">*</span>}
        </label>
        {isTemplate && modified && (
          <Check className="w-2.5 h-2.5 text-due-soon" strokeWidth={2} />
        )}
      </div>
      <div
        className={`border-b transition-colors ${
          modified ? 'border-due-soon' : 'border-rule'
        } focus-within:border-ink ${compact ? 'pb-1' : 'pb-1.5'}`}
      >
        {children}
      </div>
    </div>
  );
}
