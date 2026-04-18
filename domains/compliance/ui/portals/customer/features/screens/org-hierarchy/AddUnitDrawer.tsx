import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Building2, ChevronDown } from 'lucide-react';
import { DrawerHeader, Eyebrow } from '@packages/ui';
import {
  LEVEL_META,
  type OrgUnit,
  type OrgLevel,
  type OrgMember,
} from './orgHierarchyMock';

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

interface UnitFormValues {
  name: string;
  code: string;
  level: OrgLevel;
  parentId: string;
  description: string;
  headId: string;
}

// ─── Props ───────────────────────────────────────────────────────────

export interface AddUnitDrawerProps {
  allUnits: OrgUnit[];
  allMembers: OrgMember[];
  /** Pre-set parent when opened from "Add child" in the tree. */
  presetParentId?: string | null;
  onClose?: () => void;
  onCreate?: (values: UnitFormValues) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const CHILD_LEVEL: Record<OrgLevel, OrgLevel | null> = {
  company: 'entity',
  entity: 'division',
  division: null,
};

function inferLevel(parentId: string, units: OrgUnit[]): OrgLevel {
  const parent = units.find((u) => u.id === parentId);
  if (!parent) return 'entity';
  return CHILD_LEVEL[parent.level] ?? 'division';
}

// ─── Component ───────────────────────────────────────────────────────

export function AddUnitDrawer({
  allUnits,
  allMembers,
  presetParentId,
  onClose,
  onCreate,
}: AddUnitDrawerProps) {
  const defaultParentId = presetParentId ?? allUnits[0]?.id ?? '';
  const defaultLevel = defaultParentId ? inferLevel(defaultParentId, allUnits) : 'entity';

  const [form, setForm] = useState<UnitFormValues>({
    name: '',
    code: '',
    level: defaultLevel,
    parentId: defaultParentId,
    description: '',
    headId: '',
  });

  function updateField<K extends keyof UnitFormValues>(key: K, value: UnitFormValues[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-update level when parent changes
      if (key === 'parentId') {
        next.level = inferLevel(value as string, allUnits);
      }
      return next;
    });
  }

  // Valid parents: units whose child level matches the current form level
  const validParents = useMemo(() => {
    return allUnits.filter((u) => CHILD_LEVEL[u.level] !== null);
  }, [allUnits]);

  const levelMeta = LEVEL_META[form.level];
  const parentUnit = allUnits.find((u) => u.id === form.parentId);

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
        <DrawerHeader
          eyebrow={<Eyebrow tone="muted" mark="§">New Unit</Eyebrow>}
          title="Add unit"
          subtitle="Create a new organisational unit and position it within the hierarchy."
          onClose={() => onClose?.()}
        />

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            {/* Level indicator */}
            <div className="flex items-center gap-2 px-3 py-2 border border-rule bg-paper-sunken/40">
              <Building2 className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
              <span className="text-[11px] font-sans text-ink-muted">
                This unit will be created as{' '}
                <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] uppercase tracking-eyebrow font-semibold ${levelMeta.color} mx-0.5`}>
                  {levelMeta.label}
                </span>
                {parentUnit && (
                  <>
                    {' '}under <span className="font-mono font-medium text-ink">{parentUnit.name}</span>
                  </>
                )}
              </span>
            </div>

            {/* Parent unit */}
            <FieldRow label="Parent unit" required>
              <div className="relative">
                <select
                  value={form.parentId}
                  onChange={(e) => updateField('parentId', e.target.value)}
                  className="w-full bg-transparent outline-none text-sm text-ink font-sans appearance-none cursor-pointer pr-6"
                >
                  {validParents.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code} — {u.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted pointer-events-none" strokeWidth={1.5} />
              </div>
            </FieldRow>

            {/* Unit name */}
            <FieldRow label="Unit name" required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder={form.level === 'entity' ? 'e.g. Tax & Regulatory' : 'e.g. GST Division'}
                className="w-full bg-transparent outline-none text-sm text-ink font-sans placeholder:text-ink-muted"
              />
            </FieldRow>

            {/* Code */}
            <FieldRow label="Code" required>
              <input
                type="text"
                value={form.code}
                onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                placeholder="e.g. GST"
                maxLength={5}
                className="w-full bg-transparent outline-none text-sm text-ink font-mono uppercase tracking-wider placeholder:text-ink-muted placeholder:normal-case"
              />
            </FieldRow>

            {/* Head assignment */}
            <FieldRow label="Assign head">
              <div className="relative">
                <select
                  value={form.headId}
                  onChange={(e) => updateField('headId', e.target.value)}
                  className="w-full bg-transparent outline-none text-sm text-ink font-sans appearance-none cursor-pointer pr-6"
                >
                  <option value="">No head assigned</option>
                  {allMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted pointer-events-none" strokeWidth={1.5} />
              </div>
            </FieldRow>

            {/* Description */}
            <FieldRow label="Description">
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Describe this unit's responsibilities and scope"
                rows={3}
                className="w-full bg-transparent outline-none text-sm text-ink font-serif italic placeholder:text-ink-muted resize-none leading-relaxed"
              />
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
              Create unit
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
