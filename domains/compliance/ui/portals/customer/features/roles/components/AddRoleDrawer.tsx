import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  DrawerShell,
  DrawerHeader,
  Eyebrow,
  Button,
  Form,
  FormInput,
  FormSelect,
  FormCheckbox,
} from '@packages/ui';
import { useCreateRole } from '@packages/rbac-ui';

const USER_TYPE_OPTIONS = [
  { label: 'Any user type', value: '' },
  { label: 'Admin', value: 'admin' },
  { label: 'Client', value: 'client' },
];

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  userType: z.string(),
  isDefault: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { name: '', userType: '', isDefault: false };

export interface AddRoleDrawerProps {
  onClose: () => void;
}

export function AddRoleDrawer({ onClose }: AddRoleDrawerProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  const mutation = useCreateRole({ onSuccess: onClose });

  const onSubmit = (values: FormValues) => {
    mutation.mutate({
      name: values.name.trim(),
      userType: values.userType ? values.userType : null,
      isDefault: values.isDefault,
    });
  };

  return (
    <DrawerShell onClose={onClose} width="lg">
      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full space-y-0">
        <DrawerHeader
          eyebrow={<Eyebrow tone="muted" mark="§">New role</Eyebrow>}
          title="Add role"
          subtitle="Roles group permissions and can be assigned to users."
          onClose={onClose}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            <FormInput
              name="name"
              label="Role name"
              placeholder="e.g. Compliance Manager"
            />

            <FormSelect
              name="userType"
              label="User type"
              options={USER_TYPE_OPTIONS}
              description="Limit which users can be assigned this role. Leave unset to allow any user type."
            />

            <FormCheckbox
              name="isDefault"
              label="Set as default role"
              description="New users of the matching user type will be assigned this role automatically."
            />
          </div>
        </div>

        <footer className="px-6 pt-4 pb-6 border-t border-rule bg-paper-sunken/50 flex-none">
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="ml-auto" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create role'}
            </Button>
          </div>
        </footer>
      </Form>
    </DrawerShell>
  );
}
