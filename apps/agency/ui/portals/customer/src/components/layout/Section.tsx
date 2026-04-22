import { cn } from '@/lib/cn';
import { Container, type ContainerProps } from './Container';
import type { PropsWithChildren, HTMLAttributes } from 'react';

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  /** Vertical rhythm. `tight` for stacked paragraphs, `roomy` for hero/feature. */
  spacing?: 'tight' | 'default' | 'roomy';
  /** Background tone. `muted` for alternating sections, `inverse` for dark-on-light strip. */
  tone?: 'default' | 'muted' | 'inverse';
  containerSize?: ContainerProps['size'];
}

const SPACING_MAP: Record<NonNullable<SectionProps['spacing']>, string> = {
  tight: 'py-12 md:py-16',
  default: 'py-20 md:py-28',
  roomy: 'py-28 md:py-40',
};

const TONE_MAP: Record<NonNullable<SectionProps['tone']>, string> = {
  default: '',
  muted: 'bg-[hsl(var(--surface-muted))]',
  inverse: 'bg-[hsl(var(--foreground))] text-[hsl(var(--background))]',
};

/**
 * The standard section wrapper. Enforces consistent vertical rhythm
 * across the site — every full-width block should sit inside one.
 * Pair with <Container> for horizontal constraints.
 */
export function Section({
  spacing = 'default',
  tone = 'default',
  containerSize = 'default',
  className,
  children,
  ...rest
}: PropsWithChildren<SectionProps>) {
  return (
    <section className={cn(SPACING_MAP[spacing], TONE_MAP[tone], className)} {...rest}>
      <Container size={containerSize}>{children}</Container>
    </section>
  );
}
