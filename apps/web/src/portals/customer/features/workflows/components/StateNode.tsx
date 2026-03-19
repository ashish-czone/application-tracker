import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@packages/ui';

export interface StateNodeData {
  label: string;
  name: string;
  color: string | null;
  isInitial: boolean;
  stateId: string;
  highlighted?: boolean;
  warning?: string | null;
}

export const StateNode = memo(function StateNode({ data, selected }: NodeProps<StateNodeData>) {
  const color = data.color ?? '#6B7280';
  const glowing = data.highlighted && !selected;
  const hasWarning = !!data.warning;

  return (
    <div
      className="relative px-5 py-3 rounded-lg border-2 min-w-[120px] text-center shadow-sm transition-all duration-200"
      style={{
        backgroundColor: `${color}${glowing ? '25' : '15'}`,
        borderColor: hasWarning
          ? '#eab308'
          : selected || glowing
            ? color
            : `${color}50`,
        boxShadow: selected
          ? `0 0 0 2px ${color}40`
          : glowing
            ? `0 0 12px ${color}50, 0 0 4px ${color}30`
            : hasWarning
              ? '0 0 0 1px #eab30840'
              : undefined,
        transform: glowing ? 'scale(1.03)' : undefined,
      }}
    >
      {/* Warning icon */}
      {hasWarning && (
        <div
          className="absolute -top-2.5 -right-2.5 rounded-full bg-yellow-400 p-0.5 shadow-sm"
          title={data.warning!}
        >
          <AlertTriangle className="h-3 w-3 text-yellow-900" />
        </div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !bg-background"
        style={{ borderColor: color }}
      />
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-medium" style={{ color }}>
          {data.label}
        </span>
        {data.isInitial && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal">
            Initial
          </Badge>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-2 !bg-background"
        style={{ borderColor: color }}
      />
    </div>
  );
});
