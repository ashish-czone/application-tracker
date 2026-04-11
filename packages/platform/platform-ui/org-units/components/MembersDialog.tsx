import { useState, useMemo, useCallback } from 'react';
import { Trash2, Plus, Users } from 'lucide-react';
import {
  Button,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  FormSelect,
  ConfirmDialog,
} from '@packages/ui';
import { usePlatformAPI } from '../../PlatformUIProvider';
import { createUsersApi } from '../../users/services';
import { useOrgPositions } from '../../org-positions/hooks';
import { useOrgUnitMembers, useAddOrgUnitMember, useUpdateMemberPosition, useRemoveOrgUnitMember } from '../hooks';
import type { OrgUnit, OrgUnitMemberDetail } from '../types';

interface MembersDialogProps {
  unit: OrgUnit | null;
  onClose: () => void;
}

export function MembersDialog({ unit, onClose }: MembersDialogProps) {
  const { data: members, isLoading: membersLoading } = useOrgUnitMembers(unit?.id ?? null);
  const { data: positions } = useOrgPositions();
  const apiFn = usePlatformAPI();
  const usersApi = useMemo(() => createUsersApi(apiFn), [apiFn]);

  const [addMode, setAddMode] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newPositionId, setNewPositionId] = useState('');
  const [removingMember, setRemovingMember] = useState<OrgUnitMemberDetail | null>(null);

  const addMutation = useAddOrgUnitMember({
    onSuccess: () => {
      setAddMode(false);
      setNewUserId('');
      setNewPositionId('');
    },
  });
  const updatePositionMutation = useUpdateMemberPosition();
  const removeMutation = useRemoveOrgUnitMember({ onSuccess: () => setRemovingMember(null) });

  const positionOptions = useMemo(
    () => (positions ?? []).map((p) => ({ label: p.name, value: p.id })),
    [positions],
  );

  const existingUserIds = useMemo(
    () => new Set((members ?? []).map((m) => m.userId)),
    [members],
  );

  const searchUsers = useCallback(
    async (query: string) => {
      const result = await usersApi.listUsers({ search: query, limit: 25, sort: 'firstName', order: 'asc' });
      return result.data
        .filter((u) => !existingUserIds.has(u.id))
        .map((u) => ({ label: `${u.firstName} ${u.lastName}`, value: u.id }));
    },
    [usersApi, existingUserIds],
  );

  function handleAdd() {
    if (!unit || !newUserId) return;
    addMutation.mutate({
      unitId: unit.id,
      userId: newUserId,
      data: newPositionId ? { positionId: newPositionId } : undefined,
    });
  }

  function handlePositionChange(userId: string, positionId: string) {
    if (!unit) return;
    updatePositionMutation.mutate({
      unitId: unit.id,
      userId,
      data: { positionId: positionId || null },
    });
  }

  function handleClose() {
    setAddMode(false);
    setNewUserId('');
    setNewPositionId('');
    onClose();
  }

  return (
    <>
      <Dialog open={!!unit} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Manage Members — {unit?.name}
            </DialogTitle>
            <DialogDescription>
              Add or remove members and assign positions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add member button / form */}
            {!addMode ? (
              <Button size="sm" variant="outline" onClick={() => setAddMode(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Member
              </Button>
            ) : (
              <div className="flex items-end gap-2 p-3 rounded-lg border bg-muted/50">
                <div className="flex-1">
                  <FormSelect
                    label="User"
                    onSearch={searchUsers}
                    value={newUserId}
                    onChange={setNewUserId}
                    placeholder="Search users..."
                  />
                </div>
                <div className="flex-1">
                  <FormSelect
                    label="Position"
                    options={[{ label: 'No position', value: '' }, ...positionOptions]}
                    value={newPositionId}
                    onChange={setNewPositionId}
                    placeholder="Select position..."
                  />
                </div>
                <div className="flex gap-1 pb-0.5">
                  <Button size="sm" onClick={handleAdd} disabled={!newUserId || addMutation.isPending}>
                    {addMutation.isPending ? 'Adding...' : 'Add'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddMode(false); setNewUserId(''); setNewPositionId(''); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Members list */}
            {membersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : !members || members.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No members in this unit yet.
              </div>
            ) : (
              <div className="space-y-1">
                {members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between rounded-lg border bg-card px-3 py-2"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-sm font-medium text-foreground truncate">
                        {member.userName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-36">
                        <FormSelect
                          options={[{ label: 'No position', value: '' }, ...positionOptions]}
                          value={member.positionId ?? ''}
                          onChange={(val) => handlePositionChange(member.userId, val)}
                          placeholder="Position..."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setRemovingMember(member)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label={`Remove ${member.userName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove member confirmation */}
      <ConfirmDialog
        open={!!removingMember}
        onOpenChange={(open) => !open && setRemovingMember(null)}
        title="Remove Member"
        description={`Are you sure you want to remove "${removingMember?.userName}" from this unit?`}
        confirmLabel="Remove"
        isPending={removeMutation.isPending}
        onConfirm={() =>
          removingMember && unit && removeMutation.mutate({ unitId: unit.id, userId: removingMember.userId })
        }
      />
    </>
  );
}
