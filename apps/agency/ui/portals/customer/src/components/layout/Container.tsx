import { cn } from '@/lib/cn';
import type { PropsWithChildren, HTMLAttributes } from 'react';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'narrow' | 'default' | 'wide' | 'full';
}

const SIZE_MAP: Record<NonNullable<ContainerProps['size']>, string> = {
  narrow: 'max-w-3xl',
  default: 'max-w-6xl',
  wide: 'max-w-7xl',
  full: 'max-w-none',
};

/**
 * Page-width container with the site's horizontal padding + max-width.
 * `size` picks one of four widths tuned to the type scale — `narrow`
 * for reading columns (post body), `default` for most sections,
 * `wide` for edge-to-edge marquees and galleries, `full` for truly
 * bleed layouts.
 */
export function Container({ size = 'default', className, children, ...rest }: PropsWithChildren<ContainerProps>) {
  return (
    <div className={cn('mx-auto w-full px-6 md:px-10', SIZE_MAP[size], className)} {...rest}>
      {children}
    </div>
  );
}
