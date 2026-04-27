import { useState, useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, useFormContext, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ChevronRight,
  BookTemplate,
  PenLine,
  Check,
  ArrowLeft,
} from 'lucide-react';
import {
  DrawerShell,
  DrawerHeader,
  Eyebrow,
  SectionRule,
  Button,
  Combobox,
  SearchInput,
  FormInput,
  FormSelect,
  FormTextarea,
} from '@packages/ui';
import { FREQUENCIES, type ComplianceFrequency } from '@domains/compliance-contract';
import { JurisdictionTag } from '../../../../../components';
import { RULE_TEMPLATES } from '../templates';
import { LAW_GROUPS } from '../filterOptions';
import type { RuleTemplate, LawGroupKey } from '../types';
import { FREQUENCY_LABEL, FREQUENCY_OPTIONS } from './FrequencyPill';

// ─── Types ───────────────────────────────────────────────────────────

type DrawerMode = 'pick' | 'template' | 'scratch';
type SlideDirection = 'forward' | 'back';

// ─── Animation config (inner panel slide between pick/form modes) ───

const EASE_OUT_EXPO = [0.32, 0.72, 0, 1] as const;

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

// ─── Schema ──────────────────────────────────────────────────────────

const complianceRuleSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
  lawId: z.string().min(1, 'Law is required'),
  frequency: z.string().min(1, 'Cadence is required'),
  dueDayOfMonth: z.string(),
  dueMonthOffset: z.string(),
  gracePeriodDays: z.string(),
});

type ComplianceRuleFormValues = z.infer<typeof complianceRuleSchema>;

/** External-facing shape — narrows the enum-like fields for onCreate consumers. */
export interface NewComplianceRuleValues {
  code: string;
  name: string;
  description: string;
  lawId: string;
  frequency: ComplianceFrequency | '';
  dueDayOfMonth: string;
  dueMonthOffset: string;
  gracePeriodDays: string;
}

export interface DrawerLawOption {
  id: string;
  code: string;
  name: string;
}

const EMPTY_FORM: ComplianceRuleFormValues = {
  code: '',
  name: '',
  description: '',
  lawId: '',
  frequency: '',
  dueDayOfMonth: '',
  dueMonthOffset: '0',
  gracePeriodDays: '0',
};

const TEMPLATE_LAW_OPTIONS = LAW_GROUPS.map((g) => ({ value: g.key, label: g.label }));

// ─── Props ───────────────────────────────────────────────────────────

export interface NewComplianceRuleDrawerProps {
  onClose?: () => void;
  onCreate?: (values: NewComplianceRuleValues, templateId?: string) => void;
  laws: DrawerLawOption[];
  isSubmitting?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────

export function NewComplianceRuleDrawer({
  onClose,
  onCreate,
  laws,
  isSubmitting,
}: NewComplianceRuleDrawerProps) {
  const [mode, setMode] = useState<DrawerMode>('pick');
  const [slideDir, setSlideDir] = useState<SlideDirection>('forward');
  const [selectedTemplate, setSelectedTemplate] = useState<RuleTemplate | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateLawFilter, setTemplateLawFilter] = useState<LawGroupKey | ''>('');
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const form = useForm<ComplianceRuleFormValues>({
    resolver: zodResolver(complianceRuleSchema),
    defaultValues: EMPTY_FORM,
  });

  const lawOptions = useMemo(
    () =>
      laws
        .filter((l) => l.id && l.name)
        .map((l) => ({
          value: l.id,
          label: l.code ? `${l.code} — ${l.name}` : l.name,
        })),
    [laws],
  );

  const lawByCode = useMemo(() => {
    const map = new Map<string, DrawerLawOption>();
    for (const law of laws) {
      if (law.code) map.set(law.code.toUpperCase(), law);
    }
    return map;
  }, [laws]);

