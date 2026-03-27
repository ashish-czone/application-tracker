import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Badge, Button, Dialog, DialogContent, Skeleton } from '@packages/ui';
import { useTagsByGroup } from '../hooks';
import { AddTagForm } from './AddTagForm';
import { EditTagForm } from './EditTagForm';
import { DeleteTagDialog } from './DeleteTagDialog';
import type { Tag } from '../types';

interface TagsListProps {
  groupId: string;
  groupName: string;
}

export function TagsList({ groupId, groupName }: TagsListProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);

  const { data: tags, isLoading } = useTagsByGroup(groupId);

  if (isLoading) {
    return (
      <div className="flex gap-2 flex-wrap">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-14" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {tags?.map((tag) => (
          <div key={tag.id} className="group inline-flex items-center gap-1">
            <Badge
              variant="outline"
              className="gap-1.5 pr-1"
              style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
            >
              {tag.color && (
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
              )}
              {tag.name}
              <span className="inline-flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => setEditingTag(tag)}
                  className="p-0.5 rounded hover:bg-accent"
                  aria-label={`Edit ${tag.name}`}
                >
                  <Pencil className="h-2.5 w-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingTag(tag)}
                  className="p-0.5 rounded hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Delete ${tag.name}`}
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </span>
            </Badge>
          </div>
        ))}

        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add tag
        </Button>
      </div>

      {(!tags || tags.length === 0) && (
        <p className="text-xs text-muted-foreground">No tags in this group yet.</p>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <AddTagForm groupId={groupId} groupName={groupName} onClose={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTag} onOpenChange={(open) => !open && setEditingTag(null)}>
        <DialogContent className="sm:max-w-md">
          {editingTag && <EditTagForm tag={editingTag} onClose={() => setEditingTag(null)} />}
        </DialogContent>
      </Dialog>

      <DeleteTagDialog tag={deletingTag} onClose={() => setDeletingTag(null)} />
    </div>
  );
}
