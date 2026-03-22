import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { ArrowLeft, Trash2, Mail, Phone } from 'lucide-react';
import { Button, ConfirmDialog } from '@packages/ui';
import { DynamicSection } from '@packages/eav-attributes-ui';
import { useCandidate, useUpdateCandidate, useDeleteCandidate } from '../hooks';
import { useLayout } from '../../field-management/hooks';
import { ProfileCompleteness } from '../components/ProfileCompleteness';
import { SkillsManager } from '../components/SkillsManager';
import { ResumeSection } from '../components/ResumeSection';

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: candidate, isLoading, isError } = useCandidate(id ?? null);
  const { data: layout, isLoading: layoutLoading } = useLayout('candidates');
  const updateMutation = useUpdateCandidate();
  const deleteMutation = useDeleteCandidate({
    onSuccess: () => navigate('/candidates'),
  });

  if (isLoading || layoutLoading) {
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
              {candidate.firstName as string} {candidate.lastName as string}
            </h1>
            {(candidate.currentTitle || candidate.currentCompany) && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {[candidate.currentTitle, candidate.currentCompany].filter(Boolean).join(' at ')}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {candidate.email as string}
              </span>
              {candidate.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {candidate.phone as string}
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

      {/* Layout-driven sections */}
      <div className="space-y-4">
        {layout?.sections
          .filter(s => s.fields.length > 0)
          .map(section => (
            <DynamicSection
              key={section.id}
              section={section}
              values={candidate}
              onSave={async (values) => {
                await updateMutation.mutateAsync({ id: candidate.id, data: values });
              }}
              isSaving={updateMutation.isPending}
            />
          ))}

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
