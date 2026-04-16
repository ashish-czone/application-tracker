import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronRight, Building2 } from 'lucide-react';
import { Eyebrow, SectionRule } from '@packages/ui';

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

// ─── Types ───────────────────────────────────────────────────────────

interface ClientFormValues {
  name: string;
  legalName: string;
  taxIdentifier: string;
  primaryContactEmail: string;
  primaryContactName: string;
  primaryContactPhone: string;
  notes: string;
}

const EMPTY_FORM: ClientFormValues = {
  name: '',
  legalName: '',
  taxIdentifier: '',
  primaryContactEmail: '',
  primaryContactName: '',
  primaryContactPhone: '',
  notes: '',
};

const LAW_REGISTRATIONS = [
  { key: 'gst', label: 'Goods & Services Tax', code: 'GST' },
  { key: 'itr', label: 'Income Tax', code: 'ITR' },
  { key: 'tds', label: 'TDS / TCS', code: 'TDS' },
  { key: 'roc', label: 'Registrar of Companies', code: 'ROC' },
  { key: 'pt', label: 'Professional Tax', code: 'PT' },
];

// ─── Props ───────────────────────────────────────────────────────────

export interface NewClientDrawerProps {
  onClose?: () => void;
  onCreate?: (values: ClientFormValues, laws: string[]) => void;
}

// ─── Component ───────────────────────────────────────────────────────

