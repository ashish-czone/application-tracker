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
import { useCreateCandidate } from '../hooks';
import { SOURCE_OPTIONS, QUALIFICATION_OPTIONS, GENDER_OPTIONS } from '../types';

const createCandidateSchema = z.object({
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

type FormValues = z.infer<typeof createCandidateSchema>;

interface AddCandidateFormProps {
  onClose: () => void;
}

export function AddCandidateForm({ onClose }: AddCandidateFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(createCandidateSchema),
    defaultValues: {
      firstName: '', lastName: '', email: '', phone: '',
      source: '', currentCompany: '', currentTitle: '', expectedSalary: '',
      highestQualification: '', dateOfBirth: '', gender: '', nationality: '',
      address: '', city: '', state: '', country: '', zipCode: '',
      isWillingToRelocate: false, availableFrom: '', linkedinUrl: '', notes: '',
    },
  });

  const createMutation = useCreateCandidate({ onSuccess: onClose });

  function onSubmit(data: FormValues) {
    createMutation.mutate({
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
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Candidate</DialogTitle>
        <DialogDescription>Create a new candidate profile</DialogDescription>
      </DialogHeader>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground border-b pb-1">Basic Information</h3>
          <div className="grid grid-cols-2 gap-3">
            <FormInput name="firstName" label="First name" placeholder="John" />
            <FormInput name="lastName" label="Last name" placeholder="Doe" />
          </div>
          <FormInput name="email" label="Email" placeholder="john@example.com" type="email" />
          <div className="grid grid-cols-2 gap-3">
            <FormInput name="phone" label="Phone (optional)" placeholder="+1 555 123 4567" />
            <FormInput name="dateOfBirth" label="Date of birth (optional)" type="date" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormSelect name="gender" label="Gender (optional)" placeholder="Select" options={[...GENDER_OPTIONS]} />
            <FormInput name="nationality" label="Nationality (optional)" placeholder="US" />
          </div>
        </div>

        {/* Professional */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground border-b pb-1">Professional</h3>
          <div className="grid grid-cols-2 gap-3">
            <FormInput name="currentCompany" label="Company (optional)" placeholder="Google" />
            <FormInput name="currentTitle" label="Title (optional)" placeholder="Senior Engineer" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormInput name="expectedSalary" label="Expected salary (optional)" placeholder="120000" type="number" />
            <FormSelect name="highestQualification" label="Qualification (optional)" placeholder="Select" options={[...QUALIFICATION_OPTIONS]} />
          </div>
        </div>

        {/* Location */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground border-b pb-1">Location</h3>
          <FormInput name="address" label="Address (optional)" placeholder="123 Main St" />
          <div className="grid grid-cols-3 gap-3">
            <FormInput name="city" label="City" placeholder="San Francisco" />
            <FormInput name="state" label="State" placeholder="CA" />
            <FormInput name="zipCode" label="Zip code" placeholder="94105" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormInput name="country" label="Country" placeholder="US" />
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
          <FormInput name="linkedinUrl" label="LinkedIn URL (optional)" placeholder="https://linkedin.com/in/johndoe" />
          <FormTextarea name="notes" label="Notes (optional)" placeholder="Additional notes..." rows={3} />
        </div>

        {createMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(createMutation.error as any)?.body?.message || 'Failed to create candidate.'}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create candidate'}
          </Button>
        </DialogFooter>
      </Form>
    </>
  );
}
