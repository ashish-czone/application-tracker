import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield } from 'lucide-react';
import {
  DrawerShell,
  DrawerHeader,
  Eyebrow,
  SectionRule,
  Button,
  Form,
  FormInput,
  FormEmailInput,
  FormPhoneInput,
} from '@packages/ui';
import { useInviteUser } from '../../../../../../hooks/useUsersApi';
import { useRoles } from '@packages/users-ui';

const inviteSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  phone: z.string().optional(),
});

export type InviteUserFormValues = z.infer<typeof inviteSchema>;

const EMPTY_FORM: InviteUserFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
};

export interface InviteUserDrawerProps {
  onClose?: () => void;
  onInvited?: () => void;
}

export function InviteUserDrawer({ onClose, onInvited }: InviteUserDrawerProps) {
  const form = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: EMPTY_FORM,
  });

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const { data: rolesData, isLoading: rolesLoading } = useRoles('client');
  const roles = rolesData?.data ?? [];

  const invite = useInviteUser({
    onSuccess: () => {
      onInvited?.();
      onClose?.();
    },
  });

  function toggleRole(id: string) {
    setSelectedRoles((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  }

  const onSubmit = (values: InviteUserFormValues) => {
    invite.mutate({
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone || undefined,
      userType: 'client',
      roleIds: selectedRoles.length > 0 ? selectedRoles : undefined,
    });
  };

  return (
    <DrawerShell onClose={() => onClose?.()} width="lg">
      <Form
        form={form}
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col h-full space-y-0"
      >
        <DrawerHeader
          eyebrow={<Eyebrow tone="muted" mark="§">Invite user</Eyebrow>}
          title="Invite a team member"
          subtitle="They'll receive an email with a secure link to set their password and join the workspace."
          onClose={() => onClose?.()}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                name="firstName"
                label="First name"
                placeholder="e.g. Priya"
              />
              <FormInput
                name="lastName"
                label="Last name"
                placeholder="e.g. Sharma"
              />
            </div>

            <FormEmailInput
              name="email"
              label="Work email"
              placeholder="e.g. priya@firm.in"
            />

            <FormPhoneInput
              name="phone"
              label="Phone (optional)"
              defaultCountry="IN"
            />

            <SectionRule label="Roles" align="left" />

            {rolesLoading ? (
              <p className="text-sm font-serif italic text-ink-muted">Loading roles…</p>
            ) : roles.length === 0 ? (
              <p className="text-sm font-serif italic text-ink-muted">
                No roles defined yet — the invited user will have no permissions until a role is assigned.
              </p>
            ) : (
              <div className="border border-rule divide-y divide-rule">
                {roles.map((role) => {
                  const checked = selectedRoles.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggleRole(role.id)}
                      className="flex items-center gap-3 px-4 py-2.5 w-full text-left hover:bg-paper-sunken/60 transition-colors cursor-pointer"
                    >
                      <span
                        className={`w-4 h-4 flex-none border flex items-center justify-center transition-colors ${
                          checked ? 'bg-ink border-ink' : 'border-rule'
                        }`}
                      >
                        {checked && (
                          <svg
                            className="w-2.5 h-2.5 text-paper"
                            viewBox="0 0 12 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M2.5 6l2.5 2.5 4.5-5" />
                          </svg>
                        )}
                      </span>
                      <Shield className="w-3.5 h-3.5 text-authority flex-none" strokeWidth={1.5} />
                      <span className="text-sm font-sans text-ink">{role.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <footer className="px-6 pt-4 pb-6 border-t border-rule bg-paper-sunken/50 flex-none">
          {selectedRoles.length > 0 && (
            <p className="text-[10px] uppercase tracking-eyebrow text-authority font-sans font-medium mb-3">
              {selectedRoles.length} role{selectedRoles.length !== 1 ? 's' : ''} will be assigned
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onClose?.()}
              disabled={invite.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="ml-auto"
              disabled={invite.isPending}
            >
              {invite.isPending ? 'Sending…' : 'Send invitation'}
            </Button>
          </div>
        </footer>
      </Form>
    </DrawerShell>
  );
}
