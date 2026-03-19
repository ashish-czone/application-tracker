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
import { useUpdateTask } from '../hooks';
import type { Task } from '../types';

const editTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assigneeId: z.string().optional().or(z.literal('')),
  dueDate: z.string().optional().or(z.literal('')),
});

type EditTaskFormValues = z.infer<typeof editTaskSchema>;

interface EditTaskFormProps {
  task: Task;
  onClose: () => void;
}

export function EditTaskForm({ task, onClose }: EditTaskFormProps) {
  const { control, handleSubmit } = useForm<EditTaskFormValues>({
    resolver: zodResolver(editTaskSchema),
    defaultValues: {
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      assigneeId: task.assigneeId ?? '',
      dueDate: task.dueDate ?? '',
    },
  });

  const updateMutation = useUpdateTask({ onSuccess: onClose });

  function onSubmit(data: EditTaskFormValues) {
    updateMutation.mutate({
      id: task.id,
      data: {
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        assigneeId: data.assigneeId || null,
        dueDate: data.dueDate || null,
      },
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit Task</DialogTitle>
        <DialogDescription>Update task details</DialogDescription>
      </DialogHeader>

      <Form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormInput
          control={control}
          name="title"
          label="Title"
          placeholder="Task title"
          autoComplete="off"
        />

        <FormTextarea
          control={control}
          name="description"
          label="Description (optional)"
          placeholder="Describe the task..."
          rows={3}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormSelect
            control={control}
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
            control={control}
            name="dueDate"
            label="Due date (optional)"
            type="date"
          />
        </div>

        {updateMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(updateMutation.error as any)?.body?.message || 'Failed to update task. Please try again.'}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={updateMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </Form>
    </>
  );
}
