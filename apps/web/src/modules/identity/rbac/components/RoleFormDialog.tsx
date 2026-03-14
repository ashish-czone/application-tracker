import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Form,
  FormInput,
} from '@packages/ui';
import type { Role } from '../types';

const roleSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be at most 50 characters'),
  description: z.string().max(200, 'Description must be at most 200 characters').optional().or(z.literal('')),
});

type RoleFormValues = z.infer<typeof roleSchema>;

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: Role | null;
  onSubmit: (values: RoleFormValues) => void;
  isPending: boolean;
}

export function RoleFormDialog({ open, onOpenChange, role, onSubmit, isPending }: RoleFormDialogProps) {
  const isEdit = !!role;

  const { control, handleSubmit, reset } = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: role?.name ?? '',
        description: role?.description ?? '',
      });
    }
  }, [open, role, reset]);

  const handleFormSubmit = (values: RoleFormValues) => {
    onSubmit({
      name: values.name,
      description: values.description || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Role' : 'Create Role'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the role name and description.' : 'Create a new role to assign permissions to users.'}
          </DialogDescription>
        </DialogHeader>
        <Form onSubmit={handleSubmit(handleFormSubmit)}>
          <FormInput control={control} name="name" label="Name" placeholder="e.g. Editor" />
          <FormInput control={control} name="description" label="Description" placeholder="Optional description" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (isEdit ? 'Saving...' : 'Creating...') : isEdit ? 'Save Changes' : 'Create Role'}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
