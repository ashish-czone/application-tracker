import * as React from 'react';
import { cn } from '../lib/utils';

export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Orientation — horizontal (default) or vertical stack. */
  orientation?: 'horizontal' | 'vertical';
  /**
   * When true, adjacent buttons share borders and lose their individual
   * rounded corners (only outer corners round). Defaults to true.
   */
  attached?: boolean;
}

/**
 * Visual grouping of `Button` elements. In attached mode (default) the
 * buttons sit flush against each other and shared borders collapse into a
 * single hairline — perfect for toolbar clusters and segmented controls.
 *
 * Under `.theme-instrument` the group picks up `data-slot="button-group"`
 * styling: sharp corners, hairline divider between buttons, and a subtle
 * paper-raised recess.
 */
export const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, orientation = 'horizontal', attached = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="button-group"
        data-orientation={orientation}
        data-attached={attached ? 'true' : 'false'}
        role="group"
        className={cn(
          'inline-flex',
          orientation === 'horizontal' ? 'flex-row' : 'flex-col',
          attached && orientation === 'horizontal' && '[&>*]:rounded-none [&>*:first-child]:rounded-l-md [&>*:last-child]:rounded-r-md [&>*:not(:first-child)]:-ml-px',
          attached && orientation === 'vertical' && '[&>*]:rounded-none [&>*:first-child]:rounded-t-md [&>*:last-child]:rounded-b-md [&>*:not(:first-child)]:-mt-px',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ButtonGroup.displayName = 'ButtonGroup';
