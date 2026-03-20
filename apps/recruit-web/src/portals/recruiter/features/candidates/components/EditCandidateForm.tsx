import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormInput,
  FormSelect,
  FormTextarea,
  Button,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@packages/ui';
import { useUpdateCandidate } from '../hooks';
import { SOURCE_OPTIONS, QUALIFICATION_OPTIONS, GENDER_OPTIONS } from '../types';
import type { Candidate } from '../types';

const updateCandidateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  phone: z.string().max(20).optional().or(z.literal('')),
  source: z.string().optional().or(z.literal('')),
  currentCompany: z.string().max(200).optional().or(z.literal('')),
  currentTitle: z.string().max(200).optional().or(z.literal('')),
  expectedSalary: z.string().optional().or(z.literal('')),
  highestQualification: z.string().optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  gender: z.string().optional().or(z.literal('')),
  nationality: z.string().max(100).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(100).optional().or(z.literal('')),
  country: z.string().max(100).optional().or(z.literal('')),
  zipCode: z.string().max(20).optional().or(z.literal('')),
  isWillingToRelocate: z.boolean().optional(),
  availableFrom: z.string().optional().or(z.literal('')),
  linkedinUrl: z.string().max(500).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof updateCandidateSchema>;

interface EditCandidateFormProps {
  candidate: Candidate;
  onClose: () => void;
}

export function EditCandidateForm({ candidate, onClose }: EditCandidateFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(updateCandidateSchema),
    defaultValues: {
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone ?? '',
      source: candidate.source ?? '',
      currentCompany: candidate.currentCompany ?? '',
      currentTitle: candidate.currentTitle ?? '',
      expectedSalary: candidate.expectedSalary ? String(candidate.expectedSalary / 100) : '',
      highestQualification: candidate.highestQualification ?? '',
      dateOfBirth: candidate.dateOfBirth ?? '',
      gender: candidate.gender ?? '',
      nationality: candidate.nationality ?? '',
      address: candidate.address ?? '',
      city: candidate.city ?? '',
      state: candidate.state ?? '',
      country: candidate.country ?? '',
      zipCode: candidate.zipCode ?? '',
      isWillingToRelocate: candidate.isWillingToRelocate ?? false,
      availableFrom: candidate.availableFrom ?? '',
      linkedinUrl: candidate.linkedinUrl ?? '',
      notes: candidate.notes ?? '',
    },
  });

  const updateMutation = useUpdateCandidate({ onSuccess: onClose });

  function onSubmit(data: FormValues) {
    updateMutation.mutate({
      id: candidate.id,
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || undefined,
        source: data.source || undefined,
        currentCompany: data.currentCompany || undefined,
        currentTitle: data.currentTitle || undefined,
        expectedSalary: data.expectedSalary ? Math.round(parseFloat(data.expectedSalary) * 100) : undefined,
        highestQualification: data.highestQualification || undefined,
        dateOfBirth: data.dateOfBirth || undefined,
        gender: data.gender || undefined,
        nationality: data.nationality || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        country: data.country || undefined,
        zipCode: data.zipCode || undefined,
        isWillingToRelocate: data.isWillingToRelocate,
        availableFrom: data.availableFrom || undefined,
        linkedinUrl: data.linkedinUrl || undefined,
        notes: data.notes || undefined,
      },
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit Candidate</DialogTitle>
        <DialogDescription>Update {candidate.firstName} {candidate.lastName}'s profile</DialogDescription>
      </DialogHeader>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground border-b pb-1">Basic Information</h3>
          <div className="grid grid-cols-2 gap-3">
            <FormInput name="firstName" label="First name" />
            <FormInput name="lastName" label="Last name" />
          </div>
          <FormInput name="email" label="Email" type="email" />
          <div className="grid grid-cols-2 gap-3">
            <FormInput name="phone" label="Phone (optional)" />
            <FormInput name="dateOfBirth" label="Date of birth (optional)" type="date" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormSelect name="gender" label="Gender (optional)" placeholder="Select" options={[...GENDER_OPTIONS]} />
            <FormInput name="nationality" label="Nationality (optional)" />
          </div>
        </div>

        {/* Professional */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground border-b pb-1">Professional</h3>
          <div className="grid grid-cols-2 gap-3">
            <FormInput name="currentCompany" label="Company (optional)" />
            <FormInput name="currentTitle" label="Title (optional)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormInput name="expectedSalary" label="Expected salary (optional)" type="number" />
            <FormSelect name="highestQualification" label="Qualification (optional)" placeholder="Select" options={[...QUALIFICATION_OPTIONS]} />
          </div>
        </div>

        {/* Location */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground border-b pb-1">Location</h3>
          <FormInput name="address" label="Address (optional)" />
          <div className="grid grid-cols-3 gap-3">
            <FormInput name="city" label="City" />
            <FormInput name="state" label="State" />
            <FormInput name="zipCode" label="Zip code" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormInput name="country" label="Country" />
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" {...form.register('isWillingToRelocate')} className="rounded border-input" />
                Willing to relocate
              </label>
            </div>
          </div>
        </div>

        {/* Other */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground border-b pb-1">Other</h3>
          <div className="grid grid-cols-2 gap-3">
            <FormSelect name="source" label="Source (optional)" placeholder="Select" options={[...SOURCE_OPTIONS]} />
            <FormInput name="availableFrom" label="Available from (optional)" type="date" />
          </div>
          <FormInput name="linkedinUrl" label="LinkedIn URL (optional)" />
          <FormTextarea name="notes" label="Notes (optional)" rows={3} />
        </div>

        {updateMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(updateMutation.error as any)?.body?.message || 'Failed to update candidate.'}
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
