import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form, FormInput, FormSelect, Button,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@packages/ui';
import type { LayoutSection, CreateSectionInput } from '../types';

const schema = z.object({
  name: z.string().min(1, 'Required').max(200),
  columns: z.string().optional(),
  isCollapsible: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

interface EditSectionDialogProps {
  section: LayoutSection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (sectionId: string, data: Partial<CreateSectionInput>) => void;
  isPending?: boolean;
}

export function EditSectionDialog({ section, open, onOpenChange, onSubmit, isPending }: EditSectionDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', columns: '2', isCollapsible: true },
  });

  useEffect(() => {
    if (section && open) {
      form.reset({
        name: section.name,
        columns: String(section.columns),
        isCollapsible: section.isCollapsible,
      });
    }
  }, [section, open]);

  function handleSubmit(data: FormValues) {
    if (!section) return;
    onSubmit(section.id, {
      name: data.name,
      columns: data.columns ? parseInt(data.columns, 10) : 2,
      isCollapsible: data.isCollapsible,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Section</DialogTitle>
          <DialogDescription>Update section properties</DialogDescription>
        </DialogHeader>

        <Form form={form} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormInput name="name" label="Section Name" placeholder="Custom Info" />

          <FormSelect
            name="columns"
            label="Columns"
            options={[
              { label: '1 Column', value: '1' },
              { label: '2 Columns', value: '2' },
            ]}
          />

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" {...form.register('isCollapsible')} className="rounded border-input" />
            Collapsible
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
