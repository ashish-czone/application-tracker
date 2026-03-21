import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { ArrowLeft, Trash2, Mail, Phone } from 'lucide-react';
import { z } from 'zod';
import { Button, ConfirmDialog } from '@packages/ui';
import { useCandidate, useDeleteCandidate } from '../hooks';
import { ProfileCompleteness } from '../components/ProfileCompleteness';
import { CandidateInfoSection } from '../components/CandidateInfoSection';
import { SkillsManager } from '../components/SkillsManager';
import { ResumeSection } from '../components/ResumeSection';
import { SOURCE_OPTIONS, QUALIFICATION_OPTIONS, GENDER_OPTIONS } from '../types';

// Section schemas
const basicSchema = z.object({
  firstName: z.string().min(1, 'Required').max(100),
  lastName: z.string().min(1, 'Required').max(100),
  email: z.string().min(1, 'Required').email('Invalid email'),
  phone: z.string().max(20).optional().or(z.literal('')),
  gender: z.string().optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  nationality: z.string().max(100).optional().or(z.literal('')),
});

const professionalSchema = z.object({
  currentTitle: z.string().max(200).optional().or(z.literal('')),
  currentCompany: z.string().max(200).optional().or(z.literal('')),
  expectedSalary: z.string().optional().or(z.literal('')),
  source: z.string().optional().or(z.literal('')),
  availableFrom: z.string().optional().or(z.literal('')),
  isWillingToRelocate: z.boolean().optional(),
  linkedinUrl: z.string().max(500).optional().or(z.literal('')),
});

const educationSchema = z.object({
  highestQualification: z.string().optional().or(z.literal('')),
});

const addressSchema = z.object({
  address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(100).optional().or(z.literal('')),
  country: z.string().max(100).optional().or(z.literal('')),
  zipCode: z.string().max(20).optional().or(z.literal('')),
});

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: candidate, isLoading, isError } = useCandidate(id ?? null);
  const deleteMutation = useDeleteCandidate({
    onSuccess: () => navigate('/candidates'),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-1">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (isError || !candidate) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Candidate not found</p>
        <Link to="/candidates" className="text-sm text-primary hover:underline mt-2 inline-block">
          Back to candidates
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/candidates"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Candidates
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {candidate.firstName} {candidate.lastName}
            </h1>
            {(candidate.currentTitle || candidate.currentCompany) && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {[candidate.currentTitle, candidate.currentCompany].filter(Boolean).join(' at ')}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {candidate.email}
              </span>
              {candidate.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {candidate.phone}
                </span>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>

        <div className="mt-4">
          <ProfileCompleteness candidate={candidate} />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        <CandidateInfoSection
          title="Basic Information"
          candidate={candidate}
          schema={basicSchema}
          fields={[
            { key: 'firstName', label: 'First Name' },
            { key: 'lastName', label: 'Last Name' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'phone', label: 'Phone' },
            { key: 'gender', label: 'Gender', type: 'select', options: [...GENDER_OPTIONS] },
            { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
            { key: 'nationality', label: 'Nationality' },
          ]}
        />

        <CandidateInfoSection
          title="Professional Details"
          candidate={candidate}
          schema={professionalSchema}
          fields={[
            { key: 'currentTitle', label: 'Current Title' },
            { key: 'currentCompany', label: 'Current Company' },
            { key: 'expectedSalary', label: 'Expected Salary', type: 'number' },
            { key: 'source', label: 'Source', type: 'select', options: [...SOURCE_OPTIONS] },
            { key: 'availableFrom', label: 'Available From', type: 'date' },
            { key: 'isWillingToRelocate', label: 'Willing to Relocate', type: 'checkbox' },
            { key: 'linkedinUrl', label: 'LinkedIn URL' },
          ]}
        />

        <CandidateInfoSection
          title="Education"
          candidate={candidate}
          schema={educationSchema}
          fields={[
            { key: 'highestQualification', label: 'Highest Qualification', type: 'select', options: [...QUALIFICATION_OPTIONS] },
          ]}
        />

        <CandidateInfoSection
          title="Address"
          candidate={candidate}
          schema={addressSchema}
          fields={[
            { key: 'address', label: 'Street Address', colSpan: 2 },
            { key: 'city', label: 'City' },
            { key: 'state', label: 'State' },
            { key: 'country', label: 'Country' },
            { key: 'zipCode', label: 'Zip Code' },
          ]}
        />

        <SkillsManager candidate={candidate} />

        <ResumeSection candidate={candidate} />

        {/* Applications placeholder */}
        <div className="border rounded-lg">
          <div className="px-4 py-3 bg-muted/30">
            <span className="text-sm font-medium text-foreground">Applications</span>
          </div>
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">No applications yet</p>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete candidate"
        description={`This will delete ${candidate.firstName} ${candidate.lastName}'s profile.`}
        confirmLabel="Delete candidate"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(candidate.id)}
      />
    </div>
  );
}
