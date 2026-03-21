import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form, FormInput, Button,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@packages/ui';
import { FIELD_TYPE_CONFIG } from '../types';
import type { FieldDefinition, UpdateFieldInput } from '../types';

const schema = z.object({
  label: z.string().min(1, 'Required').max(200),
  isRequired: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  isQuickCreate: z.boolean().optional(),
  isReadonly: z.boolean().optional(),
  maxLength: z.string().optional().or(z.literal('')),
  defaultValue: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

interface EditFieldDialogProps {
  field: FieldDefinition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (fieldId: string, data: UpdateFieldInput) => void;
  onDelete?: (fieldId: string) => void;
  isPending?: boolean;
}

export function EditFieldDialog({
  field,
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  isPending,
}: EditFieldDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: field ? {
      label: field.label,
      isRequired: field.isRequired,
      isUnique: field.isUnique,
      isQuickCreate: field.isQuickCreate,
      isReadonly: field.isReadonly,
      maxLength: field.maxLength ? String(field.maxLength) : '',
      defaultValue: field.defaultValue ?? '',
    } : undefined,
  });

  if (!field) return null;

  const typeConfig = FIELD_TYPE_CONFIG[field.fieldType] ?? { label: field.fieldType, color: 'bg-gray-100 text-gray-800' };

  function handleSubmit(data: FormValues) {
    onSubmit(field!.id, {
      label: data.label,
      isRequired: data.isRequired,
      isUnique: data.isUnique,
      isQuickCreate: data.isQuickCreate,
      isReadonly: data.isReadonly,
      maxLength: data.maxLength ? parseInt(data.maxLength, 10) : undefined,
      defaultValue: data.defaultValue || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Field</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{field.fieldKey}</span>
            {' '}&middot;{' '}
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${typeConfig.color}`}>
              {typeConfig.label}
            </span>
            {field.isSystem && <span className="text-xs text-muted-foreground ml-1">(System field)</span>}
          </DialogDescription>
        </DialogHeader>

        <Form form={form} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormInput name="label" label="Label" />

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...form.register('isRequired')} className="rounded border-input" />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...form.register('isUnique')} className="rounded border-input" />
              Unique
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...form.register('isQuickCreate')} className="rounded border-input" />
              Quick Create
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...form.register('isReadonly')} className="rounded border-input" />
              Read-only
            </label>
          </div>

          <FormInput name="maxLength" label="Max Length" type="number" />
          <FormInput name="defaultValue" label="Default Value" />

          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              {field.isCustom && onDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(field.id)}
                  disabled={isPending}
                >
                  Delete Field
                </Button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
