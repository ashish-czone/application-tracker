import { useState } from 'react';
import {
  X,
  Mail,
  Phone,
  Shield,
  Building2,
  Clock,
  Ban,
  RotateCcw,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Eyebrow,
  DetailRow,
  AvatarBadge,
  DrawerShell,
  ConfirmDialog,
} from '@packages/ui';
import { useRemoveRoleMember } from '@packages/rbac-ui';
import { useRemoveOrgUnitMember } from '@packages/org-units-ui';
import { OrdinalDate } from '../../../../../../components';
import type { UserRow, UserRole, UserPosition } from '../data/usersMock';
import { StatusPill } from './StatusPill';
import { RoleAssignEditor } from './RoleAssignEditor';
import { PositionAssignEditor } from './PositionAssignEditor';

export interface UserDetailDrawerProps {
  user: UserRow;
  onClose: () => void;
  onDeactivate?: () => void;
  onRestore?: () => void;
  onResendInvite?: () => void;
  /** Disables the status-action button while a mutation is in flight. */
  actionPending?: boolean;
}

export function UserDetailDrawer({
  user,
  onClose,
  onDeactivate,
  onRestore,
  onResendInvite,
  actionPending = false,
}: UserDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [assignRoleOpen, setAssignRoleOpen] = useState(false);
  const [addPositionOpen, setAddPositionOpen] = useState(false);
  const [roleToRemove, setRoleToRemove] = useState<UserRole | null>(null);
  const [positionToRemove, setPositionToRemove] = useState<UserPosition | null>(null);

  const removeRole = useRemoveRoleMember();
  const removePosition = useRemoveOrgUnitMember();

  const handleConfirmRemoveRole = () => {
    if (!roleToRemove) return;
    removeRole.mutate(
      { roleId: roleToRemove.id, userId: user.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['users'] });
          setRoleToRemove(null);
        },
      },
    );
  };

  const handleConfirmRemovePosition = () => {
    if (!positionToRemove) return;
    // UserPosition.id is the unitId in mapUserRecord — see mapPositions there.
    removePosition.mutate(
      { unitId: positionToRemove.id, userId: user.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['users'] });
          setPositionToRemove(null);
        },
      },
    );
  };

  const excludeRoleIds = user.roles.map((r) => r.id);
  const excludeUnitIds = user.positions.map((p) => p.id);

  return (
    <DrawerShell onClose={onClose} width="xl">
      <header className="px-6 pt-6 pb-4 border-b border-rule flex-none">
        <div className="flex items-start justify-between gap-4 mb-4">
          <Eyebrow tone="muted" mark="§">
            User profile
          </Eyebrow>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <AvatarBadge initials={user.initials} size="xl" color={user.color} />
          <div className="min-w-0">
            <h2 className="font-serif text-2xl text-ink leading-tight">{user.name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <StatusPill status={user.status} />
              {user.positions.length > 0 && (
                <span className="font-serif italic text-[11px] text-ink-muted">
                  {user.positions[0].title}, {user.positions[0].unitName}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <section className="px-6 py-5 border-b border-rule">
          <div className="grid grid-cols-2 gap-4">
            <DetailRow label="Email">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3 h-3 text-ink-muted" strokeWidth={1.5} />
                <span className="font-mono text-[12px]">{user.email}</span>
              </span>
            </DetailRow>
            <DetailRow label="Phone">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-ink-muted" strokeWidth={1.5} />
                <span className="font-mono text-[12px]">{user.phone}</span>
              </span>
            </DetailRow>
            <DetailRow label="Member since">
              <OrdinalDate date={user.createdAt} variant="short" className="text-sm" />
            </DetailRow>
            <DetailRow label="Last active">
              {user.lastActiveAt ? (
                <OrdinalDate date={user.lastActiveAt} variant="short" className="text-sm" />
              ) : (
                <span className="text-ink-muted italic">Never</span>
              )}
            </DetailRow>
          </div>
        </section>

        <section className="px-6 py-5 border-b border-rule">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
              <span className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
                Roles
              </span>
            </div>
            {!assignRoleOpen && (
              <button
                type="button"
                onClick={() => setAssignRoleOpen(true)}
                className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-authority hover:text-authority-soft transition-colors"
              >
                + Assign role
              </button>
            )}
          </div>

          {assignRoleOpen && (
            <div className="mb-3">
              <RoleAssignEditor
                userId={user.id}
                excludeRoleIds={excludeRoleIds}
                onClose={() => setAssignRoleOpen(false)}
              />
            </div>
          )}

          {user.roles.length > 0 ? (
            <div className="space-y-1.5">
              {user.roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center justify-between px-3 py-2 border border-rule bg-paper"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-authority" strokeWidth={1.5} />
                    <span className="text-sm font-sans text-ink">{role.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRoleToRemove(role)}
                    className="text-ink-muted hover:text-signal transition-colors"
                    title="Remove role"
                  >
                    <X className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-serif italic text-ink-muted">No roles assigned</p>
          )}
        </section>

        <section className="px-6 py-5 border-b border-rule">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
              <span className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
                Positions
              </span>
            </div>
            {!addPositionOpen && (
              <button
                type="button"
                onClick={() => setAddPositionOpen(true)}
                className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-authority hover:text-authority-soft transition-colors"
              >
                + Add position
              </button>
            )}
          </div>

          {addPositionOpen && (
            <div className="mb-3">
              <PositionAssignEditor
                userId={user.id}
                excludeUnitIds={excludeUnitIds}
                onClose={() => setAddPositionOpen(false)}
              />
            </div>
          )}

          {user.positions.length > 0 ? (
            <div className="space-y-1.5">
              {user.positions.map((pos) => (
                <div
                  key={pos.id}
                  className="flex items-center justify-between px-3 py-2 border border-rule bg-paper"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-sans text-ink">{pos.title}</div>
                    <div className="text-[11px] font-serif italic text-ink-muted">
                      {pos.unitName}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPositionToRemove(pos)}
                    className="text-ink-muted hover:text-signal transition-colors flex-none"
                    title="Remove position"
                  >
                    <X className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-serif italic text-ink-muted">No positions assigned</p>
          )}
        </section>

        <section className="px-6 py-5">
          <span className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-3 block">
            Actions
          </span>
          <div className="flex flex-wrap gap-2">
            {user.status === 'active' && (
              <button
                type="button"
                disabled={actionPending}
                onClick={onDeactivate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rule text-[11px] font-sans font-medium text-ink-soft hover:text-ink hover:border-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Ban className="w-3 h-3" strokeWidth={1.5} />
                Deactivate
              </button>
            )}
            {user.status === 'deactivated' && (
              <button
                type="button"
                disabled={actionPending}
                onClick={onRestore}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rule text-[11px] font-sans font-medium text-ink-soft hover:text-ink hover:border-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-3 h-3" strokeWidth={1.5} />
                Reactivate
              </button>
            )}
            {user.status === 'invited' && (
              <button
                type="button"
                disabled={actionPending}
                onClick={onResendInvite}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rule text-[11px] font-sans font-medium text-ink-soft hover:text-ink hover:border-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Mail className="w-3 h-3" strokeWidth={1.5} />
                Resend invite
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rule text-[11px] font-sans font-medium text-ink-soft hover:text-ink hover:border-ink transition-colors"
            >
              <Clock className="w-3 h-3" strokeWidth={1.5} />
              View activity
            </button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={roleToRemove !== null}
        onOpenChange={(open) => !removeRole.isPending && !open && setRoleToRemove(null)}
        title="Remove role?"
        description={
          roleToRemove
            ? `${user.name} will lose the "${roleToRemove.name}" role and any permissions it grants.`
            : ''
        }
        confirmLabel="Remove role"
        destructive
        isPending={removeRole.isPending}
        pendingLabel="Removing…"
        onConfirm={handleConfirmRemoveRole}
      />

      <ConfirmDialog
        open={positionToRemove !== null}
        onOpenChange={(open) => !removePosition.isPending && !open && setPositionToRemove(null)}
        title="Remove position?"
        description={
          positionToRemove
            ? `${user.name} will be removed from "${positionToRemove.unitName}".`
            : ''
        }
        confirmLabel="Remove position"
        destructive
        isPending={removePosition.isPending}
        pendingLabel="Removing…"
        onConfirm={handleConfirmRemovePosition}
      />
    </DrawerShell>
  );
}
