import { ChevronRight, ChevronDown } from 'lucide-react';
import type { LawNode } from '../data/lawsMock';

export function countAll(node: LawNode): number {
  const own = node.obligationCount ?? 0;
  const kids = (node.children ?? []).reduce((sum, c) => sum + countAll(c), 0);
  return own + kids;
}

export interface LawTreeRowProps {
  node: LawNode;
  depth: number;
  activeId: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: LawNode) => void;
}

export function LawTreeRow({
  node,
  depth,
  activeId,
  expanded,
  onToggle,
  onSelect,
}: LawTreeRowProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isOpen = expanded.has(node.id);
  const isActive = node.id === activeId;

  return (
    <>
      <div
        className={`grid grid-cols-[1fr_auto] items-center gap-3 border-b border-rule transition-colors cursor-pointer ${
          isActive ? 'bg-paper border-l-2 border-l-ink' : 'hover:bg-paper'
        }`}
        onClick={() => onSelect(node)}
      >
        <div
          className="flex items-center gap-1.5 px-4 py-2.5"
          style={{ paddingLeft: `${16 + depth * 16}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(node.id);
              }}
              className="flex items-center justify-center w-4 h-4 text-ink-muted hover:text-ink"
              aria-label={isOpen ? 'Collapse' : 'Expand'}
            >
              {isOpen ? (
                <ChevronDown className="w-3 h-3" strokeWidth={1.5} />
              ) : (
                <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
              )}
            </button>
          ) : (
            <span className="inline-block w-4" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                {node.citation}
              </span>
              <span className="text-xs text-ink font-sans truncate">{node.title}</span>
            </div>
          </div>
        </div>
        <div className="px-4 py-2.5 font-mono text-[11px] text-ink-muted tabular-nums">
          — oblg
        </div>
      </div>
      {isOpen &&
        node.children?.map((child) => (
          <LawTreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            activeId={activeId}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}
