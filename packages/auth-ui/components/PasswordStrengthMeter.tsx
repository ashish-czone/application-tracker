import { Check, X } from 'lucide-react';
import { calculateStrength } from '../utils/passwordStrength';
import { cn } from '@packages/ui';

interface PasswordStrengthMeterProps {
  password: string;
}

const scoreColors = {
  weak: 'bg-destructive',
  medium: 'bg-yellow-500',
  strong: 'bg-green-500',
} as const;

const scoreWidths = {
  weak: 'w-1/3',
  medium: 'w-2/3',
  strong: 'w-full',
} as const;

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const { score, requirements } = calculateStrength(password);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Password strength</span>
          <span
            className={cn(
              'font-medium capitalize',
              score === 'weak' && 'text-destructive',
              score === 'medium' && 'text-yellow-600',
              score === 'strong' && 'text-green-600',
            )}
          >
            {score}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all', scoreColors[score], scoreWidths[score])}
          />
        </div>
      </div>
      <ul className="space-y-1">
        {requirements.map((req) => (
          <li key={req.label} className="flex items-center gap-2 text-xs">
            {req.met ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={cn(req.met ? 'text-foreground' : 'text-muted-foreground')}>
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
