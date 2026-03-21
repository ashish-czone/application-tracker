import type { Candidate } from '../types';

const FIELD_WEIGHTS: { field: string; weight: number; check: (c: Candidate) => boolean }[] = [
  { field: 'phone', weight: 8, check: (c) => !!c.phone },
  { field: 'currentTitle', weight: 10, check: (c) => !!c.currentTitle },
  { field: 'currentCompany', weight: 10, check: (c) => !!c.currentCompany },
  { field: 'expectedSalary', weight: 7, check: (c) => c.expectedSalary != null && c.expectedSalary > 0 },
  { field: 'source', weight: 5, check: (c) => !!c.source },
  { field: 'resumeFile', weight: 15, check: (c) => !!c.resumeFile },
  { field: 'skills', weight: 10, check: (c) => c.skills?.length > 0 },
  { field: 'highestQualification', weight: 5, check: (c) => !!c.highestQualification },
  { field: 'address', weight: 5, check: (c) => !!(c.address || c.city || c.country) },
  { field: 'dateOfBirth', weight: 5, check: (c) => !!c.dateOfBirth },
  { field: 'nationality', weight: 5, check: (c) => !!c.nationality },
  { field: 'linkedinUrl', weight: 5, check: (c) => !!c.linkedinUrl },
  { field: 'availableFrom', weight: 5, check: (c) => !!c.availableFrom },
  { field: 'gender', weight: 5, check: (c) => !!c.gender },
];

export function calculateCompleteness(candidate: Candidate): number {
  let score = 0;
  for (const { weight, check } of FIELD_WEIGHTS) {
    if (check(candidate)) score += weight;
  }
  return Math.min(score, 100);
}

interface ProfileCompletenessProps {
  candidate: Candidate;
}

export function ProfileCompleteness({ candidate }: ProfileCompletenessProps) {
  const pct = calculateCompleteness(candidate);
  const color = pct < 40 ? 'bg-destructive' : pct < 70 ? 'bg-yellow-500' : 'bg-emerald-500';
  const textColor = pct < 40 ? 'text-destructive' : pct < 70 ? 'text-yellow-600' : 'text-emerald-600';

  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm font-medium ${textColor}`}>{pct}% complete</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-48">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
