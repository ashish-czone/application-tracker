import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  X,
  FileText,
  MessageSquare,
  Paperclip,
  Clock,
  ChevronRight,
  ChevronDown,
  Upload,
  Send,
  ArrowRightCircle,
  GitBranch,
  UserPlus,
  FilePlus,
  Eye,
  Download,
  FileSpreadsheet,
  Check,
} from 'lucide-react';
import {
  Eyebrow,
  SectionRule,
  Calendar,
  Button,
  Form,
  FormTextarea,
  ActivityTimeline,
  type TimelineIconConfig,
} from '@packages/ui';
import { JurisdictionTag, UrgencyBadge, OrdinalDate } from '../../../../../components';
import type { FilingRow } from './filingsMock';
import { MOCK_HANDLERS } from '../../console-preview/mockData';
import type { Filing, Handler } from '../../../../../shared/types';

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

// ─── Status workflow ─────────────────────────────────────────────────

const STATUS_LABEL: Record<Filing['status'], string> = {
  overdue: 'Overdue',
  'due-today': 'Due today',
  'due-this-week': 'Due this week',
  upcoming: 'Upcoming',
  filed: 'Filed',
  draft: 'Draft',
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};

const PRIORITY_TONE: Record<string, string> = {
  critical: 'text-signal',
  high: 'text-due-soon',
  normal: 'text-ink-muted',
  low: 'text-ink-muted',
};

type DrawerMode = 'overview' | 'activity';

// ─── Note compose form ──────────────────────────────────────────────

const noteSchema = z.object({
  note: z.string().trim().min(1, 'Enter a note'),
});
type NoteFormValues = z.infer<typeof noteSchema>;

// ─── Props ───────────────────────────────────────────────────────────

export interface FilingDetailDrawerProps {
  filing: FilingRow;
  onClose?: () => void;
  onStatusChange?: (filingId: string, newStatus: Filing['status']) => void;
}

// ─── Component ───────────────────────────────────────────────────────

