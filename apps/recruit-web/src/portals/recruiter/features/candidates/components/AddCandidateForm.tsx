import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormInput,
  FormSelect,
  Button,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@packages/ui';
import { useCreateCandidate } from '../hooks';
import { SOURCE_OPTIONS } from '../types';

const quickCreateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  phone: z.string().max(20).optional().or(z.literal('')),
  source: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof quickCreateSchema>;

interface AddCandidateFormProps {
  onSuccess?: (id: string) => void;
  onClose: () => void;
}

export function AddCandidateForm({ onSuccess, onClose }: AddCandidateFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(quickCreateSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      source: '',
    },
  });

  const createMutation = useCreateCandidate({
    onSuccess: (candidate) => {
      onClose();
      onSuccess?.(candidate.id);
    },
  });

  function onSubmit(data: FormValues) {
    createMutation.mutate({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone || undefined,
      source: data.source || undefined,
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Candidate</DialogTitle>
        <DialogDescription>Quick create — you can add more details on the profile page</DialogDescription>
      </DialogHeader>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormInput name="firstName" label="First name" placeholder="John" />
          <FormInput name="lastName" label="Last name" placeholder="Doe" />
        </div>

        <FormInput name="email" label="Email" placeholder="john@example.com" type="email" />

        <div className="grid grid-cols-2 gap-3">
          <FormInput name="phone" label="Phone (optional)" placeholder="+1 555 123 4567" />
          <FormSelect
            name="source"
            label="Source (optional)"
            placeholder="Select"
            options={[...SOURCE_OPTIONS]}
          />
        </div>

        {createMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(createMutation.error as any)?.body?.message || 'Failed to create candidate.'}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create candidate'}
          </Button>
        </DialogFooter>
      </Form>
    </>
  );
}
