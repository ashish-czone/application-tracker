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
} from '@packages/ui';
import { useUpdateRole, type Role } from '@packages/rbac-ui';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
});

type FormValues = z.infer<typeof schema>;

export interface EditRoleDrawerProps {
  role: Role;
  onClose: () => void;
}

export function EditRoleDrawer({ role, onClose }: EditRoleDrawerProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: role.name },
  });

  const mutation = useUpdateRole({ onSuccess: onClose });

  const onSubmit = (values: FormValues) => {
    mutation.mutate({ id: role.id, data: { name: values.name.trim() } });
  };

  return (
    <DrawerShell onClose={onClose} width="lg">
      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full space-y-0">
        <DrawerHeader
          eyebrow={<Eyebrow tone="muted" mark="§">Edit role</Eyebrow>}
          title={role.name}
          subtitle="Rename this role. Permissions and members are managed in the detail panel."
          onClose={onClose}
          titleSize="sm"
        />

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            <FormInput
              name="name"
              label="Role name"
              placeholder="e.g. Compliance Manager"
            />
          </div>
        </div>

        <footer className="px-6 pt-4 pb-6 border-t border-rule bg-paper-sunken/50 flex-none">
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="ml-auto" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </footer>
      </Form>
    </DrawerShell>
  );
}
