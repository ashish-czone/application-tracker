import { useMemo, useState } from 'react';
import { Tags, Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  DataGrid, Badge, Button, useDataGridParams,
  Dialog, DialogContent,
  type ColumnDef,
} from '@packages/ui';
import { useTagGroupsList } from '../hooks';
import { AddTagGroupForm } from '../components/AddTagGroupForm';
import { EditTagGroupForm } from '../components/EditTagGroupForm';
import { DeleteTagGroupDialog } from '../components/DeleteTagGroupDialog';
import { TagsList } from '../components/TagsList';
import type { TagGroup } from '../types';

export function TagGroupsListPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TagGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<TagGroup | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<TagGroup | null>(null);

  const {
    page,
    pageSize,
    search,
    sort,
    order,
    setPage,
    setPageSize,
    setSearch,
    setSort,
  } = useDataGridParams({ defaultSort: 'createdAt', defaultOrder: 'desc' });

  const { data, isLoading, isError, refetch } = useTagGroupsList({
    page,
    limit: pageSize,
    search: search || undefined,
    sort: sort as 'name' | 'createdAt' | undefined,
    order,
  });

  const columns = useMemo<ColumnDef<TagGroup, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setSelectedGroup(row.original)}
            className="text-left"
          >
            <span className="font-medium text-foreground hover:text-primary transition-colors">
              {row.original.name}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">{row.original.slug}</span>
          </button>
        ),
        enableSorting: true,
      },
      {
        id: 'allowMultiple',
        header: 'Multi-select',
        accessorKey: 'allowMultiple',
        cell: ({ getValue }) => (
          <Badge variant={getValue() ? 'default' : 'secondary'}>
            {getValue() ? 'Yes' : 'No'}
          </Badge>
        ),
        enableSorting: false,
        enableHiding: true,
      },
      {
        id: 'description',
        header: 'Description',
        accessorKey: 'description',
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
            {(getValue() as string) || '—'}
          </span>
        ),
        enableSorting: false,
        enableHiding: true,
      },
      {
        id: 'createdAt',
        header: 'Created',
        accessorKey: 'createdAt',
        cell: ({ getValue }) => format(new Date(getValue() as string), 'MMM d, yyyy'),
        enableSorting: true,
        enableHiding: true,
      },
      {
        id: 'actions',
        header: '',
        size: 80,
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1 justify-end">
            <button
              type="button"
              onClick={() => setEditingGroup(row.original)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label={`Edit ${row.original.name}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeletingGroup(row.original)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label={`Delete ${row.original.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Tag Groups</h1>
        <p className="text-sm text-muted-foreground">Manage tag groups and their tags</p>
      </div>

      <div className="space-y-4">
        <DataGrid
          columns={columns}
          data={data?.data ?? []}
          page={page}
          pageSize={pageSize}
          pageCount={data?.meta.totalPages ?? 0}
          totalRows={data?.meta.total ?? 0}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          sortColumn={sort}
          sortDirection={order}
          onSortChange={setSort}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search tag groups..."
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
          emptyState={{
            icon: Tags,
            title: 'No tag groups yet',
            description: 'Create your first tag group to start organizing tags.',
            action: { label: 'Add Tag Group', onClick: () => setAddOpen(true) },
          }}
          storageKey="tag-groups-list"
          rowClassName={(row) =>
            selectedGroup?.id === row.id ? 'bg-accent/50' : undefined
          }
          toolbarActions={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Tag Group
            </Button>
          }
          renderCard={(tagGroup) => (
            <div
              className="rounded-lg border bg-card p-4 space-y-3 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedGroup(tagGroup)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-foreground">{tagGroup.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{tagGroup.slug}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditingGroup(tagGroup); }}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDeletingGroup(tagGroup); }}
                    className="p-1 text-muted-foreground hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {tagGroup.description && (
                <p className="text-sm text-muted-foreground">{tagGroup.description}</p>
              )}
              <Badge variant={tagGroup.allowMultiple ? 'default' : 'secondary'}>
                {tagGroup.allowMultiple ? 'Multi-select' : 'Single-select'}
              </Badge>
            </div>
          )}
        />

        {selectedGroup && (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Tags in "{selectedGroup.name}"
                </h2>
                <p className="text-xs text-muted-foreground">
                  {selectedGroup.allowMultiple ? 'Multiple tags can be selected' : 'Only one tag can be selected'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGroup(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            <TagsList groupId={selectedGroup.id} groupName={selectedGroup.name} />
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <AddTagGroupForm onClose={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingGroup} onOpenChange={(open) => !open && setEditingGroup(null)}>
        <DialogContent className="sm:max-w-md">
          {editingGroup && (
            <EditTagGroupForm tagGroup={editingGroup} onClose={() => setEditingGroup(null)} />
          )}
        </DialogContent>
      </Dialog>

      <DeleteTagGroupDialog tagGroup={deletingGroup} onClose={() => setDeletingGroup(null)} />
    </div>
  );
}