  // ── Template search / filter ─────────────────────────────────────

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    return RULE_TEMPLATES.filter((t) => {
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
    const matchedLawId = tpl.lawCode ? lawByCode.get(tpl.lawCode.toUpperCase())?.id ?? '' : '';
    const templateFrequency: ComplianceRuleFormValues['frequency'] =
      (FREQUENCIES as readonly string[]).includes(tpl.frequency) ? tpl.frequency : '';
    form.reset({
      code: tpl.code,
      name: tpl.name,
      description: tpl.description,
      lawId: matchedLawId,
      frequency: templateFrequency,
      dueDayOfMonth: String(tpl.dueDayOfMonth),
      dueMonthOffset: String(tpl.dueMonthOffset),
      gracePeriodDays: String(tpl.gracePeriodDays),
    });
    setScheduleOpen(false);
    setSlideDir('forward');
    setMode('template');
  }

  function startScratch() {
    setSelectedTemplate(null);
    form.reset(EMPTY_FORM);
    setScheduleOpen(false);
    setSlideDir('forward');
    setMode('scratch');
  }

  function handleBack() {
    setSlideDir('back');
    setMode('pick');
    setSelectedTemplate(null);
  }

  const onSubmit = (values: ComplianceRuleFormValues) => {
    onCreate?.(values as NewComplianceRuleValues, selectedTemplate?.id);
  };

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <DrawerShell onClose={() => onClose?.()} width="lg">
        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col h-full"
          >
            <DrawerHeader
              eyebrow={
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
                    {mode === 'pick' && 'New Compliance Rule'}
                    {mode === 'template' && 'From template'}
                    {mode === 'scratch' && 'From scratch'}
                  </Eyebrow>
                </div>
              }
              title={
                <>
                  {mode === 'pick' && 'Add compliance rule'}
                  {mode === 'template' && (
                    <>
                      <span className="font-serif italic">Customise</span>{' '}
                      <span className="font-mono text-2xl">{selectedTemplate?.code}</span>
                    </>
                  )}
                  {mode === 'scratch' && 'New compliance rule'}
                </>
              }
              subtitle={
                <>
                  {mode === 'pick' &&
                    'Start from a standard template or create a custom rule from scratch.'}
                  {mode === 'template' &&
                    'Pre-filled from the template. Edit any field to customise for your firm.'}
                  {mode === 'scratch' && 'Define a custom rule not covered by standard templates.'}
                </>
              }
              onClose={() => onClose?.()}
            />

            {/* ── Body ────────────────────────────────────────────── */}
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
                      totalCount={RULE_TEMPLATES.length}
                      onPickTemplate={pickTemplate}
                      onStartScratch={startScratch}
                    />
                  )}
                  {(mode === 'template' || mode === 'scratch') && (
                    <FormBody
                      selectedTemplate={selectedTemplate}
                      scheduleOpen={scheduleOpen}
                      setScheduleOpen={setScheduleOpen}
                      isTemplate={mode === 'template'}
                      lawOptions={lawOptions}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Footer ──────────────────────────────────────────── */}
            {(mode === 'template' || mode === 'scratch') && (
              <FormFooter
                onCancel={() => onClose?.()}
                isTemplate={mode === 'template'}
                isSubmitting={isSubmitting ?? false}
              />
            )}
          </form>
        </FormProvider>
    </DrawerShell>
  );
}

// ─── Footer ─────────────────────────────────────────────────────────
// Inside FormProvider so it can read formState for the modified summary.

