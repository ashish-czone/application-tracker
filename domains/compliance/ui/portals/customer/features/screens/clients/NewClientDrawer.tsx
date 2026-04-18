import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronRight, Building2 } from 'lucide-react';
import {
  DrawerHeader,
  Eyebrow,
  SectionRule,
  Button,
  Form,
  FormInput,
  FormEmailInput,
  FormPhoneInput,
  FormTextarea,
} from '@packages/ui';

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

// ─── Schema ──────────────────────────────────────────────────────────

const clientSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  legalName: z.string().min(1, 'Legal name is required'),
  taxIdentifier: z.string().min(1, 'Tax identifier is required'),
  primaryContactName: z.string().min(1, 'Contact name is required'),
  primaryContactEmail: z.string().min(1, 'Contact email is required').email('Enter a valid email'),
  primaryContactPhone: z.string().min(1, 'Contact phone is required'),
  notes: z.string(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

const EMPTY_FORM: ClientFormValues = {
  name: '',
  legalName: '',
  taxIdentifier: '',
  primaryContactName: '',
  primaryContactEmail: '',
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
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: EMPTY_FORM,
  });

  const [selectedLaws, setSelectedLaws] = useState<string[]>([]);
  const [lawsOpen, setLawsOpen] = useState(true);

  function toggleLaw(key: string) {
    setSelectedLaws((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  const onSubmit = (values: ClientFormValues) => {
    onCreate?.(values, selectedLaws);
  };

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
        <Form
          form={form}
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col h-full space-y-0"
        >
          <DrawerHeader
            eyebrow={<Eyebrow tone="muted" mark="§">New Client</Eyebrow>}
            title="Add client"
            subtitle="Register a new entity under your firm's management and select applicable law registrations."
            onClose={() => onClose?.()}
          />

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

              <FormInput
                name="name"
                label="Company name"
                placeholder="e.g. Aarav Industries"
              />

              <FormInput
                name="legalName"
                label="Legal name"
                placeholder="e.g. Aarav Industries Pvt. Ltd."
              />

              <FormInput
                name="taxIdentifier"
                label="Tax identifier"
                placeholder="e.g. 27AABCA1234H1Z5"
                inputClassName="uppercase tracking-tabular font-mono"
              />

              <SectionRule label="Primary contact" align="left" />

              <FormInput
                name="primaryContactName"
                label="Contact name"
                placeholder="Name of primary point of contact"
              />

              <FormEmailInput
                name="primaryContactEmail"
                label="Contact email"
                placeholder="e.g. finance@company.in"
              />

              <FormPhoneInput
                name="primaryContactPhone"
                label="Contact phone"
                defaultCountry="IN"
              />

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
                                checked ? 'bg-ink border-ink' : 'border-rule'
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

              <FormTextarea
                name="notes"
                label="Notes"
                rows={3}
                placeholder="Any onboarding notes or special instructions"
              />
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onClose?.()}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="ml-auto">
                Add client
              </Button>
            </div>
          </footer>
        </Form>
      </motion.div>
    </div>
  );
}
