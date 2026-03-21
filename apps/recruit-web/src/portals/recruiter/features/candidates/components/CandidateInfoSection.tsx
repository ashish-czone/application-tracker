import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, ChevronDown, ChevronRight } from 'lucide-react';
import { z } from 'zod';
import { Form, FormInput, FormSelect, Button } from '@packages/ui';
import { useUpdateCandidate } from '../hooks';
import type { Candidate, UpdateCandidateRequest } from '../types';

interface FieldConfig {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'date' | 'number' | 'select' | 'checkbox';
  options?: { label: string; value: string }[];
  format?: (value: unknown) => string;
  colSpan?: number;
}

interface CandidateInfoSectionProps {
  title: string;
  candidate: Candidate;
  fields: FieldConfig[];
  schema: z.ZodObject<any>;
}

export function CandidateInfoSection({ title, candidate, fields, schema }: CandidateInfoSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);

  const updateMutation = useUpdateCandidate({ onSuccess: () => setEditing(false) });

  const defaults: Record<string, unknown> = {};
  for (const f of fields) {
    const val = (candidate as unknown as Record<string, unknown>)[f.key];
    if (f.type === 'number' && typeof val === 'number') {
      defaults[f.key] = f.key === 'expectedSalary' ? String(val / 100) : String(val);
    } else if (f.type === 'checkbox') {
      defaults[f.key] = val ?? false;
    } else {
      defaults[f.key] = val ?? '';
    }
  }

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  function onSubmit(data: Record<string, unknown>) {
    const payload: UpdateCandidateRequest = {};
    for (const f of fields) {
      const val = data[f.key];
      if (f.type === 'number' && val) {
        (payload as any)[f.key] = f.key === 'expectedSalary' ? Math.round(parseFloat(val as string) * 100) : Number(val);
      } else if (f.type === 'checkbox') {
        (payload as any)[f.key] = val;
      } else {
        (payload as any)[f.key] = (val as string) || undefined;
      }
    }
    updateMutation.mutate({ id: candidate.id, data: payload });
  }

  function handleCancel() {
    form.reset(defaults);
    setEditing(false);
  }

  function formatValue(field: FieldConfig): string {
    const val = (candidate as unknown as Record<string, unknown>)[field.key];
    if (val == null || val === '') return '-';
    if (field.format) return field.format(val);
    if (field.type === 'checkbox') return val ? 'Yes' : 'No';
    if (field.type === 'number' && field.key === 'expectedSalary') {
      return `$${((val as number) / 100).toLocaleString()}`;
    }
    if (field.options) {
      const opt = field.options.find((o) => o.value === val);
      return opt?.label ?? String(val);
    }
    return String(val);
  }

  return (
    <div className="border rounded-lg">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {title}
        </button>
        {!collapsed && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label={`Edit ${title}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="px-4 py-3">
          {editing ? (
            <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {fields.map((f) => (
                  <div key={f.key} className={f.colSpan === 2 ? 'col-span-2' : ''}>
                    {f.type === 'select' && f.options ? (
                      <FormSelect name={f.key} label={f.label} options={f.options} placeholder="Select" />
                    ) : f.type === 'checkbox' ? (
                      <label className="flex items-center gap-2 text-sm cursor-pointer pt-6">
                        <input type="checkbox" {...form.register(f.key)} className="rounded border-input" />
                        {f.label}
                      </label>
                    ) : (
                      <FormInput name={f.key} label={f.label} type={f.type || 'text'} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleCancel} disabled={updateMutation.isPending}>
                  Cancel
                </Button>
              </div>
            </Form>
          ) : (
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {fields.map((f) => (
                <div key={f.key} className={`flex flex-col ${f.colSpan === 2 ? 'col-span-2' : ''}`}>
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  <span className="text-sm text-foreground">{formatValue(f)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
