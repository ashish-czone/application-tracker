import { AvatarBadge } from '@packages/ui';
import type { Handler } from '../../../../../../shared/types';

export interface HandlerPillProps {
  handler: Handler;
}

export function HandlerPill({ handler }: HandlerPillProps) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <AvatarBadge initials={handler.initials} size="sm" />
      <span className="text-[11px] font-sans text-ink-soft truncate">
        {handler.name.split(' ')[0]}
      </span>
    </div>
  );
}
