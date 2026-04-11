import { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Plus, ChevronRight, ChevronDown, Users, Settings, Pencil, Trash2 } from 'lucide-react';
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
import { useOrgUnits, useOrgUnitLevels, useCreateOrgUnit, useUpdateOrgUnit, useDeleteOrgUnit } from '../hooks';
import { MembersDialog } from '../components/MembersDialog';
import { LevelsSettingsDialog } from '../components/LevelsSettingsDialog';
import { buildTree, type WithChildren } from '../helpers/build-tree';
import type { OrgUnit, OrgUnitLevel } from '../types';

const unitSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
});

type UnitFormValues = z.infer<typeof unitSchema>;

export function OrgUnitsPage() {
  const { data: units, isLoading: unitsLoading } = useOrgUnits();
  const { data: levels, isLoading: levelsLoading } = useOrgUnitLevels();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [addLevelId, setAddLevelId] = useState<string | null>(null);
  const [editing, setEditing] = useState<OrgUnit | null>(null);
  const [deleting, setDeleting] = useState<OrgUnit | null>(null);
  const [membersUnit, setMembersUnit] = useState<OrgUnit | null>(null);
  const [levelsOpen, setLevelsOpen] = useState(false);

  const createMutation = useCreateOrgUnit({ onSuccess: () => setAddOpen(false) });
  const updateMutation = useUpdateOrgUnit({ onSuccess: () => setEditing(null) });
  const deleteMutation = useDeleteOrgUnit({ onSuccess: () => setDeleting(null) });

  const addForm = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: { name: '' },
  });

  const editForm = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
  });

  const tree = useMemo(() => (units ? buildTree(units) : []), [units]);

  const allExpandableIds = useMemo(() => {
    const ids: string[] = [];
    function collect(nodes: WithChildren<OrgUnit>[]) {
      for (const n of nodes) {
        if (n.children.length > 0) { ids.push(n.id); collect(n.children); }
      }
    }
    collect(tree);
    return ids;
  }, [tree]);

  const isAllExpanded = allExpandableIds.length > 0 && expanded.size >= allExpandableIds.length;
  const expandAll = useCallback(() => setExpanded(new Set(allExpandableIds)), [allExpandableIds]);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  const sortedLevels = useMemo(
    () => (levels ? [...levels].sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [levels],
  );

  const levelById = useMemo(
    () => new Map(sortedLevels.map((l) => [l.id, l])),
    [sortedLevels],
  );

  const getNextLevel = useCallback(
    (currentLevelId: string): OrgUnitLevel | undefined => {
      const currentIdx = sortedLevels.findIndex((l) => l.id === currentLevelId);
      if (currentIdx === -1 || currentIdx >= sortedLevels.length - 1) return undefined;
      return sortedLevels[currentIdx + 1];
    },
    [sortedLevels],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  function openAddChild(parentId: string | null, levelId: string) {
    addForm.reset({ name: '' });
    setAddParentId(parentId);
    setAddLevelId(levelId);
    setAddOpen(true);
  }

  function openAddRoot() {
    if (sortedLevels.length === 0) return;
    openAddChild(null, sortedLevels[0].id);
  }

  function handleAdd(data: UnitFormValues) {
    if (!addLevelId) return;
    createMutation.mutate({
      name: data.name,
      levelId: addLevelId,
      parentId: addParentId ?? undefined,
    });
  }

  function openEdit(unit: OrgUnit) {
    editForm.reset({ name: unit.name });
    setEditing(unit);
  }

  function handleEdit(data: UnitFormValues) {
    if (!editing) return;
    updateMutation.mutate({ id: editing.id, data: { name: data.name } });
  }

  const isLoading = unitsLoading || levelsLoading;
  const addLevelName = addLevelId ? levelById.get(addLevelId)?.name ?? 'Unit' : 'Unit';

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const hasNoLevels = sortedLevels.length === 0;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Organisation Structure</h1>
          <p className="text-sm text-muted-foreground">
            Manage your organisational hierarchy and team members
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLevelsOpen(true)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Level settings"
            title="Manage hierarchy levels"
          >
            <Settings className="h-4 w-4" />
          </button>
          {!hasNoLevels && (
            <Button size="sm" onClick={openAddRoot}>
              <Plus className="h-4 w-4 mr-1" />
              Add {sortedLevels[0]?.name ?? 'Unit'}
            </Button>
          )}
        </div>
      </div>

      {hasNoLevels ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <h3 className="text-sm font-medium text-foreground">No hierarchy levels configured</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Define levels like "Company", "Division", "Team" to start building your org structure.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setLevelsOpen(true)}>
            <Settings className="h-4 w-4 mr-1" />
            Configure Levels
          </Button>
        </div>
      ) : tree.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <h3 className="text-sm font-medium text-foreground">No org units yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first {sortedLevels[0]?.name?.toLowerCase() ?? 'unit'} to get started.
          </p>
          <Button size="sm" className="mt-4" onClick={openAddRoot}>
            <Plus className="h-4 w-4 mr-1" />
            Add {sortedLevels[0]?.name ?? 'Unit'}
          </Button>
        </div>
      ) : (
        <div>
          {allExpandableIds.length > 0 && (
            <div className="flex items-center gap-2 mb-2 text-xs">
              <button
                type="button"
                onClick={expandAll}
                disabled={isAllExpanded}
                className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-default"
              >
                Expand All
              </button>
              <span className="text-muted-foreground/50">|</span>
              <button
                type="button"
                onClick={collapseAll}
                disabled={expanded.size === 0}
                className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-default"
              >
                Collapse All
              </button>
            </div>
          )}
          <div className="space-y-0.5">
          {tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              toggleExpand={toggleExpand}
              getNextLevel={getNextLevel}
              onAddChild={openAddChild}
              onEdit={openEdit}
              onDelete={setDeleting}
              onManageMembers={setMembersUnit}
            />
          ))}
          </div>
        </div>
      )}

      {/* Add Unit Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add {addLevelName}</DialogTitle>
            <DialogDescription>
              Create a new {addLevelName.toLowerCase()} in your organisation structure.
            </DialogDescription>
          </DialogHeader>
          <Form form={addForm} onSubmit={addForm.handleSubmit(handleAdd)} className="space-y-4">
            <FormInput name="name" label={`${addLevelName} name`} placeholder={`e.g. ${addLevelName} name`} autoComplete="off" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Unit Modal */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Unit</DialogTitle>
            <DialogDescription>Update the unit name.</DialogDescription>
          </DialogHeader>
          <Form form={editForm} onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
            <FormInput name="name" label="Unit name" autoComplete="off" />
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
        title="Delete Unit"
        description={`Are you sure you want to delete "${deleting?.name}"? This will also remove all its members. This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />

      {/* Members Dialog */}
      <MembersDialog
        unit={membersUnit}
        onClose={() => setMembersUnit(null)}
      />

      {/* Levels Settings Dialog */}
      <LevelsSettingsDialog
        open={levelsOpen}
        onClose={() => setLevelsOpen(false)}
      />
    </div>
  );
}

// ── Tree Node Component ──────────────────────────────────────

interface TreeNodeProps {
  node: WithChildren<OrgUnit>;
  depth: number;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  getNextLevel: (currentLevelId: string) => OrgUnitLevel | undefined;
  onAddChild: (parentId: string, levelId: string) => void;
  onEdit: (unit: OrgUnit) => void;
  onDelete: (unit: OrgUnit) => void;
  onManageMembers: (unit: OrgUnit) => void;
}

function TreeNode({
  node,
  depth,
  expanded,
  toggleExpand,
  getNextLevel,
  onAddChild,
  onEdit,
  onDelete,
  onManageMembers,
}: TreeNodeProps) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const nextLevel = getNextLevel(node.levelId);

  return (
    <>
      <div
        className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5 hover:bg-accent/50 transition-colors"
        style={{ marginLeft: depth * 24 }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Expand/collapse toggle */}
          <button
            type="button"
            onClick={() => toggleExpand(node.id)}
            className={`p-0.5 rounded transition-colors ${hasChildren ? 'text-muted-foreground hover:text-foreground' : 'text-transparent cursor-default'}`}
            disabled={!hasChildren}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          {/* Level badge */}
          <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
            {node.level.name}
          </span>

          {/* Unit name */}
          <span className="text-sm font-medium text-foreground truncate">
            {node.name}
          </span>

          {/* Member previews */}
          {node.memberPreviews.length > 0 && (
            <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <span className="font-medium">
                {node.memberPreviews[0].positionName ? `${node.memberPreviews[0].positionName}: ` : ''}
                {node.memberPreviews[0].userName}
              </span>
              {node.memberPreviews.length > 1 && (
                <>
                  <span className="text-muted-foreground/60 mx-0.5">&middot;</span>
                  {node.memberPreviews.slice(1).map((m) => m.userName).join(', ')}
                </>
              )}
              {node.memberCount > node.memberPreviews.length && (
                <>
                  <span className="text-muted-foreground/60 mx-0.5">&middot;</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onManageMembers(node); }}
                    className="text-primary hover:underline font-medium"
                  >
                    +{node.memberCount - node.memberPreviews.length} more
                  </button>
                </>
              )}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {nextLevel && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onAddChild(node.id, nextLevel.id)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add {nextLevel.name}
            </Button>
          )}
          <button
            type="button"
            onClick={() => onManageMembers(node)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            aria-label={`Manage members of ${node.name}`}
            title="Manage members"
          >
            <Users className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onEdit(node)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label={`Edit ${node.name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(node)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label={`Delete ${node.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Children */}
      {isExpanded && node.children.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          toggleExpand={toggleExpand}
          getNextLevel={getNextLevel}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
          onManageMembers={onManageMembers}
        />
      ))}
    </>
  );
}
