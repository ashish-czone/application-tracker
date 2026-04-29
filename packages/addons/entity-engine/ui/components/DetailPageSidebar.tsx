import { ExternalLink } from 'lucide-react';
import { cn } from '@packages/ui';

interface RelationshipItem {
  name: string;
  label: string;
  targetEntity: string;
  foreignKey?: string;
}

interface DetailPageSidebarProps {
  relationships: RelationshipItem[];
  counts: Record<string, number>;
  onRelationshipClick: (relationship: RelationshipItem) => void;
}

export function DetailPageSidebar({ relationships, counts, onRelationshipClick }: DetailPageSidebarProps) {
  if (relationships.length === 0) return null;

  return (
    <aside className="w-52 shrink-0 border-r pr-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Related
      </h3>
      <nav className="space-y-0.5">
        {relationships.map((rel) => {
          const count = counts[`${rel.name}Count`] ?? 0;
          return (
            <button
              key={rel.name}
              type="button"
              onClick={() => onRelationshipClick(rel)}
              className={cn(
                'w-full flex items-center justify-between px-2.5 py-2 rounded-md text-sm transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
            >
              <span className="flex items-center gap-2 truncate">
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{rel.label}</span>
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {count}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
