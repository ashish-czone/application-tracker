import { AvatarBadge } from '@packages/ui';

export interface HandlerPillProps {
  initials: string;
  name: string;
  size?: 'xs' | 'sm';
}

export function HandlerPill({ initials, name, size = 'sm' }: HandlerPillProps) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <AvatarBadge initials={initials} size={size} />
      <span className="text-[11px] font-sans text-ink-soft truncate">
        {name.split(' ')[0]}
      </span>
    </div>
  );
}
