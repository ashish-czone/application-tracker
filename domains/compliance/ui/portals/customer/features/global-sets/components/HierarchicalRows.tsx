import { CornerDownRight, Pencil, Trash2 } from 'lucide-react';

export interface TreeNode {
  id: string;
  slug: string;
  name: string;
  children: TreeNode[];
}

export interface HierarchicalRowsProps {
  nodes: TreeNode[];
  depth?: number;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function HierarchicalRows({ nodes, depth = 0, onEdit, onDelete }: HierarchicalRowsProps) {
  const hasActions = !!(onEdit || onDelete);

  return (
    <>
      {nodes.map((node) => (
        <div key={node.id}>
          <div
            className="group grid items-center gap-3 px-4 py-2.5 border-b border-rule hover:bg-paper transition-colors"
            style={{
              gridTemplateColumns: `1fr 120px auto${hasActions ? ' 64px' : ''}`,
            }}
          >
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
            {hasActions && (
              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(node.id)}
                    className="p-1 text-ink-muted hover:text-ink transition-colors"
                    aria-label={`Edit ${node.name}`}
                  >
                    <Pencil className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(node.id)}
                    className="p-1 text-ink-muted hover:text-destructive transition-colors"
                    aria-label={`Delete ${node.name}`}
                  >
                    <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            )}
          </div>
          {node.children.length > 0 && (
            <HierarchicalRows
              nodes={node.children}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}
        </div>
      ))}
    </>
  );
}