export function FilingDetailDrawer({ filing, onClose, onStatusChange }: FilingDetailDrawerProps) {
  const [mode, setMode] = useState<DrawerMode>('overview');

  const isFiled = filing.status === 'filed';
  const transitions = getTransitions(filing.status);

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
        className="relative w-full max-w-xl h-full bg-paper-raised border-l border-rule flex flex-col"
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <header className="px-6 pt-6 pb-4 border-b border-rule flex-none">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <Eyebrow tone="muted" mark="§">
                Filing detail
              </Eyebrow>
              <UrgencyBadge urgency={filing.status} />
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

          {/* Filing title */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[11px] tracking-tabular uppercase text-ink font-medium">
              {filing.lawCode}
            </span>
            <JurisdictionTag jurisdiction={filing.jurisdiction} />
          </div>
          <h2 className="font-serif text-2xl text-ink leading-tight">{filing.ruleName}</h2>
          <p className="font-serif italic text-ink-soft text-sm mt-1">
            for{' '}
            <span className="not-italic font-sans font-medium text-ink">{filing.clientName}</span>
            {' · '}
            <span className="font-mono text-[11px] tabular-nums">{filing.periodLabel}</span>
          </p>

          {/* Workflow transition bar */}
          {!isFiled && transitions.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              {transitions.map((t) => (
                <button
                  key={t.to}
                  type="button"
                  onClick={() => onStatusChange?.(filing.id, t.to)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-eyebrow font-sans font-semibold transition-colors ${
                    t.primary
                      ? 'bg-ink text-paper hover:brightness-110'
                      : 'border border-rule text-ink-muted hover:text-ink hover:border-ink'
                  }`}
                >
                  <ArrowRightCircle className="w-3 h-3" strokeWidth={2} />
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {isFiled && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 border border-filed/30 bg-filed/5">
              <span className="w-2 h-2 bg-filed flex-none" />
              <span className="text-[11px] font-sans font-medium text-filed uppercase tracking-eyebrow">
                Filed
              </span>
              {filing.filedDate && (
                <span className="text-[11px] font-sans text-ink-muted ml-1">
                  on <OrdinalDate date={filing.filedDate} variant="short" className="inline" />
                </span>
              )}
            </div>
          )}
        </header>

        {/* ── Mode toggle ────────────────────────────────────────── */}
        <div className="flex border-b border-rule flex-none">
          <button
            type="button"
            onClick={() => setMode('overview')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] uppercase tracking-eyebrow font-sans font-medium transition-colors border-b-2 -mb-px ${
              mode === 'overview'
                ? 'text-ink border-ink'
                : 'text-ink-muted border-transparent hover:text-ink'
            }`}
          >
            <FileText className="w-3 h-3" strokeWidth={1.5} />
            Overview
          </button>
          <button
            type="button"
            onClick={() => setMode('activity')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] uppercase tracking-eyebrow font-sans font-medium transition-colors border-b-2 -mb-px ${
              mode === 'activity'
                ? 'text-ink border-ink'
                : 'text-ink-muted border-transparent hover:text-ink'
            }`}
          >
            <Clock className="w-3 h-3" strokeWidth={1.5} />
            Activity
            {filing.activity.length > 0 && (
              <span className="font-mono text-[10px] tabular-nums text-ink-muted">
                {filing.activity.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        {mode === 'overview' ? (
          <OverviewBody filing={filing} />
        ) : (
          <ActivityBody filing={filing} />
        )}
      </motion.div>
    </div>
  );
}

// ─── Workflow transitions ────────────────────────────────────────────

interface Transition {
  to: Filing['status'];
  label: string;
  primary?: boolean;
}

function getTransitions(current: Filing['status']): Transition[] {
  switch (current) {
    case 'draft':
      return [{ to: 'upcoming', label: 'Publish', primary: true }];
    case 'upcoming':
    case 'due-this-week':
    case 'due-today':
    case 'overdue':
      return [{ to: 'filed', label: 'Mark as filed', primary: true }];
    case 'filed':
      return [];
    default:
      return [];
  }
}

// ─── Overview body (details + notes + files) ────────────────────────

function OverviewBody({ filing }: { filing: FilingRow }) {
  const [priority, setPriority] = useState(filing.priority);
  const [handler, setHandler] = useState<Handler | undefined>(filing.handler);
  const [dueDate, setDueDate] = useState(filing.dueDate);
  const [showUploadZone, setShowUploadZone] = useState(false);

  const noteForm = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: { note: '' },
  });

  const submitNote = (values: NoteFormValues) => {
    // Consumer will wire this to an API; for now, reset the compose field.
    void values;
    noteForm.reset({ note: '' });
  };

  const handlerOptions = MOCK_HANDLERS.map((h) => ({ value: h.id, label: h.name }));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* ── Details grid ──────────────────────────────────────── */}
        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <DetailField label="Status" value={STATUS_LABEL[filing.status]} />
            <InlineDropdown
              label="Priority"
              value={priority}
              options={PRIORITY_OPTIONS}
              onChange={setPriority}
              renderValue={(v) => (
                <span className={`text-sm font-sans ${PRIORITY_TONE[v]}`}>
                  {PRIORITY_LABEL[v]}
                </span>
              )}
              renderOption={(opt, isSelected) => (
                <>
                  <span className={`flex-1 ${PRIORITY_TONE[opt.value]}`}>{opt.label}</span>
                  {isSelected && <Check className="w-3 h-3 text-ink-muted" strokeWidth={2} />}
                </>
              )}
            />
            <InlineDatePicker
              label="Due date"
              value={dueDate}
              onChange={setDueDate}
            />
            <DetailField label="Period" value={filing.periodLabel} />
            <DetailField label="Law" value={filing.lawCode} mono />
            <DetailField label="Jurisdiction">
              <JurisdictionTag jurisdiction={filing.jurisdiction} />
            </DetailField>
            <DetailField label="Client" value={filing.clientName} />
            {handler && (
              <InlineDropdown
                label="Handler"
                value={handler.id}
                options={handlerOptions}
                onChange={(id) => {
                  const h = MOCK_HANDLERS.find((m) => m.id === id);
                  if (h) setHandler(h);
                }}
                renderValue={(v) => {
                  const h = MOCK_HANDLERS.find((m) => m.id === v);
                  if (!h) return null;
                  return (
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="w-6 h-6 bg-authority text-paper-raised text-[10px] font-sans font-semibold flex items-center justify-center flex-none"
                      >
                        {h.initials}
                      </span>
                      <span className="text-sm font-sans text-ink">{h.name}</span>
                    </div>
                  );
                }}
                renderOption={(opt, isSelected) => {
                  const h = MOCK_HANDLERS.find((m) => m.id === opt.value);
                  return (
                    <>
                      <span
                        aria-hidden
                        className="w-5 h-5 bg-authority text-paper-raised text-[9px] font-sans font-semibold flex items-center justify-center flex-none"
                      >
                        {h?.initials}
                      </span>
                      <span className="flex-1">{opt.label}</span>
                      {isSelected && <Check className="w-3 h-3 text-ink-muted" strokeWidth={2} />}
                    </>
                  );
                }}
              />
            )}
          </div>

          {filing.filedDate && (
            <>
              <div className="border-t border-rule mt-5 mb-4" />
              <div className="grid grid-cols-2 gap-4">
                <DetailField label="Filed on">
                  <OrdinalDate date={filing.filedDate} variant="short" className="text-sm" />
                </DetailField>
              </div>
            </>
          )}
        </div>

        {/* ── Files section ─────────────────────────────────────── */}
        <div className="px-6">
          <SectionRule />
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <Eyebrow tone="muted" mark="◈">
              Files
            </Eyebrow>
            <div className="flex items-center gap-2">
              {filing.attachments.length > 0 && (
                <span className="font-mono text-[10px] tabular-nums text-ink-muted">
                  {filing.attachments.length}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowUploadZone((v) => !v)}
                className="flex items-center gap-1 text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted hover:text-ink transition-colors"
              >
                <Upload className="w-3 h-3" strokeWidth={1.5} />
                Attach
              </button>
            </div>
          </div>

          {/* Upload zone — shown on demand */}
          {showUploadZone && (
            <button
              type="button"
              className="w-full border border-dashed border-rule hover:border-ink py-4 flex items-center justify-center gap-2 transition-colors group mb-3"
            >
              <Upload className="w-3.5 h-3.5 text-ink-muted group-hover:text-ink" strokeWidth={1.5} />
              <span className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted group-hover:text-ink">
                Drop files or click to upload
              </span>
            </button>
          )}

          {filing.attachments.length === 0 && (
            <p className="text-[11px] text-ink-muted font-sans text-center py-2">No files attached</p>
          )}

          <div className="space-y-1">
            {filing.attachments.map((att) => {
              const ext = att.name.split('.').pop()?.toLowerCase() ?? '';
              const viewable = ['pdf', 'csv', 'txt'].includes(ext);
              const FileIcon = ['xls', 'xlsx', 'csv'].includes(ext) ? FileSpreadsheet : FileText;

              return (
                <div
                  key={att.id}
                  className="flex items-center gap-3 px-3 py-2.5 group hover:bg-paper-sunken/40 transition-colors -mx-1"
                >
                  <div className="w-7 h-7 bg-paper-sunken border border-rule flex items-center justify-center flex-none">
                    <FileIcon className="w-3 h-3 text-ink-muted" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink font-sans truncate">{att.name}</div>
                    <div className="text-[10px] text-ink-muted font-sans">
                      {att.size} · {att.uploadedBy.name} · {formatUploadDate(att.uploadedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-none">
                    {viewable ? (
                      <button
                        type="button"
                        className="w-6 h-6 flex items-center justify-center hover:bg-paper-sunken border border-transparent hover:border-rule transition-colors"
                        title="View"
                      >
                        <Eye className="w-3 h-3 text-ink-muted" strokeWidth={1.5} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="w-6 h-6 flex items-center justify-center hover:bg-paper-sunken border border-transparent hover:border-rule transition-colors"
                        title="Download"
                      >
                        <Download className="w-3 h-3 text-ink-muted" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Notes section ─────────────────────────────────────── */}
        <div className="px-6">
          <SectionRule />
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <Eyebrow tone="muted" mark="¶">
              Notes
            </Eyebrow>
            {filing.notes.length > 0 && (
              <span className="font-mono text-[10px] tabular-nums text-ink-muted">
                {filing.notes.length}
              </span>
            )}
          </div>

          {filing.notes.length === 0 && (
            <div className="text-center py-4">
              <p className="text-[11px] text-ink-muted font-sans">No notes yet — add one below.</p>
            </div>
          )}

          <div className="space-y-3">
            {filing.notes.map((note) => (
              <div key={note.id} className="border-l-2 border-rule pl-3 py-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    aria-hidden
                    className="w-5 h-5 bg-authority text-paper-raised text-[9px] font-sans font-semibold flex items-center justify-center flex-none"
                  >
                    {note.author.initials}
                  </span>
                  <span className="text-[11px] font-sans font-medium text-ink">{note.author.name}</span>
                  <span className="text-[10px] font-mono tabular-nums text-ink-muted ml-auto">
                    <OrdinalDate date={note.createdAt} variant="short" className="inline text-[10px]" />
                  </span>
                </div>
                <p className="text-sm text-ink font-sans leading-relaxed">{note.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Compose bar (sticky bottom) ──────────────────────────── */}
      <Form
        form={noteForm}
        onSubmit={noteForm.handleSubmit(submitNote)}
        className="px-6 py-3 border-t border-rule bg-paper-sunken/50 flex-none space-y-0"
      >
        <div className="flex items-end gap-2">
          <FormTextarea
            name="note"
            rows={1}
            placeholder="Add a note…"
            ariaLabel="Add a note"
            className="flex-1"
          />
          <Button
            type="submit"
            size="sm"
            className="self-end"
            aria-label="Send note"
          >
            <Send className="w-3.5 h-3.5" strokeWidth={2} />
          </Button>
        </div>
      </Form>
    </div>
  );
}

// ─── Detail field ───────────────────────────────────────────────────

function DetailField({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
        {label}
      </div>
      {children ?? (
        <div className={`text-sm text-ink ${mono ? 'font-mono tracking-tabular uppercase' : 'font-sans'}`}>
          {value}
        </div>
      )}
    </div>
  );
}

// ─── Inline dropdown (custom, not native select) ────────────────────

function InlineDropdown<T extends string>({
  label,
  value,
  options,
  renderValue,
  renderOption,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  renderValue: (v: T) => React.ReactNode;
  renderOption?: (opt: { value: T; label: string }, isSelected: boolean) => React.ReactNode;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, updatePos]);

  return (
    <div>
      <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
        {label}
      </div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 group -ml-1.5 pl-1.5 pr-1 py-0.5 border-b border-dashed border-rule hover:border-rule hover:bg-paper-sunken transition-colors"
      >
        {renderValue(value)}
        <ChevronDown className="w-3 h-3 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] min-w-[160px] bg-paper-raised border border-rule shadow-lg py-1"
          style={{ top: pos.top, left: pos.left }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-sm font-sans transition-colors ${
                  isSelected ? 'bg-paper-sunken/60 text-ink' : 'text-ink hover:bg-paper-sunken/40'
                }`}
              >
                {renderOption ? renderOption(opt, isSelected) : (
                  <>
                    <span className="flex-1">{opt.label}</span>
                    {isSelected && <Check className="w-3 h-3 text-ink-muted" strokeWidth={2} />}
                  </>
                )}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Inline date picker (portal-based calendar) ──────────────────────

function InlineDatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string; // ISO date string
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const calW = 288;
    const left = Math.min(rect.left, window.innerWidth - calW - 12);
    setPos({ top: rect.bottom + 4, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, updatePos]);

  const selected = new Date(value);

  return (
    <div>
      <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
        {label}
      </div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 group -ml-1.5 pl-1.5 pr-1 py-0.5 border-b border-dashed border-rule hover:border-rule hover:bg-paper-sunken transition-colors"
      >
        <OrdinalDate date={value} variant="short" className="text-sm" />
        <ChevronDown className="w-3 h-3 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[9999] bg-paper-raised border border-rule shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(day) => {
              if (day) {
                onChange(day.toISOString());
                setOpen(false);
              }
            }}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}

const PRIORITY_OPTIONS: { value: FilingRow['priority']; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

// ─── Activity body (shared timeline) ─────────────────────────────────

const FILING_ACTIVITY_ICONS: Record<string, TimelineIconConfig> = {
  'status-change': {
    icon: GitBranch,
    bg: 'bg-authority/10',
    ring: 'ring-authority/30',
    iconColor: 'text-authority',
  },
  assigned: {
    icon: UserPlus,
    bg: 'bg-due-soon/10',
    ring: 'ring-due-soon/30',
    iconColor: 'text-due-soon',
  },
  created: {
    icon: FilePlus,
    bg: 'bg-filed/10',
    ring: 'ring-filed/30',
    iconColor: 'text-filed',
  },
  'note-added': {
    icon: MessageSquare,
    bg: 'bg-ink/5',
    ring: 'ring-ink/15',
    iconColor: 'text-ink-muted',
  },
  'attachment-added': {
    icon: Paperclip,
    bg: 'bg-ink/5',
    ring: 'ring-ink/15',
    iconColor: 'text-ink-muted',
  },
};

function ActivityBody({ filing }: { filing: FilingRow }) {
  return (
    <div className="flex-1 overflow-y-auto py-5">
      <ActivityTimeline
        events={filing.activity}
        iconConfig={FILING_ACTIVITY_ICONS}
        emptyLabel="No activity recorded"
        emptyHint="Actions on this filing will appear here."
      />
    </div>
  );
}

function formatUploadDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
