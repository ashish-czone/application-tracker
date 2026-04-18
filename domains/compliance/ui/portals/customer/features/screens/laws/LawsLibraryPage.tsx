import { useMemo, useState } from 'react';
import { Search, Plus, BookOpen, FileText } from 'lucide-react';
import { Eyebrow } from '@packages/ui';
import { JurisdictionTag } from '../../../../../components';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import { LAWS, type LawNode, type LawJurisdiction } from './data/lawsMock';
import { LawTreeRow, countAll } from './components/LawTreeRow';

function formatDate(iso?: string): string {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const JURISDICTION_COUNTS: Record<LawJurisdiction, number> = LAWS.reduce(
  (acc, l) => {
    acc[l.jurisdiction] = (acc[l.jurisdiction] ?? 0) + 1;
    return acc;
  },
  { central: 0, state: 0, municipal: 0 } as Record<LawJurisdiction, number>,
);

export function LawsLibraryPage() {
  const [activeId, setActiveId] = useState<string>(LAWS[0].id);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([LAWS[0].id]));

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const flat = useMemo(() => {
    const out: LawNode[] = [];
    const walk = (nodes: LawNode[]) => {
      nodes.forEach((n) => {
        out.push(n);
        if (n.children) walk(n.children);
      });
    };
    walk(LAWS);
    return out;
  }, []);

  const activeNode = flat.find((n) => n.id === activeId) ?? LAWS[0];

  return (
    <div className="min-h-screen bg-paper paper-grain">
      <ScreenPreviewTopBar active="laws" />

      <main className="max-w-[1480px] mx-auto px-10 py-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-serif text-[44px] leading-[1.05] text-ink tracking-tight">Laws</h1>
            <p className="mt-2 text-[13px] text-ink-soft font-serif italic max-w-2xl">
              The legislative text your obligations derive from. Browse Acts, chapters and sections;
              drill into a section to see which obligations it generates.
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-2 bg-ink text-paper-raised text-[11px] uppercase tracking-eyebrow font-sans font-medium hover:bg-ink/90 transition-colors"
          >
            <Plus className="w-3 h-3" strokeWidth={2} />
            New law
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="border border-rule bg-paper-raised px-4 py-3">
            <Eyebrow>Acts</Eyebrow>
            <div className="mt-1 font-mono text-2xl text-ink tabular-nums">{LAWS.length}</div>
          </div>
          <div className="border border-rule bg-paper-raised px-4 py-3">
            <Eyebrow>Central</Eyebrow>
            <div className="mt-1 font-mono text-2xl text-ink tabular-nums">
              {JURISDICTION_COUNTS.central}
            </div>
          </div>
          <div className="border border-rule bg-paper-raised px-4 py-3">
            <Eyebrow>State</Eyebrow>
            <div className="mt-1 font-mono text-2xl text-ink tabular-nums">
              {JURISDICTION_COUNTS.state}
            </div>
          </div>
          <div className="border border-rule bg-paper-raised px-4 py-3">
            <Eyebrow>Municipal</Eyebrow>
            <div className="mt-1 font-mono text-2xl text-ink tabular-nums">
              {JURISDICTION_COUNTS.municipal}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6">
          <section className="border border-rule bg-paper-raised">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-rule text-[11px] text-ink-muted">
              <Search className="w-3 h-3" strokeWidth={1.5} />
              <span className="font-sans">Search citations, titles</span>
            </div>
            <div>
              {LAWS.map((node) => (
                <LawTreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  activeId={activeId}
                  expanded={expanded}
                  onToggle={toggleExpand}
                  onSelect={(n) => setActiveId(n.id)}
                />
              ))}
            </div>
          </section>

          <aside className="border border-rule bg-paper-raised h-fit sticky top-6">
            <header className="px-5 py-4 border-b border-rule">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
                <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                  {activeNode.citation}
                </span>
              </div>
              <h2 className="font-serif text-xl text-ink leading-tight">{activeNode.title}</h2>
              <div className="mt-3 flex items-center gap-3">
                <JurisdictionTag jurisdiction={activeNode.jurisdiction} />
                <span className="text-[11px] text-ink-muted font-sans">
                  Effective {formatDate(activeNode.effectiveFrom)}
                </span>
              </div>
            </header>
            <div className="px-5 py-4 border-b border-rule">
              <Eyebrow>Obligations</Eyebrow>
              <div className="mt-1 flex items-end gap-2">
                <span className="font-mono text-2xl text-ink tabular-nums">
                  {countAll(activeNode)}
                </span>
                <span className="text-[11px] text-ink-muted font-sans pb-1">
                  total, incl. children
                </span>
              </div>
            </div>
            <div className="px-5 py-4">
              <Eyebrow>Children</Eyebrow>
              <ul className="mt-2 space-y-1.5">
                {(activeNode.children ?? []).length === 0 ? (
                  <li className="text-[11px] text-ink-muted font-serif italic">
                    No sub-provisions.
                  </li>
                ) : (
                  activeNode.children!.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-xs">
                      <FileText className="w-3 h-3 text-ink-muted" strokeWidth={1.5} />
                      <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                        {c.citation}
                      </span>
                      <span className="text-ink truncate">{c.title}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
