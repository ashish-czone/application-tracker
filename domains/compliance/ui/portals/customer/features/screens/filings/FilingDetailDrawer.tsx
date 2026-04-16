import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  FileText,
  MessageSquare,
  Paperclip,
  Clock,
  ChevronRight,
  Upload,
  Send,
  ArrowRightCircle,
  GitBranch,
  UserPlus,
  FilePlus,
} from 'lucide-react';
import {
  Eyebrow,
  JurisdictionTag,
  UrgencyBadge,
  OrdinalDate,
  SectionRule,
} from '@packages/ui';
import type { FilingRow, FilingActivity } from './filingsMock';
import type { Filing } from '../../../../../shared/types';

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

// ─── Props ───────────────────────────────────────────────────────────

export interface FilingDetailDrawerProps {
  filing: FilingRow;
  onClose?: () => void;
  onStatusChange?: (filingId: string, newStatus: Filing['status']) => void;
}

// ─── Component ───────────────────────────────────────────────────────

export function FilingDetailDrawer({ filing, onClose, onStatusChange }: FilingDetailDrawerProps) {
  const [mode, setMode] = useState<DrawerMode>('overview');
  const [noteText, setNoteText] = useState('');

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
          <OverviewBody
            filing={filing}
            noteText={noteText}
            setNoteText={setNoteText}
          />
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

function OverviewBody({
  filing,
  noteText,
  setNoteText,
}: {
  filing: FilingRow;
  noteText: string;
  setNoteText: (v: string) => void;
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* ── Details grid ──────────────────────────────────────── */}
        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <DetailField label="Status" value={STATUS_LABEL[filing.status]} />
            <DetailField
              label="Priority"
              value={
                <span className={PRIORITY_TONE[filing.priority]}>
                  {PRIORITY_LABEL[filing.priority]}
                </span>
              }
            />
            <DetailField label="Due date">
              <OrdinalDate date={filing.dueDate} variant="short" className="text-sm" />
            </DetailField>
            <DetailField label="Period" value={filing.periodLabel} />
            <DetailField label="Law" value={filing.lawCode} mono />
            <DetailField label="Jurisdiction">
              <JurisdictionTag jurisdiction={filing.jurisdiction} />
            </DetailField>
            <DetailField label="Client" value={filing.clientName} />
            {filing.handler && (
              <DetailField label="Handler">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="w-6 h-6 bg-authority text-paper-raised text-[10px] font-sans font-semibold flex items-center justify-center flex-none"
                  >
                    {filing.handler.initials}
                  </span>
                  <span className="text-sm font-sans text-ink">{filing.handler.name}</span>
                </div>
              </DetailField>
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
            {filing.attachments.length > 0 && (
              <span className="font-mono text-[10px] tabular-nums text-ink-muted">
                {filing.attachments.length}
              </span>
            )}
          </div>

          {/* Upload zone */}
          <button
            type="button"
            className="w-full border border-dashed border-rule hover:border-ink py-4 flex items-center justify-center gap-2 transition-colors group mb-3"
          >
            <Upload className="w-3.5 h-3.5 text-ink-muted group-hover:text-ink" strokeWidth={1.5} />
            <span className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted group-hover:text-ink">
              Drop files or click to upload
            </span>
          </button>

          {filing.attachments.length === 0 && (
            <p className="text-[11px] text-ink-muted font-sans text-center py-2">No files attached</p>
          )}

          <div className="space-y-1">
            {filing.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-3 px-3 py-2.5 group hover:bg-paper-sunken/40 transition-colors -mx-1"
              >
                <div className="w-7 h-7 bg-paper-sunken border border-rule flex items-center justify-center flex-none">
                  <Paperclip className="w-3 h-3 text-ink-muted" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink font-sans truncate">{att.name}</div>
                  <div className="text-[10px] text-ink-muted font-sans">
                    {att.size} · {att.uploadedBy.name}
                  </div>
                </div>
                <ChevronRight className="w-3 h-3 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity flex-none" strokeWidth={1.5} />
              </div>
            ))}
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
      <div className="px-6 py-3 border-t border-rule bg-paper-sunken/50 flex-none">
        <div className="flex items-end gap-2">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note…"
            rows={1}
            className="flex-1 bg-transparent border border-rule focus:border-ink outline-none px-3 py-2 text-sm text-ink font-sans placeholder:text-ink-muted resize-none transition-colors"
          />
          <button
            type="button"
            className="px-3 py-2 bg-ink text-paper text-[11px] uppercase tracking-eyebrow font-sans font-semibold hover:brightness-110 transition-[filter] self-end"
          >
            <Send className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
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

// ─── Activity body (redesigned timeline) ────────────────────────────

const ACTIVITY_CONFIG: Record<
  string,
  { icon: typeof Clock; bg: string; ring: string; iconColor: string }
> = {
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
  const sorted = [...filing.activity].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <div className="flex-1 overflow-y-auto py-5">
      {sorted.length === 0 && (
        <div className="text-center py-12 px-6">
          <div className="w-10 h-10 mx-auto mb-3 bg-paper-sunken border border-rule flex items-center justify-center">
            <Clock className="w-5 h-5 text-ink-muted/40" strokeWidth={1} />
          </div>
          <p className="text-sm text-ink-muted font-sans">No activity recorded</p>
          <p className="text-[11px] text-ink-muted/60 font-sans mt-1">
            Actions on this filing will appear here.
          </p>
        </div>
      )}

      {sorted.map((event, idx) => {
        const config = ACTIVITY_CONFIG[event.type] ?? {
          icon: Clock,
          bg: 'bg-ink/5',
          ring: 'ring-ink/15',
          iconColor: 'text-ink-muted',
        };
        const Icon = config.icon;
        const isLast = idx === sorted.length - 1;

        return (
          <div key={event.id} className="flex min-h-[48px]">
            {/* ── Left column: actor + datetime ────────────────── */}
            <div className="w-[100px] shrink-0 text-right pr-4 pt-[3px]">
              <div className="text-[11px] font-sans font-medium text-ink truncate">
                {event.actor.name}
              </div>
              <div className="text-[10px] font-mono tabular-nums text-ink-muted whitespace-nowrap">
                {formatShortDate(event.timestamp)}
              </div>
            </div>

            {/* ── Center column: circle node + vertical line ──── */}
            <div className="w-5 shrink-0 flex flex-col items-center">
              <span
                className={`w-5 h-5 shrink-0 flex items-center justify-center ring-1 z-10 ${config.bg} ${config.ring}`}
              >
                <Icon className={`w-2.5 h-2.5 ${config.iconColor}`} strokeWidth={2} />
              </span>
              {!isLast && <div className="w-[2px] flex-1 bg-rule/50" />}
            </div>

            {/* ── Right column: activity detail ─────────────────── */}
            <div className="flex-1 min-w-0 pl-3 pb-5 pt-[2px]">
              <p className="text-sm text-ink font-sans leading-relaxed">
                {event.detail}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
