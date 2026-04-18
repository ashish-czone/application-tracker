import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '@packages/ui';

export interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

/**
 * Form field label — the block eyebrow that sits above an input in drawers
 * and settings. Matches the 10px tracking-eyebrow muted style used
 * throughout the compliance editorial forms.
 *
 * (Distinct from `Eyebrow` in @packages/ui, which renders a span and is
 * meant for section headers rather than form associations.)
 */
export const FieldLabel = forwardRef<HTMLLabelElement, FieldLabelProps>(
  ({ className, children, ...rest }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'block text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans font-medium mb-1',
          className,
        )}
        {...rest}
      >
        {children}
      </label>
    );
  },
);
FieldLabel.displayName = 'FieldLabel';
