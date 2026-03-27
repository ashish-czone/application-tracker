import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, FolderTree } from 'lucide-react';
import { Button, Dialog, DialogContent, Skeleton } from '@packages/ui';
import { useCategoryTree } from '../hooks';
import { AddCategoryForm } from './AddCategoryForm';
import { EditCategoryForm } from './EditCategoryForm';
import { DeleteCategoryDialog } from './DeleteCategoryDialog';
import type { CategoryTreeNode, Category } from '../types';

interface CategoryTreeProps {
  groupId: string;
}

export function CategoryTree({ groupId }: CategoryTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [addingUnder, setAddingUnder] = useState<{ id?: string; name?: string } | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const { data: tree, isLoading } = useCategoryTree(groupId);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-6 w-52 ml-6" />
        <Skeleton className="h-6 w-36 ml-6" />
        <Skeleton className="h-6 w-44" />
      </div>
    );
  }

  if (!tree || tree.length === 0) {
    return (
      <div className="text-center py-8">
        <FolderTree className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-3">No categories yet.</p>
        <Button size="sm" variant="outline" onClick={() => setAddingUnder({})}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add root category
        </Button>

        <Dialog open={!!addingUnder} onOpenChange={(open) => !open && setAddingUnder(null)}>
          <DialogContent className="sm:max-w-md">
            {addingUnder && (
              <AddCategoryForm
                groupId={groupId}
                parentId={addingUnder.id}
                parentName={addingUnder.name}
                onClose={() => setAddingUnder(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setAddingUnder({})}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add root category
        </Button>
      </div>

      <div className="space-y-0.5">
        {tree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            expandedIds={expandedIds}
            onToggle={toggleExpand}
            onAddChild={(id, name) => setAddingUnder({ id, name })}
            onEdit={setEditingCategory}
            onDelete={setDeletingCategory}
          />
        ))}
      </div>

      <Dialog open={!!addingUnder} onOpenChange={(open) => !open && setAddingUnder(null)}>
        <DialogContent className="sm:max-w-md">
          {addingUnder && (
            <AddCategoryForm
              groupId={groupId}
              parentId={addingUnder.id}
              parentName={addingUnder.name}
              onClose={() => setAddingUnder(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent className="sm:max-w-md">
          {editingCategory && (
            <EditCategoryForm category={editingCategory} onClose={() => setEditingCategory(null)} />
          )}
        </DialogContent>
      </Dialog>

      <DeleteCategoryDialog category={deletingCategory} onClose={() => setDeletingCategory(null)} />
    </div>
  );
}

interface TreeNodeProps {
  node: CategoryTreeNode;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onAddChild: (id: string, name: string) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

function TreeNode({ node, expandedIds, onToggle, onAddChild, onEdit, onDelete }: TreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);

  return (
    <div>
      <div
        className="group flex items-center gap-1 py-1 px-2 rounded-md hover:bg-accent/50 transition-colors"
        style={{ paddingLeft: `${node.depth * 24 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="p-0.5 rounded hover:bg-accent"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            }
          </button>
        ) : (
          <span className="w-[18px]" />
        )}

        <span className="text-sm font-medium text-foreground flex-1">{node.name}</span>
        <span className="text-xs text-muted-foreground mr-2">{node.slug}</span>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onAddChild(node.id, node.name)}
            className="p-1 rounded hover:bg-accent"
            aria-label={`Add subcategory under ${node.name}`}
            title="Add subcategory"
          >
            <Plus className="h-3 w-3 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => onEdit(node)}
            className="p-1 rounded hover:bg-accent"
            aria-label={`Edit ${node.name}`}
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(node)}
            className="p-1 rounded hover:bg-destructive/10"
            aria-label={`Delete ${node.name}`}
          >
            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
