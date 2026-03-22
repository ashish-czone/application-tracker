import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form, FormInput, FormSelect, FormTextarea, Button,
  DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@packages/ui';
import { useCreateTemplate, useUpdateTemplate } from '../hooks';
import type { NotificationTemplate } from '../types';

const templateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  channel: z.enum(['email', 'in_app', 'whatsapp'], { message: 'Channel is required' }),
  subject: z.string().max(500).optional().or(z.literal('')),
  body: z.string().min(1, 'Body is required').max(10000),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

interface TemplateFormModalProps {
  template?: NotificationTemplate | null;
  onClose: () => void;
}

export function TemplateFormModal({ template, onClose }: TemplateFormModalProps) {
  const isEdit = !!template;

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: template?.name ?? '',
      channel: (template?.channel ?? '') as any,
      subject: template?.subject ?? '',
      body: template?.body ?? '',
    },
  });

  const createMutation = useCreateTemplate({ onSuccess: onClose });
  const updateMutation = useUpdateTemplate({ onSuccess: onClose });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = form.handleSubmit((values) => {
    if (isEdit) {
      updateMutation.mutate({ id: template.id, data: { name: values.name, subject: values.subject || undefined, body: values.body } });
    } else {
      createMutation.mutate({ name: values.name, channel: values.channel, subject: values.subject || undefined, body: values.body });
    }
  });

  return (
    <Form form={form} onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Template' : 'Create Template'}</DialogTitle>
        <DialogDescription>
          {isEdit ? `Edit "${template.name}"` : 'Create a notification template with Mustache syntax'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <FormInput name="name" label="Template Name" placeholder="e.g. Welcome Email" />

        {!isEdit && (
          <FormSelect
            name="channel"
            label="Channel"
            placeholder="Select channel"
            options={[
              { label: 'Email', value: 'email' },
              { label: 'In-App', value: 'in_app' },
              { label: 'WhatsApp', value: 'whatsapp' },
            ]}
          />
        )}

        <FormInput name="subject" label="Subject" placeholder="e.g. {{entityType}} notification" />

        <FormTextarea
          name="body"
          label="Body"
          placeholder="Use Mustache syntax: {{payload.fieldName}}"
          rows={6}
        />

        <p className="text-xs text-muted-foreground">
          Available variables: {'{{eventName}}'}, {'{{entityType}}'}, {'{{entityId}}'}, {'{{payload.fieldName}}'}
        </p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Template'}
        </Button>
      </DialogFooter>
    </Form>
  );
}
