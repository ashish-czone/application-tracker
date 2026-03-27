import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormInput,
  FormTextarea,
  FormSelect,
  Button,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@packages/ui';
import { useCreateTask } from '../hooks';

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeId: z.string().optional().or(z.literal('')),
  dueDate: z.string().optional().or(z.literal('')),
});

type CreateTaskFormValues = z.infer<typeof createTaskSchema>;

interface AddTaskFormProps {
  onClose: () => void;
}

export function AddTaskForm({ onClose }: AddTaskFormProps) {
  const form = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
      assigneeId: '',
      dueDate: '',
    },
  });

  const createMutation = useCreateTask({ onSuccess: onClose });

  function onSubmit(data: CreateTaskFormValues) {
    createMutation.mutate({
      title: data.title,
      description: data.description || undefined,
      priority: data.priority,
      assigneeId: data.assigneeId || undefined,
      dueDate: data.dueDate || undefined,
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Task</DialogTitle>
        <DialogDescription>Create a new task</DialogDescription>
      </DialogHeader>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormInput
          name="title"
          label="Title"
          placeholder="Task title"
          autoComplete="off"
        />

        <FormTextarea
          name="description"
          label="Description (optional)"
          placeholder="Describe the task..."
          rows={3}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormSelect
            name="priority"
            label="Priority"
            options={[
              { label: 'Low', value: 'low' },
              { label: 'Medium', value: 'medium' },
              { label: 'High', value: 'high' },
              { label: 'Urgent', value: 'urgent' },
            ]}
          />

          <FormInput
            name="dueDate"
            label="Due date (optional)"
            type="date"
          />
        </div>

        {createMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(createMutation.error as any)?.body?.message || 'Failed to create task. Please try again.'}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create task'}
          </Button>
        </DialogFooter>
      </Form>
    </>
  );
}
