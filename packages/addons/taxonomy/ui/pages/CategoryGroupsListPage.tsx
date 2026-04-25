import { useState } from 'react';
import { FolderTree, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button, Dialog, DialogContent, Skeleton } from '@packages/ui';
import { useCategoryGroupsList } from '../hooks';
import { AddCategoryGroupForm } from '../components/AddCategoryGroupForm';
import { EditCategoryGroupForm } from '../components/EditCategoryGroupForm';
import { DeleteCategoryGroupDialog } from '../components/DeleteCategoryGroupDialog';
import { CategoryTree } from '../components/CategoryTree';
import type { CategoryGroup } from '../types';

export function CategoryGroupsListPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CategoryGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<CategoryGroup | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const { data: groups, isLoading, isError, refetch } = useCategoryGroupsList();

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground">Manage category groups and their hierarchies</p>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-foreground">Categories</h1>
        </div>
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground mb-3">Something went wrong loading categories.</p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground">Manage category groups and their hierarchies</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Category Group
        </Button>
      </div>

      {(!groups || groups.length === 0) ? (
        <div className="text-center py-12 border rounded-lg bg-card">
          <FolderTree className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-sm font-medium text-foreground mb-1">No category groups yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first category group to start organizing hierarchies.</p>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Category Group
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isSelected = selectedGroupId === group.id;
            return (
              <div
                key={group.id}
                className={`rounded-lg border bg-card transition-colors ${isSelected ? 'border-primary/50' : ''}`}
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/30 rounded-t-lg transition-colors"
                  onClick={() => setSelectedGroupId(isSelected ? null : group.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{group.name}</span>
                      <span className="text-xs text-muted-foreground">{group.slug}</span>
                    </div>
                    {group.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{group.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditingGroup(group); }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      aria-label={`Edit ${group.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDeletingGroup(group); }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      aria-label={`Delete ${group.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isSelected && (
                  <div className="border-t p-4">
                    <CategoryTree groupId={group.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <AddCategoryGroupForm onClose={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingGroup} onOpenChange={(open) => !open && setEditingGroup(null)}>
        <DialogContent className="sm:max-w-md">
          {editingGroup && (
            <EditCategoryGroupForm categoryGroup={editingGroup} onClose={() => setEditingGroup(null)} />
          )}
        </DialogContent>
      </Dialog>

      <DeleteCategoryGroupDialog categoryGroup={deletingGroup} onClose={() => setDeletingGroup(null)} />
    </div>
  );
}
