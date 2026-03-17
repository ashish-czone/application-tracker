import { Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: PasswordRequirement[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'Number', test: (p) => /[0-9]/.test(p) },
];

function getStrength(password: string): number {
  if (!password) return 0;
  return requirements.filter((r) => r.test(password)).length;
}

function getStrengthLabel(strength: number): { label: string; color: string } {
  if (strength === 0) return { label: '', color: '' };
  if (strength <= 1) return { label: 'Weak', color: 'bg-destructive' };
  if (strength <= 2) return { label: 'Fair', color: 'bg-warning' };
  if (strength <= 3) return { label: 'Good', color: 'bg-primary' };
  return { label: 'Strong', color: 'bg-success' };
}

interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = getStrength(password);
  const { label, color } = getStrengthLabel(strength);

  if (!password) return null;

  return (
    <div className="space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i < strength ? color : 'bg-muted',
              )}
            />
          ))}
        </div>
        {label && (
          <span className="text-xs text-muted-foreground">{label}</span>
        )}
      </div>

      {/* Requirements checklist */}
      <ul className="space-y-1">
        {requirements.map((req) => {
          const met = req.test(password);
          return (
            <li key={req.label} className="flex items-center gap-1.5 text-xs">
              {met ? (
                <Check className="h-3 w-3 text-success shrink-0" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              <span className={met ? 'text-foreground' : 'text-muted-foreground'}>
                {req.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
