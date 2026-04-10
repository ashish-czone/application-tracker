import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form, FormInput, FormSelect, Button,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@packages/ui';
import type { CreateSectionInput } from '../types';

const schema = z.object({
  name: z.string().min(1, 'Required').max(200),
  columns: z.string().optional(),
  isCollapsible: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

interface CreateSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateSectionInput) => void;
  isPending?: boolean;
}

export function CreateSectionDialog({ open, onOpenChange, onSubmit, isPending }: CreateSectionDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', columns: '2', isCollapsible: true },
  });

  function handleSubmit(data: FormValues) {
    onSubmit({
      name: data.name,
      columns: data.columns ? parseInt(data.columns, 10) : 2,
      isCollapsible: data.isCollapsible,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Section</DialogTitle>
          <DialogDescription>Create a new section to group fields</DialogDescription>
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
              {isPending ? 'Creating...' : 'Add Section'}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
