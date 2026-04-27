import type { ReactNode } from 'react';

export interface InfoRowProps {
  label: string;
  children: ReactNode;
}

export function InfoRow({ label, children }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-rule last:border-b-0">
      <span className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted w-28 flex-none pt-0.5">
        {label}
      </span>
      <div className="text-sm text-ink font-sans">{children}</div>
    </div>
  );
}
