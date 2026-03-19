import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormInput,
  Button,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@packages/ui';
import { useCreateWorkflow } from '../hooks';

const createWorkflowSchema = z.object({
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be kebab-case (e.g., order-status)'),
  name: z.string().min(1, 'Name is required').max(200),
  entityType: z.string().min(1, 'Entity type is required').max(100),
  fieldName: z.string().min(1, 'Field name is required').max(100),
  initialState: z.string().min(1, 'Initial state is required').max(100),
});

type CreateWorkflowFormValues = z.infer<typeof createWorkflowSchema>;

interface AddWorkflowFormProps {
  onClose: () => void;
}

export function AddWorkflowForm({ onClose }: AddWorkflowFormProps) {
  const { control, handleSubmit } = useForm<CreateWorkflowFormValues>({
    resolver: zodResolver(createWorkflowSchema),
    defaultValues: {
      slug: '',
      name: '',
      entityType: '',
      fieldName: 'status',
      initialState: '',
    },
  });

  const createMutation = useCreateWorkflow({ onSuccess: onClose });

  function onSubmit(data: CreateWorkflowFormValues) {
    createMutation.mutate(data);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Workflow</DialogTitle>
        <DialogDescription>Create a new workflow definition</DialogDescription>
      </DialogHeader>

      <Form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            control={control}
            name="slug"
            label="Slug"
            placeholder="order-status"
            description="Unique identifier (kebab-case)"
          />
          <FormInput
            control={control}
            name="name"
            label="Name"
            placeholder="Order Status"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormInput
            control={control}
            name="entityType"
            label="Entity type"
            placeholder="order"
          />
          <FormInput
            control={control}
            name="fieldName"
            label="Field name"
            placeholder="status"
          />
        </div>

        <FormInput
          control={control}
          name="initialState"
          label="Initial state"
          placeholder="open"
          description="Starting state for new entities"
        />

        {createMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(createMutation.error as any)?.body?.message || 'Failed to create workflow.'}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create workflow'}
          </Button>
        </DialogFooter>
      </Form>
    </>
  );
}
