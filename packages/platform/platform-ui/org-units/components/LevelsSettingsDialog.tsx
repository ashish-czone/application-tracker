import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
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
import { useOrgUnitLevels, useCreateOrgUnitLevel, useUpdateOrgUnitLevel, useDeleteOrgUnitLevel } from '../hooks';
import type { OrgUnitLevel } from '../types';

const levelSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
});

type LevelFormValues = z.infer<typeof levelSchema>;

interface LevelsSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function LevelsSettingsDialog({ open, onClose }: LevelsSettingsDialogProps) {
  const { data: levels, isLoading } = useOrgUnitLevels();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<OrgUnitLevel | null>(null);
  const [deleting, setDeleting] = useState<OrgUnitLevel | null>(null);

  const createMutation = useCreateOrgUnitLevel({ onSuccess: () => setAddOpen(false) });
  const updateMutation = useUpdateOrgUnitLevel({ onSuccess: () => setEditing(null) });
  const deleteMutation = useDeleteOrgUnitLevel({ onSuccess: () => setDeleting(null) });

  const addForm = useForm<LevelFormValues>({
    resolver: zodResolver(levelSchema),
    defaultValues: { name: '' },
  });

  const editForm = useForm<LevelFormValues>({
    resolver: zodResolver(levelSchema),
  });

  function handleAdd(data: LevelFormValues) {
    createMutation.mutate({ name: data.name, sortOrder: levels?.length ?? 0 });
  }

  function handleEdit(data: LevelFormValues) {
    if (!editing) return;
    updateMutation.mutate({ id: editing.id, data: { name: data.name } });
  }

  function openEdit(level: OrgUnitLevel) {
    editForm.reset({ name: level.name });
    setEditing(level);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Hierarchy Levels
            </DialogTitle>
            <DialogDescription>
              Define the levels of your org hierarchy (e.g. Company, Division, Team).
              Order matters — each level is a child of the previous.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : levels?.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No levels defined yet. Add your first level to get started.
              </div>
            ) : (
              <div className="space-y-1.5">
                {levels?.map((level, index) => (
                  <div
                    key={level.id}
                    className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground w-5 text-right">
                        {index + 1}.
                      </span>
                      <span className="text-sm font-medium text-foreground">{level.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(level)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        aria-label={`Edit ${level.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(level)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label={`Delete ${level.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => { addForm.reset({ name: '' }); setAddOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Level
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Level Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Level</DialogTitle>
            <DialogDescription>
              New level will be added at the bottom of the hierarchy.
            </DialogDescription>
          </DialogHeader>
          <Form form={addForm} onSubmit={addForm.handleSubmit(handleAdd)} className="space-y-4">
            <FormInput name="name" label="Level name" placeholder="e.g. Division" autoComplete="off" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Level Modal */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Level</DialogTitle>
            <DialogDescription>Update the level name.</DialogDescription>
          </DialogHeader>
          <Form form={editForm} onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
            <FormInput name="name" label="Level name" autoComplete="off" />
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
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete Level"
        description={`Are you sure you want to delete "${deleting?.name}"? This will fail if any org units use this level.`}
        confirmLabel="Delete"
        variant="destructive"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </>
  );
}
