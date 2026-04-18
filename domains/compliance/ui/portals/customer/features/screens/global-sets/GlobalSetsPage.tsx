import { useMemo, useState } from 'react';
import { ChevronRight, Plus, Search, Layers, GitBranch } from 'lucide-react';
import { Eyebrow } from '@packages/ui';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import {
  GLOBAL_SETS,
  GLOBAL_SET_ITEMS,
  type GlobalSetDefinition,
} from './data/globalSetsMock';
import { HierarchicalRows, buildTree } from './components/HierarchicalRows';
import { FlatRows } from './components/FlatRows';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function GlobalSetsPage() {
  const [activeSlug, setActiveSlug] = useState<string>(GLOBAL_SETS[0].slug);
  const activeSet: GlobalSetDefinition | undefined = GLOBAL_SETS.find((s) => s.slug === activeSlug);
  const items = GLOBAL_SET_ITEMS[activeSlug] ?? [];
  const tree = useMemo(() => buildTree(items), [items]);

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
                {GLOBAL_SETS.length}
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-rule text-[11px] text-ink-muted">
              <Search className="w-3 h-3" strokeWidth={1.5} />
              <span className="font-sans">Filter sets</span>
            </div>
            <ul>
              {GLOBAL_SETS.map((set) => {
                const isActive = set.slug === activeSlug;
                return (
                  <li key={set.slug}>
                    <button
                      type="button"
                      onClick={() => setActiveSlug(set.slug)}
                      className={`w-full text-left px-4 py-3 border-b border-rule transition-colors ${
                        isActive ? 'bg-paper border-l-2 border-l-ink' : 'hover:bg-paper'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {set.kind === 'hierarchical' ? (
                            <GitBranch className="w-3 h-3 text-ink-muted" strokeWidth={1.5} />
                          ) : (
                            <Layers className="w-3 h-3 text-ink-muted" strokeWidth={1.5} />
                          )}
                          <span className="text-xs font-sans text-ink">{set.label}</span>
                        </div>
                        <span className="font-mono text-[10px] text-ink-muted tabular-nums">
                          {set.itemCount}
                        </span>
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
            {activeSet && (
              <>
                <header className="px-6 py-5 border-b border-rule">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="font-serif text-2xl text-ink leading-none">
                          {activeSet.label}
                        </h2>
                        <span className="font-mono text-[11px] text-ink-muted tabular-nums px-2 py-0.5 border border-rule">
                          {activeSet.slug}
                        </span>
                        <span className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
                          {activeSet.kind}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] text-ink-soft font-serif italic max-w-2xl">
                        {activeSet.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <Eyebrow>Items</Eyebrow>
                        <div className="mt-0.5 font-mono text-lg text-ink tabular-nums">
                          {activeSet.itemCount}
                        </div>
                      </div>
                      <div>
                        <Eyebrow>Fields using</Eyebrow>
                        <div className="mt-0.5 font-mono text-lg text-ink tabular-nums">
                          {activeSet.usedByFields}
                        </div>
                      </div>
                      <div>
                        <Eyebrow>Updated</Eyebrow>
                        <div className="mt-0.5 font-mono text-[11px] text-ink-soft tabular-nums">
                          {formatDate(activeSet.updatedAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                </header>

                <div className="flex items-center justify-between px-4 py-2.5 border-b border-rule">
                  <Eyebrow>{activeSet.kind === 'hierarchical' ? 'Hierarchy' : 'Items'}</Eyebrow>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-[11px] uppercase tracking-eyebrow font-sans text-ink-muted hover:text-ink transition-colors"
                  >
                    <Plus className="w-3 h-3" strokeWidth={2} />
                    Add item
                  </button>
                </div>

                <div>
                  {activeSet.kind === 'hierarchical' ? (
                    <HierarchicalRows nodes={tree} />
                  ) : (
                    <FlatRows items={items} />
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
