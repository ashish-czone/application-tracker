import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Form } from '@packages/ui';
import {
  ADMIN_SETTINGS_GROUPS,
  type AdminSettingsSection,
  type AdminSettingsGroup,
} from '../data/adminSettingsMock';
import { SettingRow } from './SettingRow';

type FormValues = Record<string, string>;

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

export interface SettingsGroupSectionProps {
  sectionKey: AdminSettingsSection;
}

export function SettingsGroupSection({ sectionKey }: SettingsGroupSectionProps) {
  const group = ADMIN_SETTINGS_GROUPS.find((g) => g.key === sectionKey);

  const defaultValues = useMemo(() => (group ? buildGroupDefaults(group) : {}), [group]);
  const schema = useMemo(() => (group ? buildGroupSchema(group) : z.object({})), [group]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  if (!group) return null;

  const onSubmit = (values: FormValues) => {
    void values;
  };

  return (
    <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
      <div>
        <h2 className="font-serif text-2xl text-ink leading-tight">{group.label}</h2>
        <p className="mt-1 font-serif italic text-sm text-ink-soft">{group.description}</p>
      </div>

      <div className="divide-y divide-rule">
        {group.fields.map((field) => (
          <SettingRow key={field.key} field={field} />
        ))}
      </div>

      <div className="border-t border-rule" />

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
