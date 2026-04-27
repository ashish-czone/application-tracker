import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Button, Form, toast } from '@packages/ui';
import {
  useSettings,
  useUpdateSetting,
  useResetSetting,
  type SettingsGroup,
} from '@packages/settings-ui';
import { SettingRow } from './SettingRow';

type FormValues = Record<string, string>;

function defaultsFromGroup(group: SettingsGroup): FormValues {
  const out: FormValues = {};
  for (const f of group.fields) {
    out[f.key] = f.value == null ? '' : String(f.value);
  }
  return out;
}

export interface SettingsGroupSectionProps {
  moduleSlug: string;
  description: string;
}

export function SettingsGroupSection({ moduleSlug, description }: SettingsGroupSectionProps) {
  const { data: groups, isLoading, isError } = useSettings();
  const updateMutation = useUpdateSetting();
  const resetMutation = useResetSetting();

  const group = groups?.find((g) => g.module === moduleSlug);

  const defaultValues = useMemo(() => (group ? defaultsFromGroup(group) : {}), [group]);

  const form = useForm<FormValues>({
    defaultValues,
    values: defaultValues,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-paper-sunken" />
        <div className="h-4 w-80 animate-pulse rounded bg-paper-sunken" />
        <div className="space-y-2 pt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-paper-sunken" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded border border-rule bg-paper-sunken p-4">
        <p className="text-sm text-destructive">
          Failed to load settings. Please refresh the page.
        </p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="rounded border border-rule bg-paper-sunken p-4">
        <p className="text-sm text-ink-soft">
          Settings module <code>{moduleSlug}</code> is not registered.
        </p>
      </div>
    );
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const dirty = form.formState.dirtyFields;
    const changedKeys = Object.keys(dirty).filter((k) => dirty[k]);
    if (changedKeys.length === 0) return;

    const results = await Promise.allSettled(
      changedKeys.map((key) =>
        updateMutation.mutateAsync({ module: moduleSlug, key, value: values[key] }),
      ),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed === 0) {
      toast.success(
        `Saved ${changedKeys.length} setting${changedKeys.length === 1 ? '' : 's'}`,
      );
    }
  });

  const onResetAll = async () => {
    const overridden = group.fields.filter((f) => f.isOverridden);
    if (overridden.length === 0) {
      form.reset(defaultValues);
      return;
    }
    await Promise.allSettled(
      overridden.map((f) => resetMutation.mutateAsync({ module: moduleSlug, key: f.key })),
    );
  };

  const hasOverrides = group.fields.some((f) => f.isOverridden);
  const isSaving = updateMutation.isPending;
  const isResetting = resetMutation.isPending;

  return (
    <Form form={form} onSubmit={onSubmit} className="space-y-2">
      <div>
        <h2 className="font-serif text-2xl text-ink leading-tight">{group.label}</h2>
        <p className="mt-1 font-serif italic text-sm text-ink-soft">{description}</p>
      </div>

      <div className="divide-y divide-rule">
        {group.fields.map((field) => (
          <SettingRow key={field.key} field={field} />
        ))}
      </div>

      <div className="border-t border-rule" />

      <div className="flex items-center gap-3 pt-4">
        <Button type="submit" size="sm" disabled={isSaving || !form.formState.isDirty}>
          {isSaving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onResetAll}
          disabled={isResetting || (!hasOverrides && !form.formState.isDirty)}
        >
          {isResetting
            ? 'Resetting…'
            : hasOverrides
              ? 'Reset to defaults'
              : 'Cancel changes'}
        </Button>
      </div>
    </Form>
  );
}
