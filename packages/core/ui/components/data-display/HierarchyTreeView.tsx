import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface HierarchyNode {
  id: string;
  label: ReactNode;
  /** Muted right-aligned metadata (count, status). */
  meta?: ReactNode;
  /** Optional mono code rendered before the label — e.g. law code. */
  code?: string;
  children?: HierarchyNode[];
  /** Initially expanded. */
  defaultOpen?: boolean;
}

export interface HierarchyTreeViewProps {
  nodes: HierarchyNode[];
  /** Depth indent in pixels. */
  indent?: number;
  /** Click handler for a leaf or any node. */
  onSelect?: (node: HierarchyNode) => void;
  /** Selected node id — rendered with an emphasized left rule. */
  selectedId?: string;
  className?: string;
}

interface RowProps {
  node: HierarchyNode;
  depth: number;
  indent: number;
  onSelect?: HierarchyTreeViewProps['onSelect'];
  selectedId?: string;
}

function TreeRow({ node, depth, indent, onSelect, selectedId }: RowProps) {
  const [open, setOpen] = useState(node.defaultOpen ?? depth < 1);
  const hasChildren = !!node.children?.length;
  const isSelected = selectedId === node.id;

  return (
    <>
      <div
        className={cn(
          'group flex items-center gap-2 py-2 pr-3 border-b border-rule/50',
          'cursor-pointer hover:bg-paper-sunken/40 transition-colors relative',
          isSelected && 'bg-paper-sunken/60',
        )}
        style={{ paddingLeft: depth * indent + 8 }}
        onClick={() => {
          if (hasChildren) setOpen((o) => !o);
          onSelect?.(node);
        }}
      >
        {/* Vertical depth guides */}
        {depth > 0 && (
          <span
            aria-hidden
            className="absolute top-0 bottom-0 border-l border-rule/60"
            style={{ left: (depth - 1) * indent + 14 }}
          />
        )}
        {isSelected && (
          <span aria-hidden className="absolute left-0 top-1 bottom-1 w-[2px] bg-authority" />
        )}
        <button
          type="button"
          className={cn(
            'flex-none w-4 h-4 inline-flex items-center justify-center text-ink-muted',
            !hasChildren && 'invisible',
            'transition-transform',
            open && hasChildren && 'rotate-90',
          )}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
        >
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
        {node.code && (
          <span className="font-mono text-[11px] text-ink-muted tabular-nums tracking-tabular">
            {node.code}
          </span>
        )}
        <span className="flex-1 text-sm text-ink font-sans truncate">{node.label}</span>
        {node.meta && (
          <span className="text-[11px] text-ink-muted font-mono tabular-nums">{node.meta}</span>
        )}
      </div>
      {hasChildren && open && (
        <div>
          {node.children!.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              indent={indent}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Indented hierarchy tree — hairline rows, depth guides, monospace code
 * prefix, meta pill on the right. Used for laws, chart of accounts, any
 * tree-shaped entity. Built to match the `HierarchyService` data shape.
 */
export function HierarchyTreeView({
  nodes,
  indent = 16,
  onSelect,
  selectedId,
  className,
}: HierarchyTreeViewProps) {
  return (
    <div className={cn('w-full border-y border-rule', className)}>
      {nodes.map((n) => (
        <TreeRow
          key={n.id}
          node={n}
          depth={0}
          indent={indent}
          onSelect={onSelect}
          selectedId={selectedId}
        />
      ))}
    </div>
  );
}
