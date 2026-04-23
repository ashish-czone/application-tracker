import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserCog, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Button,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Form,
  FormInput,
  ConfirmDialog,
} from '@packages/ui';
import { useOrgPositions, useCreateOrgPosition, useUpdateOrgPosition, useDeleteOrgPosition } from '../hooks';
import type { OrgPosition } from '../types';

const positionSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
});

type PositionFormValues = z.infer<typeof positionSchema>;

export function OrgPositionsPage() {
  const { data: positions, isLoading } = useOrgPositions();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<OrgPosition | null>(null);
  const [deleting, setDeleting] = useState<OrgPosition | null>(null);

  const createMutation = useCreateOrgPosition({ onSuccess: () => setAddOpen(false) });
  const updateMutation = useUpdateOrgPosition({ onSuccess: () => setEditing(null) });
  const deleteMutation = useDeleteOrgPosition({ onSuccess: () => setDeleting(null) });

  const addForm = useForm<PositionFormValues>({
    resolver: zodResolver(positionSchema),
    defaultValues: { name: '' },
  });

  const editForm = useForm<PositionFormValues>({
    resolver: zodResolver(positionSchema),
  });

  function handleAdd(data: PositionFormValues) {
    createMutation.mutate({ name: data.name, sortOrder: (positions?.length ?? 0) });
  }

  function handleEdit(data: PositionFormValues) {
    if (!editing) return;
    updateMutation.mutate({ id: editing.id, data: { name: data.name } });
  }

  function openEdit(position: OrgPosition) {
    editForm.reset({ name: position.name });
    setEditing(position);
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Org Positions</h1>
          <p className="text-sm text-muted-foreground">
            Define positions within org units and configure their data access scopes
          </p>
        </div>
        <Button size="sm" onClick={() => { addForm.reset({ name: '' }); setAddOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          Add Position
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : positions?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <UserCog className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <h3 className="text-sm font-medium text-foreground">No positions yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create positions like "Head", "Lead", or "Member" to control data visibility.
          </p>
          <Button size="sm" className="mt-4" onClick={() => { addForm.reset({ name: '' }); setAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />
            Add Position
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {positions?.map((position) => (
            <div
              key={position.id}
              className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium text-foreground">{position.name}</div>
                <div className="text-xs text-muted-foreground">Sort order: {position.sortOrder}</div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(position)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label={`Edit ${position.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(position)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label={`Delete ${position.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Position Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Position</DialogTitle>
            <DialogDescription>
              Create a new org position (e.g. Department Head, Team Lead, Member)
            </DialogDescription>
          </DialogHeader>
          <Form form={addForm} onSubmit={addForm.handleSubmit(handleAdd)} className="space-y-4">
            <FormInput name="name" label="Position name" placeholder="e.g. Team Lead" autoComplete="off" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Position Modal */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Position</DialogTitle>
            <DialogDescription>Update the position name</DialogDescription>
          </DialogHeader>
          <Form form={editForm} onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
            <FormInput name="name" label="Position name" autoComplete="off" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete Position"
        description={`Are you sure you want to delete "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />

    </div>
  );
}
