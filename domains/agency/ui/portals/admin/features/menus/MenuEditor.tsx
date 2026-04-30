import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  Sortable,
  SortableItem,
  SortableHandle,
} from '@packages/ui';
import { ChevronLeft, ChevronRight, ExternalLink, FileText, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  useCreateMenuItem,
  useDeleteMenuItem,
  useMenu,
  useMenuItems,
  useMoveMenuItem,
  useUpdateMenuItem,
} from './hooks';
import { MenuItemDialog, type MenuItemDialogValue } from './MenuItemDialog';
import { buildMenuItemTree, computeSortOrderForIndex, type MenuItemNode } from './tree';
import type { MenuItemRecord } from './types';

export interface MenuEditorProps {
  menuId: string;
  onBack?: () => void;
}

export function MenuEditor({ menuId, onBack }: MenuEditorProps) {
  const menuQuery = useMenu(menuId);
  const itemsQuery = useMenuItems(menuId);
  const createItem = useCreateMenuItem(menuId);
  const updateItem = useUpdateMenuItem(menuId);
  const deleteItem = useDeleteMenuItem(menuId);
  const moveItem = useMoveMenuItem(menuId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemRecord | null>(null);

  const tree = useMemo(
    () => buildMenuItemTree(itemsQuery.data?.data ?? []),
    [itemsQuery.data?.data],
  );

  const allItems = itemsQuery.data?.data ?? [];

  const openCreate = () => { setEditingItem(null); setDialogOpen(true); };
  const openEdit = (item: MenuItemRecord) => { setEditingItem(item); setDialogOpen(true); };

  const handleSubmit = async (value: MenuItemDialogValue) => {
    if (editingItem) {
      await updateItem.mutateAsync({ id: editingItem.id, input: value });
    } else {
      await createItem.mutateAsync({
        menuId,
        label: value.label,
        description: value.description,
        icon: value.icon,
        linkType: value.linkType,
        url: value.url,
        pageId: value.pageId,
        target: value.target,
        parentId: null,
      });
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this menu item?')) return;
    await deleteItem.mutateAsync(id);
  };

  /** Reorder siblings within the same parent. */
  const reorderSiblings = async (newSiblings: MenuItemNode[]) => {
    const prev = newSiblings.length > 1 ? newSiblings : [];
    for (let i = 0; i < newSiblings.length; i++) {
      const item = newSiblings[i];
      const originalIndex = prev.findIndex((p) => p.id === item.id);
      if (originalIndex === i) continue;
      const sortOrder = computeSortOrderForIndex(
        newSiblings.map((n) => ({ id: n.id, sortOrder: n.sortOrder })),
        i,
        item.id,
      );
      if (sortOrder !== item.sortOrder) {
        await moveItem.mutateAsync({ id: item.id, input: { sortOrder } });
      }
    }
  };

  /** Promote a child to a sibling of its parent (depth -1). */
  const outdent = async (item: MenuItemRecord) => {
    if (!item.parentId) return;
    const parent = allItems.find((i) => i.id === item.parentId);
    await moveItem.mutateAsync({ id: item.id, input: { parentId: parent?.parentId ?? null } });
  };

  /** Nest under the preceding sibling (depth +1, capped at 1 client-side). */
  const indent = async (item: MenuItemRecord, siblingList: MenuItemNode[]) => {
    if (item.depth >= 1) return;
    const idx = siblingList.findIndex((n) => n.id === item.id);
    if (idx <= 0) return;
    const newParent = siblingList[idx - 1];
    if (newParent.depth >= 1) return;
    await moveItem.mutateAsync({ id: item.id, input: { parentId: newParent.id } });
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        )}
        <h1 className="text-2xl font-semibold">
          {menuQuery.data?.name ?? 'Menu'}
        </h1>
        {menuQuery.data?.slug && (
          <code className="text-sm text-muted-foreground">/{menuQuery.data.slug}</code>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Menu items</CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Add item
          </Button>
        </CardHeader>
        <CardContent>
          {itemsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : tree.length === 0 ? (
            <EmptyState
              eyebrow="No menu items"
              quote="Add your first menu item to get started."
              cta={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Add item</Button>}
            />
          ) : (
            <MenuItemTree
              roots={tree}
              onReorder={reorderSiblings}
              onEdit={openEdit}
              onDelete={handleDelete}
              onIndent={indent}
              onOutdent={outdent}
            />
          )}
        </CardContent>
      </Card>

      <MenuItemDialog
        open={dialogOpen}
        mode={editingItem ? 'edit' : 'create'}
        initial={editingItem ?? undefined}
        onCancel={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        submitting={createItem.isPending || updateItem.isPending}
      />
    </div>
  );
}

interface MenuItemTreeProps {
  roots: MenuItemNode[];
  onReorder: (newSiblings: MenuItemNode[]) => void;
  onEdit: (item: MenuItemRecord) => void;
  onDelete: (id: string) => void;
  onIndent: (item: MenuItemRecord, siblings: MenuItemNode[]) => void;
  onOutdent: (item: MenuItemRecord) => void;
}

function MenuItemTree(props: MenuItemTreeProps) {
  return (
    <div className="space-y-1">
      <Sortable items={props.roots} onReorder={props.onReorder} strategy="vertical">
        {props.roots.map((node, idx) => (
          <SortableItem key={node.id} id={node.id} withHandle>
            <MenuItemRow
              node={node}
              siblings={props.roots}
              index={idx}
              onEdit={props.onEdit}
              onDelete={props.onDelete}
              onIndent={(item) => props.onIndent(item, props.roots)}
              onOutdent={props.onOutdent}
            />
            {node.children.length > 0 && (
              <div className="ml-8 mt-1 space-y-1">
                <Sortable
                  items={node.children}
                  onReorder={props.onReorder}
                  strategy="vertical"
                >
                  {node.children.map((child, cidx) => (
                    <SortableItem key={child.id} id={child.id} withHandle>
                      <MenuItemRow
                        node={child}
                        siblings={node.children}
                        index={cidx}
                        onEdit={props.onEdit}
                        onDelete={props.onDelete}
                        onIndent={(item) => props.onIndent(item, node.children)}
                        onOutdent={props.onOutdent}
                      />
                    </SortableItem>
                  ))}
                </Sortable>
              </div>
            )}
          </SortableItem>
        ))}
      </Sortable>
    </div>
  );
}

interface MenuItemRowProps {
  node: MenuItemNode;
  siblings: MenuItemNode[];
  index: number;
  onEdit: (item: MenuItemRecord) => void;
  onDelete: (id: string) => void;
  onIndent: (item: MenuItemRecord) => void;
  onOutdent: (item: MenuItemRecord) => void;
}

function MenuItemRow({ node, siblings, index, onEdit, onDelete, onIndent, onOutdent }: MenuItemRowProps) {
  const canIndent = node.depth < 1 && index > 0 && siblings[index - 1].depth < 1;
  const canOutdent = !!node.parentId;

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
      <SortableHandle className="text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </SortableHandle>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {node.linkType === 'page' ? (
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="truncate font-medium">{node.label}</span>
        <span className="truncate text-xs text-muted-foreground">
          {node.linkType === 'url' ? node.url : `page: ${node.pageId ?? ''}`}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onOutdent(node)}
        disabled={!canOutdent}
        title="Promote"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onIndent(node)}
        disabled={!canIndent}
        title="Nest under previous"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onEdit(node)} title="Edit">
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onDelete(node.id)} title="Delete">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