function FormFooter({
  onCancel,
  isTemplate,
  isSubmitting,
}: {
  onCancel: () => void;
  isTemplate: boolean;
  isSubmitting: boolean;
}) {
  const {
    formState: { dirtyFields },
  } = useFormContext<ComplianceRuleFormValues>();
  const modifiedCount = isTemplate
    ? Object.values(dirtyFields).filter(Boolean).length
    : 0;
  return (
    <footer className="px-6 pt-4 pb-6 border-t border-rule bg-paper-sunken/50 flex-none">
      {modifiedCount > 0 && (
        <p className="text-[10px] uppercase tracking-eyebrow text-due-soon font-sans font-medium mb-3">
          {modifiedCount} field{modifiedCount > 1 ? 's' : ''} modified from template
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" size="sm" className="ml-auto" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create as draft'}
        </Button>
      </div>
    </footer>
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
            Define a custom rule not found in the standard catalog.
          </p>
        </button>
      </div>

      <div className="px-6">
        <SectionRule label="Template catalog" align="left" />
      </div>

      {/* Search + law filter */}
      <div className="px-6 pt-3 pb-2 flex items-center gap-3">
        <SearchInput
          value={templateSearch}
          onChange={(e) => setTemplateSearch(e.target.value)}
          placeholder="Search templates..."
          wrapperClassName="flex-1"
        />
        <div className="min-w-[140px]">
          <Combobox
            value={templateLawFilter}
            onChange={(v) => setTemplateLawFilter(v as LawGroupKey | '')}
            options={[{ value: '', label: 'All laws' }, ...TEMPLATE_LAW_OPTIONS]}
            placeholder="All laws"
            searchPlaceholder="Search laws..."
          />
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
  selectedTemplate,
  scheduleOpen,
  setScheduleOpen,
  isTemplate,
  lawOptions,
}: {
  selectedTemplate: RuleTemplate | null;
  scheduleOpen: boolean;
  setScheduleOpen: (v: boolean) => void;
  isTemplate: boolean;
  lawOptions: { value: string; label: string }[];
}) {
  const {
    formState: { dirtyFields },
  } = useFormContext<ComplianceRuleFormValues>();
  const modifiedCount = isTemplate
    ? Object.values(dirtyFields).filter(Boolean).length
    : 0;

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
          {modifiedCount > 0 && (
            <span className="ml-auto text-[10px] uppercase tracking-eyebrow font-sans font-medium text-due-soon">
              Modified
            </span>
          )}
        </div>
      )}

      <ComplianceRuleField name="code" label="Code" required isTemplate={isTemplate}>
        <FormInput
          name="code"
          placeholder="e.g. GSTR-3B"
          ariaLabel="Code"
          inputClassName="uppercase tracking-tabular font-mono"
        />
      </ComplianceRuleField>

      <ComplianceRuleField name="name" label="Name" required isTemplate={isTemplate}>
        <FormInput
          name="name"
          placeholder="Short title for the rule"
          ariaLabel="Name"
        />
      </ComplianceRuleField>

      <ComplianceRuleField name="lawId" label="Law" required isTemplate={isTemplate}>
        <FormSelect
          name="lawId"
          options={lawOptions}
          placeholder="Select law"
        />
      </ComplianceRuleField>

      <ComplianceRuleField name="frequency" label="Cadence" required isTemplate={isTemplate}>
        <FormSelect
          name="frequency"
          options={FREQUENCY_OPTIONS}
          placeholder="Select cadence"
        />
      </ComplianceRuleField>

      <ComplianceRuleField name="description" label="Description" isTemplate={isTemplate}>
        <FormTextarea
          name="description"
          rows={3}
          placeholder="Brief description of this filing requirement"
          ariaLabel="Description"
        />
      </ComplianceRuleField>

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
              <ComplianceRuleField
                name="dueDayOfMonth"
                label="Due day"
                isTemplate={isTemplate}
              >
                <FormInput
                  name="dueDayOfMonth"
                  type="number"
                  placeholder="20"
                  ariaLabel="Due day"
                  inputClassName="font-mono tabular-nums"
                />
              </ComplianceRuleField>
              <ComplianceRuleField
                name="dueMonthOffset"
                label="Month offset"
                isTemplate={isTemplate}
              >
                <FormInput
                  name="dueMonthOffset"
                  type="number"
                  placeholder="1"
                  ariaLabel="Month offset"
                  inputClassName="font-mono tabular-nums"
                />
              </ComplianceRuleField>
              <ComplianceRuleField
                name="gracePeriodDays"
                label="Grace days"
                isTemplate={isTemplate}
              >
                <FormInput
                  name="gracePeriodDays"
                  type="number"
                  placeholder="0"
                  ariaLabel="Grace days"
                  inputClassName="font-mono tabular-nums"
                />
              </ComplianceRuleField>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Field wrapper ──────────────────────────────────────────────────
// Caller-owned label so we can colour/flag it when the template field
// has been modified. FormInput et al. render label-less underneath.

function ComplianceRuleField({
  name,
  label,
  required,
  isTemplate,
  children,
}: {
  name: keyof ComplianceRuleFormValues;
  label: string;
  required?: boolean;
  isTemplate: boolean;
  children: ReactNode;
}) {
  const {
    formState: { dirtyFields },
  } = useFormContext<ComplianceRuleFormValues>();
  const isModified = isTemplate && dirtyFields[name] === true;
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <label
          className={`block text-[10px] uppercase tracking-eyebrow font-sans font-medium transition-colors ${
            isModified ? 'text-due-soon' : 'text-ink-muted'
          }`}
        >
          {label}
          {required && <span className="text-signal ml-0.5">*</span>}
        </label>
        {isModified && <Check className="w-2.5 h-2.5 text-due-soon" strokeWidth={2} />}
      </div>
      {children}
    </div>
  );
}
