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
} from 'lucide-react';
import {
  Eyebrow,
  JurisdictionTag,
  UrgencyBadge,
  OrdinalDate,
} from '@packages/ui';
import type { FilingRow } from './filingsMock';
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

type DetailTab = 'details' | 'notes' | 'attachments' | 'activity';

// ─── Props ───────────────────────────────────────────────────────────

export interface FilingDetailDrawerProps {
  filing: FilingRow;
  onClose?: () => void;
  onStatusChange?: (filingId: string, newStatus: Filing['status']) => void;
}

// ─── Component ───────────────────────────────────────────────────────

export function FilingDetailDrawer({ filing, onClose, onStatusChange }: FilingDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('details');
  const [noteText, setNoteText] = useState('');

  const isFiled = filing.status === 'filed';

  // Determine available workflow transitions based on current status
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

        {/* ── Tab bar ─────────────────────────────────────────────── */}
        <div className="flex border-b border-rule flex-none">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = tab.key === 'notes' ? filing.notes.length
              : tab.key === 'attachments' ? filing.attachments.length
              : tab.key === 'activity' ? filing.activity.length
              : undefined;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] uppercase tracking-eyebrow font-sans font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? 'text-ink border-ink'
                    : 'text-ink-muted border-transparent hover:text-ink'
                }`}
              >
                <tab.icon className="w-3 h-3" strokeWidth={1.5} />
                {tab.label}
                {count != null && count > 0 && (
                  <span className="font-mono text-[10px] tabular-nums text-ink-muted">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'details' && <DetailsPanel filing={filing} />}
          {activeTab === 'notes' && (
            <NotesPanel
              filing={filing}
              noteText={noteText}
              setNoteText={setNoteText}
            />
          )}
          {activeTab === 'attachments' && <AttachmentsPanel filing={filing} />}
          {activeTab === 'activity' && <ActivityPanel filing={filing} />}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Tab definitions ─────────────────────────────────────────────────

const TABS: { key: DetailTab; label: string; icon: typeof FileText }[] = [
  { key: 'details', label: 'Details', icon: FileText },
  { key: 'notes', label: 'Notes', icon: MessageSquare },
  { key: 'attachments', label: 'Files', icon: Paperclip },
  { key: 'activity', label: 'Activity', icon: Clock },
];

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

// ─── Details panel ───────────────────────────────────────────────────

function DetailsPanel({ filing }: { filing: FilingRow }) {
  return (
    <div className="px-6 py-5 space-y-5">
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
          <div className="border-t border-rule" />
          <div className="grid grid-cols-2 gap-4">
            <DetailField label="Filed on">
              <OrdinalDate date={filing.filedDate} variant="short" className="text-sm" />
            </DetailField>
          </div>
        </>
      )}
    </div>
  );
}

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

// ─── Notes panel ─────────────────────────────────────────────────────

function NotesPanel({
  filing,
  noteText,
  setNoteText,
}: {
  filing: FilingRow;
  noteText: string;
  setNoteText: (v: string) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {filing.notes.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 text-ink-muted/40 mx-auto mb-2" strokeWidth={1} />
            <p className="text-sm text-ink-muted font-sans">No notes yet</p>
            <p className="text-[11px] text-ink-muted/60 font-sans mt-1">
              Add a note to keep the team informed.
            </p>
          </div>
        )}
        {filing.notes.map((note) => (
          <div key={note.id} className="border border-rule bg-paper-sunken/30 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
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

      {/* Compose bar */}
      <div className="px-6 py-4 border-t border-rule bg-paper-sunken/50 flex-none">
        <div className="flex items-end gap-2">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note…"
            rows={2}
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

// ─── Attachments panel ───────────────────────────────────────────────

function AttachmentsPanel({ filing }: { filing: FilingRow }) {
  return (
    <div className="px-6 py-5 space-y-4">
      {/* Upload zone */}
      <button
        type="button"
        className="w-full border-2 border-dashed border-rule hover:border-ink py-6 flex flex-col items-center gap-2 transition-colors group"
      >
        <Upload className="w-5 h-5 text-ink-muted group-hover:text-ink" strokeWidth={1.5} />
        <span className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted group-hover:text-ink">
          Drop files or click to upload
        </span>
      </button>

      {filing.attachments.length === 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-ink-muted font-sans">No attachments</p>
        </div>
      )}

      {filing.attachments.map((att) => (
        <div
          key={att.id}
          className="flex items-center gap-3 border border-rule bg-paper-sunken/30 px-4 py-3 group hover:bg-paper-sunken/60 transition-colors"
        >
          <Paperclip className="w-4 h-4 text-ink-muted flex-none" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-ink font-sans truncate">{att.name}</div>
            <div className="text-[10px] text-ink-muted font-sans">
              {att.size} · uploaded by {att.uploadedBy.name}
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity flex-none" strokeWidth={1.5} />
        </div>
      ))}
    </div>
  );
}

// ─── Activity panel ──────────────────────────────────────────────────

const ACTIVITY_ICON: Record<string, typeof Clock> = {
  'status-change': ArrowRightCircle,
  'note-added': MessageSquare,
  'attachment-added': Paperclip,
  assigned: ChevronRight,
  created: FileText,
};

function ActivityPanel({ filing }: { filing: FilingRow }) {
  const sorted = [...filing.activity].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <div className="px-6 py-5">
      {sorted.length === 0 && (
        <div className="text-center py-8">
          <Clock className="w-8 h-8 text-ink-muted/40 mx-auto mb-2" strokeWidth={1} />
          <p className="text-sm text-ink-muted font-sans">No activity recorded</p>
        </div>
      )}

      <div className="relative">
        {/* Timeline line */}
        {sorted.length > 1 && (
          <div className="absolute left-[9px] top-5 bottom-5 w-px bg-rule" />
        )}

        <div className="space-y-4">
          {sorted.map((event) => {
            const Icon = ACTIVITY_ICON[event.type] ?? Clock;
            return (
              <div key={event.id} className="flex items-start gap-3 relative">
                <span className="w-[18px] h-[18px] flex-none bg-paper-raised border border-rule flex items-center justify-center z-10">
                  <Icon className="w-2.5 h-2.5 text-ink-muted" strokeWidth={2} />
                </span>
                <div className="flex-1 min-w-0 pt-px">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-sans font-medium text-ink">
                      {event.actor.name}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-ink-muted">
                      <OrdinalDate date={event.timestamp} variant="short" className="inline text-[10px]" />
                    </span>
                  </div>
                  <p className="text-sm text-ink-soft font-sans mt-0.5">{event.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
