import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { DrawerHeader, Eyebrow } from '@packages/ui';
import { POSITION_LABEL, type OrgUnit, type OrgMember } from './orgHierarchyMock';

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

interface MemberFormValues {
  name: string;
  email: string;
  position: OrgMember['position'];
}

const EMPTY_FORM: MemberFormValues = {
  name: '',
  email: '',
  position: 'executive',
};

const POSITIONS: OrgMember['position'][] = ['head', 'manager', 'senior', 'executive'];

// ─── Props ───────────────────────────────────────────────────────────

export interface AddMemberDrawerProps {
  unit: OrgUnit;
  onClose?: () => void;
  onCreate?: (values: MemberFormValues) => void;
}

// ─── Component ───────────────────────────────────────────────────────

export function AddMemberDrawer({ unit, onClose, onCreate }: AddMemberDrawerProps) {
  const [form, setForm] = useState<MemberFormValues>(EMPTY_FORM);

  function updateField<K extends keyof MemberFormValues>(key: K, value: MemberFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

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
        className="relative w-full max-w-md h-full bg-paper-raised border-l border-rule flex flex-col"
      >
        <DrawerHeader
          eyebrow={<Eyebrow tone="muted" mark="§">New Member</Eyebrow>}
          title="Add member"
          subtitle={
            <>
              Assign a team member to{' '}
              <span className="font-mono not-italic text-ink text-[13px]">{unit.name}</span>
              {' '}and define their position within the unit.
            </>
          }
          onClose={() => onClose?.()}
        />

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            {/* Unit context */}
            <div className="flex items-center gap-2 px-3 py-2 border border-rule bg-paper-sunken/40">
              <Users className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
              <span className="text-[11px] font-sans text-ink-muted">
                Adding to{' '}
                <span className="font-mono font-medium text-ink">{unit.code}</span>
                {' · '}
                {unit.name}
              </span>
            </div>

            {/* Full name */}
            <FieldRow label="Full name" required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g. Ravi Kumar"
                className="w-full bg-transparent outline-none text-sm text-ink font-sans placeholder:text-ink-muted"
              />
            </FieldRow>

            {/* Email */}
            <FieldRow label="Email" required>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="e.g. ravi@goelassociates.com"
                className="w-full bg-transparent outline-none text-sm text-ink font-sans placeholder:text-ink-muted"
              />
            </FieldRow>

            {/* Position */}
            <FieldRow label="Position" required>
              <div className="flex gap-2 pt-1">
                {POSITIONS.map((pos) => {
                  const active = form.position === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => updateField('position', pos)}
                      className={`px-3 py-1.5 text-[10px] uppercase tracking-eyebrow font-sans font-semibold border transition-colors ${
                        active
                          ? 'bg-ink text-paper border-ink'
                          : 'border-rule text-ink-muted hover:border-ink-muted hover:text-ink'
                      }`}
                    >
                      {POSITION_LABEL[pos]}
                    </button>
                  );
                })}
              </div>
            </FieldRow>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer className="px-6 pt-4 pb-6 border-t border-rule bg-paper-sunken/50 flex-none">
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
              onClick={() => onCreate?.(form)}
              className="ml-auto px-5 py-2.5 bg-ink text-paper text-[11px] uppercase tracking-eyebrow font-sans font-semibold hover:brightness-110 transition-[filter]"
            >
              Add member
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
