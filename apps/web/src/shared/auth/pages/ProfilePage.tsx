import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form, FormInput, FormEmailInput, FormPhoneInput, FormPasswordInput, Button,
  Card, CardContent, CardHeader, CardTitle, CardDescription,
  Badge, Skeleton, toast,
} from '@packages/ui';
import { getProfile, updateProfile, changePassword } from '../services/authApi';
import type { UpdateProfileRequest } from '../services/authApi';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  phone: z.string().optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
  confirmPassword: z.string().min(1, 'Please confirm the password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account settings</p>
      </div>

      <div className="space-y-6">
        <ProfileForm profile={profile} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['profile'] })} />
        <ChangePasswordForm />
      </div>
    </div>
  );
}

function ProfileForm({ profile, onSuccess }: { profile: { firstName: string; lastName: string; email: string; phone: string | null; roles: { id: string; name: string }[] }; onSuccess: () => void }) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: UpdateProfileRequest) => updateProfile(data),
    onSuccess: () => {
      toast.success('Profile updated');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update profile');
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    mutation.mutate({
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone || undefined,
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Profile Details</CardTitle>
        <CardDescription>
          <div className="flex gap-1 mt-1">
            {profile.roles.map((r) => (
              <Badge key={r.id} variant="outline" className="text-xs">{r.name}</Badge>
            ))}
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form form={form} onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormInput name="firstName" label="First Name" />
            <FormInput name="lastName" label="Last Name" />
          </div>
          <FormEmailInput name="email" label="Email" />
          <FormPhoneInput name="phone" label="Phone" />
          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}

function ChangePasswordForm() {
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: { oldPassword: string; newPassword: string }) => changePassword(data),
    onSuccess: () => {
      toast.success('Password changed');
      form.reset();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to change password');
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    mutation.mutate({ oldPassword: values.oldPassword, newPassword: values.newPassword });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Change Password</CardTitle>
        <CardDescription>Update your password. You'll need your current password.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form form={form} onSubmit={onSubmit} className="space-y-4">
          <FormPasswordInput name="oldPassword" label="Current Password" />
          <FormPasswordInput name="newPassword" label="New Password" />
          <FormPasswordInput name="confirmPassword" label="Confirm New Password" />
          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Updating...' : 'Change Password'}
            </Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
