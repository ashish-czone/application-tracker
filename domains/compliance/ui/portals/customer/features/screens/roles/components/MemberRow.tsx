import { X } from 'lucide-react';
import { AvatarBadge } from '@packages/ui';
import type { RoleMember } from '@packages/rbac-ui';
import { formatMemberName, memberInitials } from '../utils/permissions';

export interface MemberRowProps {
  member: RoleMember;
  onRemove: () => void;
  isSystemRole: boolean;
  isRemoving?: boolean;
}

export function MemberRow({ member, onRemove, isSystemRole, isRemoving }: MemberRowProps) {
  const addedDate = new Date(member.addedAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const fullName = formatMemberName(member);

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-rule last:border-0 group">
      <AvatarBadge initials={memberInitials(member)} size="lg" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-sans text-ink truncate">{fullName}</div>
        <div className="text-[11px] font-serif italic text-ink-muted truncate">{member.email}</div>
      </div>
      <span className="text-[10px] font-sans text-ink-muted uppercase tracking-eyebrow">
        {addedDate}
      </span>
      {!isSystemRole && (
        <button
          type="button"
          onClick={onRemove}
          disabled={isRemoving}
          className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 text-ink-muted hover:text-signal transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={`Remove ${fullName}`}
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
