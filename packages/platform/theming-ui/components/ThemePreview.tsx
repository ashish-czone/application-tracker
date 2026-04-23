import type { CSSProperties, ReactNode } from 'react';
import { Badge, Button } from '@packages/ui';
import { themeCssVars } from '../css-vars';
import { resolveFontStack } from '../theme-config';
import type { ThemeConfig } from '../types';

interface ThemePreviewProps {
  theme: ThemeConfig;
  isDark: boolean;
  children?: ReactNode;
  className?: string;
}

/**
 * Renders a sample of buttons + badge using the given theme, with CSS vars
 * scoped to the preview container (no mutation of `document.documentElement`).
 * Pass `children` to render custom sample content instead of the default.
 */
export function ThemePreview({ theme, isDark, children, className }: ThemePreviewProps) {
  const style: CSSProperties = {
    ...(themeCssVars(theme, isDark) as CSSProperties),
    fontFamily: resolveFontStack(theme),
    background: 'hsl(var(--card))',
    color: 'hsl(var(--card-foreground))',
  };

  return (
    <div
      className={
        className ??
        'flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-border p-6'
      }
      style={style}
    >
      {children ?? (
        <>
          <Button>Primary action</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Badge>Badge</Badge>
          <span className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {isDark ? 'Dark mode' : 'Light mode'}
          </span>
        </>
      )}
    </div>
  );
}