export function NewClientDrawer({ onClose, onCreate }: NewClientDrawerProps) {
  const [form, setForm] = useState<ClientFormValues>(EMPTY_FORM);
  const [selectedLaws, setSelectedLaws] = useState<string[]>([]);
  const [lawsOpen, setLawsOpen] = useState(true);

  function updateField<K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleLaw(key: string) {
    setSelectedLaws((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
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
            <Eyebrow tone="muted" mark="§">
              New Client
            </Eyebrow>
            <button
              type="button"
              onClick={() => onClose?.()}
              className="text-ink-muted hover:text-ink transition-colors -mt-1 -mr-1"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
          <h2 className="font-serif text-3xl text-ink leading-tight">Add client</h2>
          <p className="font-serif italic text-ink-soft text-sm mt-2">
            Register a new entity under your firm's management and select applicable law
            registrations.
          </p>
        </header>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            {/* Entity details badge */}
            <div className="flex items-center gap-2 px-3 py-2 border border-rule bg-paper-sunken/40">
              <Building2 className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
              <span className="text-[11px] font-sans text-ink-muted">
                Status will be set to{' '}
                <span className="font-mono font-medium text-ink">Onboarding</span>
              </span>
            </div>

            {/* Company name */}
            <FieldRow label="Company name" required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g. Aarav Industries"
                className="w-full bg-transparent outline-none text-sm text-ink font-sans placeholder:text-ink-muted"
              />
            </FieldRow>

            {/* Legal name */}
            <FieldRow label="Legal name" required>
              <input
                type="text"
                value={form.legalName}
                onChange={(e) => updateField('legalName', e.target.value)}
                placeholder="e.g. Aarav Industries Pvt. Ltd."
                className="w-full bg-transparent outline-none text-sm text-ink font-sans placeholder:text-ink-muted"
              />
            </FieldRow>

            {/* Tax identifier */}
            <FieldRow label="Tax identifier" required>
              <input
                type="text"
                value={form.taxIdentifier}
                onChange={(e) => updateField('taxIdentifier', e.target.value.toUpperCase())}
                placeholder="e.g. 27AABCA1234H1Z5"
                className="w-full bg-transparent outline-none text-sm text-ink font-mono uppercase tracking-tabular placeholder:text-ink-muted placeholder:normal-case"
              />
            </FieldRow>

            <SectionRule label="Primary contact" align="left" />

            {/* Contact name */}
            <FieldRow label="Contact name" required>
              <input
                type="text"
                value={form.primaryContactName}
                onChange={(e) => updateField('primaryContactName', e.target.value)}
                placeholder="Name of primary point of contact"
                className="w-full bg-transparent outline-none text-sm text-ink font-sans placeholder:text-ink-muted"
              />
            </FieldRow>

            {/* Contact email */}
            <FieldRow label="Contact email" required>
              <input
                type="email"
                value={form.primaryContactEmail}
                onChange={(e) => updateField('primaryContactEmail', e.target.value)}
                placeholder="e.g. finance@company.in"
                className="w-full bg-transparent outline-none text-sm text-ink font-sans placeholder:text-ink-muted"
              />
            </FieldRow>

            {/* Contact phone */}
            <FieldRow label="Contact phone" required>
              <input
                type="tel"
                value={form.primaryContactPhone}
                onChange={(e) => updateField('primaryContactPhone', e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full bg-transparent outline-none text-sm text-ink font-sans placeholder:text-ink-muted"
              />
            </FieldRow>

            {/* Law registrations — collapsible */}
            <div>
              <button
                type="button"
                onClick={() => setLawsOpen(!lawsOpen)}
                className="flex items-center gap-2 w-full group"
              >
                <ChevronRight
                  className={`w-3.5 h-3.5 text-ink-muted transition-transform duration-200 ${lawsOpen ? 'rotate-90' : ''}`}
                  strokeWidth={1.5}
                />
                <SectionRule label="Law registrations" align="left" className="flex-1" />
              </button>

              <div
                className="grid transition-[grid-template-rows] duration-250 ease-out"
                style={{ gridTemplateRows: lawsOpen ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <div className="mt-3 space-y-0 border border-rule divide-y divide-rule pb-1">
                    {LAW_REGISTRATIONS.map((law) => {
                      const checked = selectedLaws.includes(law.key);
                      return (
                        <button
                          key={law.key}
                          type="button"
                          onClick={() => toggleLaw(law.key)}
                          className="flex items-center gap-3 px-4 py-2.5 w-full text-left hover:bg-paper-sunken/60 transition-colors cursor-pointer"
                        >
                          <span
                            className={`w-4 h-4 flex-none border flex items-center justify-center transition-colors ${
                              checked
                                ? 'bg-ink border-ink'
                                : 'border-rule'
                            }`}
                          >
                            {checked && (
                              <svg
                                className="w-2.5 h-2.5 text-paper"
                                viewBox="0 0 12 12"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M2.5 6l2.5 2.5 4.5-5" />
                              </svg>
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] tracking-tabular uppercase text-ink font-medium">
                                {law.code}
                              </span>
                              <span className="text-sm text-ink-soft font-sans">
                                {law.label}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {selectedLaws.length > 0 && (
                    <p className="mt-2 font-mono text-[11px] tabular-nums text-ink-soft">
                      {selectedLaws.length} law{selectedLaws.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <FieldRow label="Notes">
              <textarea
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Any onboarding notes or special instructions"
                rows={3}
                className="w-full bg-transparent outline-none text-sm text-ink font-serif italic placeholder:text-ink-muted resize-none leading-relaxed"
              />
            </FieldRow>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer className="px-6 pt-4 pb-6 border-t border-rule bg-paper-sunken/50 flex-none">
          {selectedLaws.length > 0 && (
            <p className="text-[10px] uppercase tracking-eyebrow text-authority font-sans font-medium mb-3">
              {selectedLaws.length} law registration{selectedLaws.length !== 1 ? 's' : ''} will be
              created
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
              onClick={() => onCreate?.(form, selectedLaws)}
              className="ml-auto px-5 py-2.5 bg-ink text-paper text-[11px] uppercase tracking-eyebrow font-sans font-semibold hover:brightness-110 transition-[filter]"
            >
              Add client
            </button>
          </div>
        </footer>
      </motion.div>
    </div>
  );
}

// ─── Field row ───────────────────────────────────────────────────────

function FieldRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <label className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
          {label}
          {required && <span className="text-signal ml-0.5">*</span>}
        </label>
      </div>
      <div className="border-b border-rule focus-within:border-ink transition-colors pb-1.5">
        {children}
      </div>
    </div>
  );
}
