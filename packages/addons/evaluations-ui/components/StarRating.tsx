import { Star } from 'lucide-react';
import { cn } from '@packages/ui/lib/utils';

interface StarRatingProps {
  value: number | null | undefined;
  max?: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export function StarRating({
  value,
  max = 5,
  onChange,
  size = 'md',
  className,
}: StarRatingProps) {
  const rating = value ?? 0;
  const isInteractive = !!onChange;

  return (
    <div className={cn('inline-flex items-center gap-0.5', className)}>
      {Array.from({ length: max }, (_, i) => {
        const starValue = i + 1;
        const isFilled = starValue <= rating;

        return (
          <button
            key={starValue}
            type="button"
            disabled={!isInteractive}
            onClick={() => onChange?.(starValue)}
            className={cn(
              'transition-colors disabled:cursor-default',
              isInteractive && 'cursor-pointer hover:scale-110',
            )}
          >
            <Star
              className={cn(
                sizeMap[size],
                isFilled
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-transparent text-muted-foreground/40',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
