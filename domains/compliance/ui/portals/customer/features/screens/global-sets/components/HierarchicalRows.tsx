import { CornerDownRight } from 'lucide-react';

export interface TreeNode {
  id: string;
  slug: string;
  name: string;
  children: TreeNode[];
}

export interface HierarchicalRowsProps {
  nodes: TreeNode[];
  depth?: number;
}

export function HierarchicalRows({ nodes, depth = 0 }: HierarchicalRowsProps) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.id}>
          <div className="grid grid-cols-[1fr_120px_auto] items-center gap-3 px-4 py-2.5 border-b border-rule hover:bg-paper transition-colors">
            <div
              className="flex items-center gap-2 text-xs text-ink font-sans"
              style={{ paddingLeft: `${depth * 16}px` }}
            >
              {depth > 0 && <CornerDownRight className="w-3 h-3 text-ink-muted" strokeWidth={1.5} />}
              <span>{node.name}</span>
            </div>
            <div className="font-mono text-[11px] text-ink-muted tabular-nums">{node.slug}</div>
            <div className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
              {node.children.length > 0 ? `${node.children.length} children` : ''}
            </div>
          </div>
          {node.children.length > 0 && <HierarchicalRows nodes={node.children} depth={depth + 1} />}
        </div>
      ))}
    </>
  );
}
