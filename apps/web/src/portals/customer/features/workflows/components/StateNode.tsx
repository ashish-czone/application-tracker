import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Badge } from '@packages/ui';

export interface StateNodeData {
  label: string;
  name: string;
  color: string | null;
  isInitial: boolean;
  stateId: string;
  highlighted?: boolean;
}

export const StateNode = memo(function StateNode({ data, selected }: NodeProps<StateNodeData>) {
  const color = data.color ?? '#6B7280';
  const glowing = data.highlighted && !selected;

  return (
    <div
      className="relative px-5 py-3 rounded-lg border-2 min-w-[120px] text-center shadow-sm transition-all duration-200"
      style={{
        backgroundColor: `${color}${glowing ? '25' : '15'}`,
        borderColor: selected || glowing ? color : `${color}50`,
        boxShadow: selected
          ? `0 0 0 2px ${color}40`
          : glowing
            ? `0 0 12px ${color}50, 0 0 4px ${color}30`
            : undefined,
        transform: glowing ? 'scale(1.03)' : undefined,
      }}
    >
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
