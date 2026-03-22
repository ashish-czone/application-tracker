import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form, FormInput, FormSelect, FormCheckbox, Button,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@packages/ui';
import { PicklistOptionsEditor } from './PicklistOptionsEditor';
import { FIELD_TYPE_CONFIG, CREATABLE_FIELD_TYPES } from '../types';
import type { FieldType, CreateFieldInput, PicklistOptionInput } from '../types';

const schema = z.object({
  fieldKey: z.string().min(1, 'Required').max(100).regex(/^[a-z][a-z0-9_]*$/, 'Must be lowercase with underscores (e.g., shoe_size)'),
  label: z.string().min(1, 'Required').max(200),
  fieldType: z.string().min(1, 'Required'),
  isRequired: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  isQuickCreate: z.boolean().optional(),
  isReadonly: z.boolean().optional(),
  maxLength: z.string().optional().or(z.literal('')),
  defaultValue: z.string().optional().or(z.literal('')),
  lookupEntity: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

interface CreateFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateFieldInput) => void;
  isPending?: boolean;
  preselectedType?: FieldType;
  lookupEntities?: string[];
}

export function CreateFieldDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  preselectedType,
  lookupEntities = [],
}: CreateFieldDialogProps) {
  const [picklistOptions, setPicklistOptions] = useState<PicklistOptionInput[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fieldKey: '',
      label: '',
      fieldType: preselectedType ?? '',
      isRequired: false,
      isUnique: false,
      isQuickCreate: false,
      isReadonly: false,
      maxLength: '',
      defaultValue: '',
      lookupEntity: '',
    },
  });

  // Reset form when dialog opens (ensures preselectedType and clean state)
  useEffect(() => {
    if (open) {
      form.reset({
        fieldKey: '',
        label: '',
        fieldType: preselectedType ?? '',
        isRequired: false,
        isUnique: false,
        isQuickCreate: false,
        isReadonly: false,
        maxLength: '',
        defaultValue: '',
        lookupEntity: '',
      });
      setPicklistOptions([]);
    }
  }, [open, preselectedType, form]);

  const selectedType = form.watch('fieldType') as FieldType;
  const isPicklistType = selectedType === 'picklist' || selectedType === 'multi_select';
  const isLookupType = selectedType === 'lookup';

  function handleSubmit(data: FormValues) {
    onSubmit({
      fieldKey: data.fieldKey,
      label: data.label,
      fieldType: data.fieldType as FieldType,
      isRequired: data.isRequired,
      isUnique: data.isUnique,
      isQuickCreate: data.isQuickCreate,
      isReadonly: data.isReadonly,
      maxLength: data.maxLength ? parseInt(data.maxLength, 10) : undefined,
      defaultValue: data.defaultValue || undefined,
      lookupEntity: data.lookupEntity || undefined,
      picklistOptions: isPicklistType ? picklistOptions : undefined,
    });
  }

  // Auto-generate fieldKey from label
  const watchedLabel = form.watch('label');
  useEffect(() => {
    if (!watchedLabel) return;
    const key = watchedLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const currentKey = form.getValues('fieldKey');
    // Only auto-set if key is empty or was auto-generated (matches previous label)
    if (!currentKey || currentKey === key) {
      form.setValue('fieldKey', key);
    }
  }, [watchedLabel, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Custom Field</DialogTitle>
          <DialogDescription>Add a new field to this entity</DialogDescription>
        </DialogHeader>

        <Form form={form} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormInput
            name="label"
            label="Label"
            placeholder="Shoe Size"
          />

          <FormInput
            name="fieldKey"
            label="Field Key"
            placeholder="shoe_size"
          />

          <FormSelect
            name="fieldType"
            label="Field Type"
            placeholder="Select type"
            options={CREATABLE_FIELD_TYPES.map((t) => ({
              label: FIELD_TYPE_CONFIG[t].label,
              value: t,
            }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormCheckbox name="isRequired" label="Required" />
            <FormCheckbox name="isUnique" label="Unique" />
            <FormCheckbox name="isQuickCreate" label="Quick Create" />
            <FormCheckbox name="isReadonly" label="Read-only" />
          </div>

          {(selectedType === 'text' || selectedType === 'email' || selectedType === 'url' || selectedType === 'textarea') && (
            <FormInput name="maxLength" label="Max Length" type="number" placeholder="255" />
          )}

          <FormInput name="defaultValue" label="Default Value (optional)" placeholder="" />

          {isPicklistType && (
            <PicklistOptionsEditor options={picklistOptions} onChange={setPicklistOptions} />
          )}

          {isLookupType && (
            <FormSelect
              name="lookupEntity"
              label="Target Entity"
              placeholder="Select entity"
              options={lookupEntities.map((e) => ({ label: e, value: e }))}
            />
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create Field'}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
