import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  EmptyState,
  SearchInput,
  Skeleton,
} from '@packages/ui';
import { Plus } from 'lucide-react';
import { useProjectsDashboard } from '../../../../api/hooks';
import { ProjectCard } from './components/ProjectCard';
import { QuickCreateDialog } from './components/QuickCreateDialog';
import type { ProjectStatus } from '../../../../types';

const STATUS_FILTERS: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'planning',  label: 'Planning' },
  { value: 'active',    label: 'Active' },
  { value: 'on_hold',   label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
];

export function ProjectsDashboardPage() {
  const { data, isLoading, isError, refetch } = useProjectsDashboard();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!data) return [];
    const lower = search.trim().toLowerCase();
    return data.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (lower && !p.name.toLowerCase().includes(lower) && !p.slug.toLowerCase().includes(lower)) {
        return false;
      }
      return true;
    });
  }, [data, search, statusFilter]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All projects with rolled-up progress.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Project
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <SearchInput
          placeholder="Search projects…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={statusFilter === f.value ? 'default' : 'outline'}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState
          quote="We couldn't load your projects."
          cta={<Button onClick={() => refetch()}>Retry</Button>}
        />
      )}

      {data && filtered.length === 0 && (
        <EmptyState
          quote={
            search || statusFilter !== 'all'
              ? 'No projects match your search.'
              : 'A project is just a list of intentions waiting to ship.'
          }
          cta={
            !search && statusFilter === 'all' ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Create your first project
              </Button>
            ) : undefined
          }
        />
      )}

      {data && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} to={`/projects/${p.id}`} />
          ))}
        </div>
      )}

      <QuickCreateDialog
        entityType="projects"
        singularName="Project"
        open={createOpen}
        onOpenChange={setCreateOpen}
        navigateTo={(entity) => {
          qc.invalidateQueries({ queryKey: ['projects'] });
          return entity.id ? `/projects/${entity.id as string}` : null;
        }}
      />
    </div>
  );
}
