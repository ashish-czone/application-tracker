import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  Form,
  FormInput,
  FormSelect,
  Button,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  toast,
} from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui';
import { createRbacApi } from '../services';
import { PermissionsPicker } from './PermissionsPicker';
import type { BooleanPermissions } from '../types';

const createRoleSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  userType: z.enum(['admin', 'client'], { message: 'User type is required' }),
  isDefault: z.enum(['true', 'false']),
});

type CreateRoleFormValues = z.infer<typeof createRoleSchema>;

interface AddRoleFormProps {
  onClose: () => void;
}

export function AddRoleForm({ onClose }: AddRoleFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [roleDetails, setRoleDetails] = useState<CreateRoleFormValues | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<BooleanPermissions>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const apiFn = usePlatformAPI();
  const rbacApi = createRbacApi(apiFn);

  const form = useForm<CreateRoleFormValues>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: '',
      userType: '' as 'admin' | 'client',
      isDefault: 'false',
    },
  });

  function handleStep1(data: CreateRoleFormValues) {
    setRoleDetails(data);
    setStep(2);
  }

  async function handleCreate() {
    if (!roleDetails) return;
    if (Object.keys(selectedPermissions).length === 0) {
      setError('Select at least one permission');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const role = await rbacApi.createRole({
        name: roleDetails.name,
        userType: roleDetails.userType,
        isDefault: roleDetails.isDefault === 'true',
      });

      const permissions = Object.keys(selectedPermissions).map((name) => ({ name }));
      await rbacApi.setRolePermissions(role.id, permissions);

      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Role created');
      onClose();
    } catch (err: any) {
      setError(err?.body?.message || 'Failed to create role');
    } finally {
      setIsSubmitting(false);
    }
  }

  const permissionCount = Object.keys(selectedPermissions).length;

  if (step === 2) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Add Role — Permissions</DialogTitle>
          <DialogDescription>
            Select permissions for "{roleDetails?.name}". At least one is required.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto max-h-[50vh] py-2">
          <PermissionsPicker selected={selectedPermissions} onChange={setSelectedPermissions} />
        </div>

        {error && (
          <p className="text-sm text-destructive" aria-live="polite">{error}</p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={isSubmitting}>
            Back
          </Button>
          <Button onClick={handleCreate} disabled={isSubmitting}>
            {isSubmitting
              ? 'Creating...'
              : `Create role (${permissionCount} permission${permissionCount !== 1 ? 's' : ''})`}
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Role</DialogTitle>
        <DialogDescription>Create a new role for user access control</DialogDescription>
      </DialogHeader>

      <Form form={form} onSubmit={form.handleSubmit(handleStep1)} className="space-y-4">
        <FormInput
          name="name"
          label="Role name"
          placeholder="e.g. Manager"
          autoComplete="off"
        />

        <FormSelect
          name="userType"
          label="User type"
          placeholder="Select type"
          options={[
            { label: 'Admin', value: 'admin' },
            { label: 'Client', value: 'client' },
          ]}
        />

        <FormSelect
          name="isDefault"
          label="Default role"
          description="New users of this type will be assigned this role automatically"
          options={[
            { label: 'No', value: 'false' },
            { label: 'Yes', value: 'true' },
          ]}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            Next — Permissions
          </Button>
        </DialogFooter>
      </Form>
    </>
  );
}
