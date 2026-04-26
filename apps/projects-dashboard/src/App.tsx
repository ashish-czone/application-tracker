import { useMemo, useState } from 'react';
import { FolderKanban } from 'lucide-react';
import type { Project } from './types';
import { computeStats } from './types';
import { TaskTree } from './TaskTree';

const projectModules = import.meta.glob<{ default: Project }>(
  '../../../.projects/*.json',
  { eager: true },
);

const projects: Project[] = Object.values(projectModules)
  .map((m) => m.default)
  .sort((a, b) => a.name.localeCompare(b.name));

const PROJECT_STATUS_STYLES: Record<Project['status'], string> = {
  planning: 'bg-muted text-muted-foreground',
  active: 'bg-authority-soft text-authority',
  paused: 'bg-due-soon-soft text-due-soon',
  done: 'bg-filed-soft text-filed',
};

export function App() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    projects[0]?.slug ?? null,
  );

  const selected = useMemo(
    () => projects.find((p) => p.slug === selectedSlug) ?? null,
    [selectedSlug],
  );

  return (
    <div className="flex h-screen bg-background text-foreground font-sans">
      <aside className="w-72 flex-shrink-0 border-r border-rule bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border">
          <FolderKanban className="h-5 w-5 text-authority" />
          <span className="font-display text-lg font-semibold">Projects</span>
        </div>
        <nav className="p-2 space-y-1">
          {projects.length === 0 && (
            <div className="px-3 py-6 text-xs text-sidebar-muted">
              No projects found in <code className="font-mono">.projects/</code>
            </div>
          )}
          {projects.map((p) => {
            const stats = computeStats(p);
            const isSelected = p.slug === selectedSlug;
            return (
              <button
                key={p.slug}
                onClick={() => setSelectedSlug(p.slug)}
                className={`w-full text-left rounded-md px-3 py-2.5 transition-colors ${
                  isSelected
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'hover:bg-sidebar-accent/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-eyebrow ${PROJECT_STATUS_STYLES[p.status]}`}
                  >
                    {p.status}
                  </span>
                </div>
                <div className="mt-1.5 text-xs text-sidebar-muted">{p.client}</div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-sidebar-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-filed transition-all"
                      style={{ width: `${stats.pctDone}%` }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-sidebar-muted">
                    {stats.done}/{stats.total}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {selected ? <ProjectView project={selected} /> : <EmptyState />}
      </main>
    </div>
  );
}

function ProjectView({ project }: { project: Project }) {
  const stats = computeStats(project);
  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <header className="border-b border-rule pb-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-eyebrow ${PROJECT_STATUS_STYLES[project.status]}`}
          >
            {project.status}
          </span>
          <span className="text-xs text-ink-muted">{project.client}</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-ink">{project.name}</h1>
        {project.description && (
          <p className="mt-2 text-sm text-ink-soft">{project.description}</p>
        )}

        <div className="mt-5 grid grid-cols-4 gap-3 max-w-xl">
          <Stat label="Done" value={stats.done} className="text-filed" />
          <Stat label="In progress" value={stats.inProgress} className="text-authority" />
          <Stat label="To do" value={stats.todo} className="text-muted-foreground" />
          <Stat label="Blocked" value={stats.blocked} className="text-destructive" />
        </div>
        <div className="mt-3 flex items-center gap-3 max-w-xl">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-filed transition-all"
              style={{ width: `${stats.pctDone}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-ink-muted">{stats.pctDone}%</span>
        </div>
      </header>

      <TaskTree tasks={project.tasks} />
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div>
      <div className={`font-display text-2xl font-bold tabular-nums ${className ?? ''}`}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted">{label}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      <div className="text-center">
        <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Pick a project from the sidebar</p>
      </div>
    </div>
  );
}
