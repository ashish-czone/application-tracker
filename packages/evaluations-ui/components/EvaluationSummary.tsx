import { StarRating } from './StarRating';

interface EvaluationSummaryProps {
  averageRating: number | null;
  count: number;
  criteria?: { name: string; average: number }[];
}

export function EvaluationSummary({ averageRating, count, criteria }: EvaluationSummaryProps) {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <StarRating value={Math.round(averageRating ?? 0)} />
        <span className="text-sm font-medium">
          {averageRating?.toFixed(1) ?? '—'}
        </span>
      </div>
      <span className="text-sm text-muted-foreground">
        {count} {count === 1 ? 'evaluation' : 'evaluations'}
      </span>
      {criteria && criteria.length > 0 && (
        <div className="ml-auto flex flex-wrap gap-3">
          {criteria.map((c) => (
            <div key={c.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{c.name}</span>
              <StarRating value={Math.round(c.average)} size="sm" />
              <span>{c.average.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
