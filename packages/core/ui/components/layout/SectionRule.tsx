import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface SectionRuleProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional centered label (e.g. "§ II — FILINGS"). */
  label?: ReactNode;
  /** "single" = 1px hairline, "double" = two hairlines with gap, "heavy" = 2px. */
  weight?: 'single' | 'double' | 'heavy';
  /** Horizontal alignment of the label. */
  align?: 'left' | 'center' | 'right';
}

/**
 * The workhorse section divider. Renders a hairline horizontal rule with an
 * optional inline small-caps label that breaks the rule into two segments —
 * like a legal document or editorial section break.
 */
export const SectionRule = forwardRef<HTMLDivElement, SectionRuleProps>(
  ({ label, weight = 'single', align = 'left', className, ...rest }, ref) => {
    const ruleClass =
      weight === 'heavy'
        ? 'border-t-2 border-ink-soft'
        : weight === 'double'
          ? 'border-t border-rule shadow-ink-hair pb-[2px]'
          : 'border-t border-rule';

    if (!label) {
      return <div ref={ref} className={cn('w-full', ruleClass, className)} {...rest} />;
    }

    const leftGrow = align === 'left' ? 'w-12 flex-none' : 'flex-1';
    const rightGrow = align === 'right' ? 'w-12 flex-none' : 'flex-1';

    return (
      <div ref={ref} className={cn('flex items-center gap-4 w-full', className)} {...rest}>
        <div className={cn(ruleClass, leftGrow)} />
        <span className="uppercase font-sans font-medium text-[11px] tracking-eyebrow text-ink-muted whitespace-nowrap">
          {label}
        </span>
        <div className={cn(ruleClass, rightGrow)} />
      </div>
    );
  },
);
SectionRule.displayName = 'SectionRule';
