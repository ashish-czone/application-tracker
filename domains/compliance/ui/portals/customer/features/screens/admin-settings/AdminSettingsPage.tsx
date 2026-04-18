import { useMemo, useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2,
  Globe,
  SlidersHorizontal,
  ChevronRight,
  Upload,
  ImageIcon,
} from 'lucide-react';
import {
  Button,
  Form,
  FormInput,
  FormSelect,
} from '@packages/ui';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import {
  ADMIN_SETTINGS_SECTIONS,
  ADMIN_SETTINGS_GROUPS,
  type AdminSettingsSection,
  type AdminSettingField,
  type AdminSettingsGroup,
} from './adminSettingsMock';

// ─── Constants ──────────────────────────────────────────────────────

const SECTION_ICONS: Record<AdminSettingsSection, typeof Building2> = {
  organization: Building2,
  localization: Globe,
  preferences: SlidersHorizontal,
};

// ─── Form helpers ───────────────────────────────────────────────────

type FormValues = Record<string, string>;

/** Build a zod schema with `z.string()` for every non-logo field in a group. */
function buildGroupSchema(group: AdminSettingsGroup) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of group.fields) {
    if (field.type === 'logo') continue;
    shape[field.key] = z.string();
  }
  return z.object(shape);
}

function buildGroupDefaults(group: AdminSettingsGroup): FormValues {
  const defaults: FormValues = {};
  for (const field of group.fields) {
    if (field.type === 'logo') continue;
    defaults[field.key] = field.value;
  }
  return defaults;
}

// ─── Sub-components ─────────────────────────────────────────────────

function SectionDivider() {
  return <div className="border-t border-rule" />;
}

function SettingRow({ field }: { field: AdminSettingField }) {
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
          <FormInput name={field.key} ariaLabel={field.label} />
        )}
        {field.type === 'select' && (
          <FormSelect
            name={field.key}
            options={field.options}
            placeholder="Select..."
          />
        )}
        {field.type === 'logo' && <LogoUploadField />}
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
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Upload className="w-3 h-3" strokeWidth={1.5} />
          Upload logo
        </Button>
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

  const defaultValues = useMemo(() => buildGroupDefaults(group), [group]);
  const schema = useMemo(() => buildGroupSchema(group), [group]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const onSubmit = (values: FormValues) => {
    // Consumer will wire this to the settings API; currently UI-only.
    void values;
  };

  return (
    <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
      <div>
        <h2 className="font-serif text-2xl text-ink leading-tight">{group.label}</h2>
        <p className="mt-1 font-serif italic text-sm text-ink-soft">
          {group.description}
        </p>
      </div>

      <div className="divide-y divide-rule">
        {group.fields.map((field) => (
          <SettingRow key={field.key} field={field} />
        ))}
      </div>

      <SectionDivider />

      <div className="flex items-center gap-3 pt-4">
        <Button type="submit" size="sm">
          Save changes
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => form.reset(defaultValues)}
        >
          Reset to defaults
        </Button>
      </div>
    </Form>
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
