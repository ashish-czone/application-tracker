import { useMemo, useState } from 'react';
import { ChevronRight, Plus, Search, Layers, GitBranch } from 'lucide-react';
import { Eyebrow } from '@packages/ui';
import {
  useCategoryGroupsList,
  useCategoryTree,
  type CategoryGroup,
  type CategoryTreeNode,
} from '@packages/taxonomy-ui';
import { useCategoryGroupUsage } from '@packages/entity-engine-ui';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import { HierarchicalRows, type TreeNode } from './components/HierarchicalRows';
import { FlatRows, type FlatRowItem } from './components/FlatRows';
import { AddItemDialog } from './components/AddItemDialog';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function hasAnyChildren(nodes: CategoryTreeNode[]): boolean {
  return nodes.some((n) => n.children.length > 0);
}

function toTreeNodes(nodes: CategoryTreeNode[]): TreeNode[] {
  return nodes.map((n) => ({
    id: n.id,
    slug: n.slug,
    name: n.name,
    children: toTreeNodes(n.children),
  }));
}

function flattenTree(nodes: CategoryTreeNode[]): FlatRowItem[] {
  const out: FlatRowItem[] = [];
  const walk = (ns: CategoryTreeNode[]) => {
    for (const n of ns) {
      out.push({ id: n.id, slug: n.slug, name: n.name, metadata: n.metadata });
      if (n.children.length > 0) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

function countAll(nodes: CategoryTreeNode[]): number {
  let total = 0;
  const walk = (ns: CategoryTreeNode[]) => {
    for (const n of ns) {
      total += 1;
      walk(n.children);
    }
  };
  walk(nodes);
  return total;
}

function maxUpdatedAt(nodes: CategoryTreeNode[], fallback: string): string {
  let max = fallback;
  const walk = (ns: CategoryTreeNode[]) => {
    for (const n of ns) {
      if (n.updatedAt > max) max = n.updatedAt;
      walk(n.children);
    }
  };
  walk(nodes);
  return max;
}

export function GlobalSetsPage() {
  const groupsQuery = useCategoryGroupsList();
  const groups = (groupsQuery.data ?? []) as CategoryGroup[];

  const usageQuery = useCategoryGroupUsage();
  const usage = usageQuery.data ?? {};

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeGroup = groups.find((g) => g.id === activeId) ?? groups[0] ?? null;
  const activeGroupId = activeGroup?.id ?? null;
  const [addItemOpen, setAddItemOpen] = useState(false);

  const treeQuery = useCategoryTree(activeGroupId);
  const tree = (treeQuery.data ?? []) as CategoryTreeNode[];

  const isHierarchical = hasAnyChildren(tree);
  const flatItems = useMemo(() => flattenTree(tree), [tree]);
  const treeNodes = useMemo(() => toTreeNodes(tree), [tree]);
  const itemCount = countAll(tree);
  const updatedAt = activeGroup ? maxUpdatedAt(tree, activeGroup.updatedAt) : '';
  const usedByFields = activeGroup ? usage[activeGroup.slug] ?? 0 : 0;

  return (
    <div className="min-h-screen bg-paper paper-grain">
      <ScreenPreviewTopBar active="global-sets" />

      <main className="max-w-[1480px] mx-auto px-10 py-8">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-3">
          <span>Settings</span>
          <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
          <span className="text-ink">Global Sets</span>
        </div>
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-serif text-[44px] leading-[1.05] text-ink tracking-tight">
              Global Sets
            </h1>
            <p className="mt-2 text-[13px] text-ink-soft font-serif italic max-w-2xl">
              Reference lists shared across the platform. Fields bind to a set by slug, so values
              stay consistent without duplication.
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-2 bg-ink text-paper-raised text-[11px] uppercase tracking-eyebrow font-sans font-medium hover:bg-ink/90 transition-colors"
          >
            <Plus className="w-3 h-3" strokeWidth={2} />
            New set
          </button>
        </div>

        <div className="grid grid-cols-[320px_1fr] gap-6">
          <aside className="border border-rule bg-paper-raised">
            <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
              <Eyebrow>Sets</Eyebrow>
              <span className="font-mono text-[10px] text-ink-muted tabular-nums">
                {groups.length}
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-rule text-[11px] text-ink-muted">
              <Search className="w-3 h-3" strokeWidth={1.5} />
              <span className="font-sans">Filter sets</span>
            </div>
            <ul>
              {groupsQuery.isLoading && (
                <li className="px-4 py-3 text-[11px] text-ink-muted font-sans">Loading…</li>
              )}
              {!groupsQuery.isLoading && groups.length === 0 && (
                <li className="px-4 py-3 text-[11px] text-ink-muted font-sans">No sets yet</li>
              )}
              {groups.map((set) => {
                const isActive = set.id === activeGroupId;
                const showHierarchical = isActive && isHierarchical;
                return (
                  <li key={set.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(set.id)}
                      className={`w-full text-left px-4 py-3 border-b border-rule transition-colors ${
                        isActive ? 'bg-paper border-l-2 border-l-ink' : 'hover:bg-paper'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {showHierarchical ? (
                            <GitBranch className="w-3 h-3 text-ink-muted" strokeWidth={1.5} />
                          ) : (
                            <Layers className="w-3 h-3 text-ink-muted" strokeWidth={1.5} />
                          )}
                          <span className="text-xs font-sans text-ink">{set.name}</span>
                        </div>
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-ink-muted tabular-nums">
                        {set.slug}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="border border-rule bg-paper-raised">
            {activeGroup && (
              <>
                <header className="px-6 py-5 border-b border-rule">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="font-serif text-2xl text-ink leading-none">
                          {activeGroup.name}
                        </h2>
                        <span className="font-mono text-[11px] text-ink-muted tabular-nums px-2 py-0.5 border border-rule">
                          {activeGroup.slug}
                        </span>
                        <span className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                          {isHierarchical ? 'hierarchical' : 'flat'}
                        </span>
                      </div>
                      {activeGroup.description && (
                        <p className="mt-2 text-[12px] text-ink-soft font-serif italic max-w-2xl">
                          {activeGroup.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <Eyebrow>Items</Eyebrow>
                        <div className="mt-0.5 font-mono text-lg text-ink tabular-nums">
                          {itemCount}
                        </div>
                      </div>
                      <div>
                        <Eyebrow>Used by</Eyebrow>
                        <div className="mt-0.5 font-mono text-lg text-ink tabular-nums">
                          {usedByFields}
                          <span className="ml-1 text-[10px] text-ink-muted font-sans">
                            field{usedByFields === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <Eyebrow>Updated</Eyebrow>
                        <div className="mt-0.5 font-mono text-[11px] text-ink-soft tabular-nums">
                          {updatedAt ? formatDate(updatedAt) : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                </header>

                <div className="flex items-center justify-between px-4 py-2.5 border-b border-rule">
                  <Eyebrow>{isHierarchical ? 'Hierarchy' : 'Items'}</Eyebrow>
                  <button
                    type="button"
                    onClick={() => setAddItemOpen(true)}
                    className="flex items-center gap-1.5 text-[11px] uppercase tracking-eyebrow font-sans text-ink-muted hover:text-ink transition-colors"
                  >
                    <Plus className="w-3 h-3" strokeWidth={2} />
                    Add item
                  </button>
                </div>

                <div>
                  {treeQuery.isLoading && (
                    <div className="px-4 py-6 text-[11px] text-ink-muted font-sans">Loading…</div>
                  )}
                  {!treeQuery.isLoading && tree.length === 0 && (
                    <div className="px-4 py-6 text-[11px] text-ink-muted font-sans">
                      No items in this set yet.
                    </div>
                  )}
                  {!treeQuery.isLoading && tree.length > 0 && (
                    isHierarchical ? (
                      <HierarchicalRows nodes={treeNodes} />
                    ) : (
                      <FlatRows items={flatItems} />
                    )
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {addItemOpen && activeGroup && (
        <AddItemDialog
          group={activeGroup}
          tree={tree}
          isHierarchical={isHierarchical}
          onClose={() => setAddItemOpen(false)}
        />
      )}
    </div>
  );
}
