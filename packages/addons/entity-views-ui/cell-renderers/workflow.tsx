import { Badge } from '@packages/ui';
import { useQuery } from '@tanstack/react-query';
import { useEntityListViewContext } from '../EntityListViewProvider';
import type { CellRenderer } from './types';

interface WorkflowDefinitionResponse {
  slug: string;
  name: string;
  states: Array<{
    name: string;
    label: string;
    color?: string | null;
  }>;
}

/**
 * Workflow chip. Reads `column.workflowSlug` to resolve the workflow
 * definition (label + state colors) via `GET /workflows/:slug`, cached
 * forever — workflow defs change rarely and aggressively cached state is
 * acceptable. Renders the current value as a coloured Badge.
 *
 * If no slug is configured or the row value isn't a known state, falls back
 * to plain text (still wrapped in a Badge for visual consistency).
 */
export const WorkflowCell: CellRenderer = ({ value, column }) => {
  const { apiFn } = useEntityListViewContext();
  const slug = column.workflowSlug;

  const { data: workflow } = useQuery({
    queryKey: ['workflow-def', slug],
    queryFn: () => apiFn.get<WorkflowDefinitionResponse>(`/workflows/${slug}`),
    enabled: !!slug,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (value == null || value === '') {
    return <span className="text-muted-foreground">—</span>;
  }

  const valueStr = String(value);
  const state = workflow?.states.find((s) => s.name === valueStr);
  const label = state?.label ?? valueStr;
  const color = state?.color ?? undefined;

  return (
    <Badge
      variant="secondary"
      style={color ? { backgroundColor: color, color: 'white', borderColor: color } : undefined}
    >
      {label}
    </Badge>
  );
};
