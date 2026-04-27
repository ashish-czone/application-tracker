import { useMemo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  DrawerShell,
  DrawerHeader,
  Eyebrow,
  Button,
  FormInput,
  FormSelect,
  FormTextarea,
  FormDatePicker,
} from '@packages/ui';
import type { LawApiRecord } from '../../../../../hooks/useLawsApi';

const JURISDICTION_OPTIONS = [
  { value: 'central', label: 'Central' },
  { value: 'state', label: 'State' },
  { value: 'municipal', label: 'Municipal' },
  { value: 'international', label: 'International' },
];

const lawSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  jurisdiction: z.string(),
  effectiveFrom: z.string(),
  parentId: z.string(),
  issuingAuthority: z.string(),
  description: z.string(),
});

type NewLawFormValues = z.infer<typeof lawSchema>;

export interface NewLawValues {
  code: string;
  name: string;
  jurisdiction: string;
  effectiveFrom: string;
  parentId: string;
  issuingAuthority: string;
  description: string;
}

const EMPTY_FORM: NewLawFormValues = {
  code: '',
  name: '',
  jurisdiction: '',
  effectiveFrom: '',
  parentId: '',
  issuingAuthority: '',
  description: '',
};

export interface NewLawDrawerProps {
  onClose?: () => void;
  onCreate?: (values: NewLawValues) => void;
  laws: LawApiRecord[];
  isSubmitting?: boolean;
}

export function NewLawDrawer({ onClose, onCreate, laws, isSubmitting }: NewLawDrawerProps) {
  const form = useForm<NewLawFormValues>({
    resolver: zodResolver(lawSchema),
    defaultValues: EMPTY_FORM,
  });

  const parentOptions = useMemo(
    () => [
      { value: '', label: '— None (top-level Act) —' },
      ...laws
        .filter((l) => l.id && l.name)
        .map((l) => ({
          value: l.id,
          label: l.code ? `${l.code} — ${l.name}` : l.name,
        })),
    ],
    [laws],
  );

  const onSubmit = (values: NewLawFormValues) => {
    onCreate?.(values as NewLawValues);
  };

  return (
    <DrawerShell onClose={() => onClose?.()} width="lg">
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col h-full">
          <DrawerHeader
            eyebrow={<Eyebrow tone="muted" mark="§">New Law</Eyebrow>}
            title="Add law"
            subtitle="Register a new Act, chapter or section under your compliance library."
            onClose={() => onClose?.()}
          />

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <LawField label="Code" required>
              <FormInput
                name="code"
                placeholder="e.g. CO-2013"
                ariaLabel="Code"
                inputClassName="uppercase tracking-tabular font-mono"
              />
            </LawField>

            <LawField label="Name" required>
              <FormInput
                name="name"
                placeholder="Companies Act 2013"
                ariaLabel="Name"
              />
            </LawField>

            <div className="grid grid-cols-2 gap-4">
              <LawField label="Jurisdiction">
                <FormSelect
                  name="jurisdiction"
                  options={JURISDICTION_OPTIONS}
                  placeholder="Select jurisdiction"
                />
              </LawField>
              <LawField label="Effective from">
                <FormDatePicker name="effectiveFrom" placeholder="Pick a date" />
              </LawField>
            </div>

            <LawField label="Parent">
              <FormSelect name="parentId" options={parentOptions} placeholder="Top-level Act" />
            </LawField>

            <LawField label="Issuing authority">
              <FormInput
                name="issuingAuthority"
                placeholder="e.g. Ministry of Corporate Affairs"
                ariaLabel="Issuing authority"
              />
            </LawField>

            <LawField label="Description">
              <FormTextarea
                name="description"
                rows={3}
                placeholder="Short description of the law."
                ariaLabel="Description"
              />
            </LawField>
          </div>

          <footer className="px-6 pt-4 pb-6 border-t border-rule bg-paper-sunken/50 flex-none">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onClose?.()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="ml-auto" disabled={isSubmitting}>
                {isSubmitting ? 'Creating…' : 'Create law'}
              </Button>
            </div>
          </footer>
        </form>
      </FormProvider>
    </DrawerShell>
  );
}

function LawField({
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
      <label className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1">
        {label}
        {required && <span className="text-signal ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
