import { useState, type ReactElement } from 'react';
import {
  Building2,
  Globe,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  Upload,
  ImageIcon,
} from 'lucide-react';
import { Button, Eyebrow } from '@packages/ui';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import {
  ADMIN_SETTINGS_SECTIONS,
  ADMIN_SETTINGS_GROUPS,
  type AdminSettingsSection,
  type AdminSettingField,
} from './adminSettingsMock';

// ─── Constants ──────────────────────────────────────────────────────

const SECTION_ICONS: Record<AdminSettingsSection, typeof Building2> = {
  organization: Building2,
  localization: Globe,
  preferences: SlidersHorizontal,
};

// ─── Sub-components ─────────────────────────────────────────────────

function SectionDivider() {
  return <div className="border-t border-rule" />;
}

function SelectField({
  field,
  value,
  onChange,
}: {
  field: AdminSettingField;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = field.options?.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 border border-rule bg-paper text-sm font-sans text-ink hover:border-ink transition-colors text-left"
      >
        <span className={selected ? 'text-ink' : 'text-ink-muted'}>
          {selected?.label ?? 'Select...'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.5}
        />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-20 top-full left-0 right-0 mt-1 border border-rule bg-paper-raised shadow-sm max-h-[240px] overflow-y-auto">
            {field.options?.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 text-sm font-sans text-left transition-colors ${
                  opt.value === value
                    ? 'bg-authority/5 text-authority'
                    : 'text-ink hover:bg-paper-sunken'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SettingRow({
  field,
  value,
  onChange,
}: {
  field: AdminSettingField;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_320px] gap-8 items-start py-5">
      {/* Label side */}
      <div>
        <span className="text-sm font-sans font-medium text-ink">{field.label}</span>
        <span className="block text-[11px] font-serif italic text-ink-muted mt-0.5">
          {field.description}
        </span>
      </div>

      {/* Input side */}
      <div>
        {field.type === 'text' && (
          <input
            type="text"
            defaultValue={value}
            className="w-full px-3 py-2 border border-rule bg-paper text-sm font-sans text-ink placeholder:text-ink-muted outline-none focus:border-ink transition-colors"
          />
        )}
        {field.type === 'select' && (
          <SelectField field={field} value={value} onChange={onChange} />
        )}
        {field.type === 'logo' && (
          <LogoUploadField />
        )}
      </div>
    </div>
  );
}

function LogoUploadField() {
  return (
    <div className="flex items-center gap-4">
      <div className="w-[120px] h-[48px] border border-dashed border-rule bg-paper-sunken flex items-center justify-center">
        <ImageIcon className="w-5 h-5 text-ink-muted/50" strokeWidth={1.5} />
      </div>
      <div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rule text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink hover:border-ink transition-colors"
        >
          <Upload className="w-3 h-3" strokeWidth={1.5} />
          Upload logo
        </button>
        <span className="block text-[10px] font-serif italic text-ink-muted mt-1.5">
          PNG, SVG, or JPG. Max 2 MB.
        </span>
      </div>
    </div>
  );
}

// ─── Section components ─────────────────────────────────────────────

function SettingsGroupSection({ sectionKey }: { sectionKey: AdminSettingsSection }) {
  const group = ADMIN_SETTINGS_GROUPS.find((g) => g.key === sectionKey);
  if (!group) return null;

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(group.fields.map((f) => [f.key, f.value])),
  );

  const updateValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-2">
      <div>
        <h2 className="font-serif text-2xl text-ink leading-tight">{group.label}</h2>
        <p className="mt-1 font-serif italic text-sm text-ink-soft">
          {group.description}
        </p>
      </div>

      <div className="divide-y divide-rule">
        {group.fields.map((field) => (
          <SettingRow
            key={field.key}
            field={field}
            value={values[field.key]!}
            onChange={(v) => updateValue(field.key, v)}
          />
        ))}
      </div>

      <SectionDivider />

      <div className="flex items-center gap-3 pt-4">
        <Button size="sm">Save changes</Button>
        <Button size="sm" variant="ghost">Reset to defaults</Button>
      </div>
    </div>
  );
}

// ─── Section content map ────────────────────────────────────────────

const SECTION_CONTENT: Record<AdminSettingsSection, () => ReactElement> = {
  organization: () => <SettingsGroupSection sectionKey="organization" />,
  localization: () => <SettingsGroupSection sectionKey="localization" />,
  preferences: () => <SettingsGroupSection sectionKey="preferences" />,
};

// ─── Page ───────────────────────────────────────────────────────────

export function AdminSettingsPage() {
  const [activeSection, setActiveSection] =
    useState<AdminSettingsSection>('organization');

  const Content = SECTION_CONTENT[activeSection];

  return (
    <div className="min-h-screen bg-paper paper-grain">
      <ScreenPreviewTopBar active="dashboard" />

      <main className="max-w-[1480px] mx-auto px-10 py-8">
        {/* ─── Page header ──────────────────────────────────────── */}
        <header className="mb-8">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
            <span>Workspace</span>
            <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
            <span className="text-ink">Admin Settings</span>
          </div>
          <h1 className="font-serif text-4xl text-ink leading-none mt-1">Admin Settings</h1>
          <p className="mt-2 font-serif italic text-ink-soft max-w-2xl">
            Platform-wide configuration for your organization. Changes here affect all users.
          </p>
        </header>

        {/* ─── Split layout: sidebar + content ──────────────────── */}
        <div className="flex gap-0 border border-rule bg-paper-raised">
          {/* Left nav */}
          <nav className="w-[220px] flex-none border-r border-rule bg-paper">
            <div className="py-2">
              {ADMIN_SETTINGS_SECTIONS.map((s) => {
                const Icon = SECTION_ICONS[s.key];
                const isActive = activeSection === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setActiveSection(s.key)}
                    className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'bg-paper-raised text-ink border-r-2 border-authority'
                        : 'text-ink-soft hover:text-ink hover:bg-paper-raised/50'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 flex-none ${isActive ? 'text-authority' : 'text-ink-muted'}`}
                      strokeWidth={1.5}
                    />
                    <span className="text-sm font-sans">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Right content */}
          <div className="flex-1 min-w-0 px-10 py-8">
            <Content />
          </div>
        </div>
      </main>
    </div>
  );
}
