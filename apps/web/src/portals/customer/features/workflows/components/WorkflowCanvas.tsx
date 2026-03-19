import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { StateNode, type StateNodeData } from './StateNode';
import { StateConfigPanel } from './StateConfigPanel';
import { TransitionConfigPanel } from './TransitionConfigPanel';
import { getLayoutedElements } from './auto-layout';
import { useCreateTransition } from '../hooks';
import type { WorkflowDefinition, WorkflowState, WorkflowTransition } from '../types';

const nodeTypes = { stateNode: StateNode };

interface WorkflowCanvasProps {
  workflow: WorkflowDefinition;
  slug: string;
}

type SelectedItem =
  | { type: 'state'; state: WorkflowState }
  | { type: 'transition'; transition: WorkflowTransition };

export function WorkflowCanvas({ workflow, slug }: WorkflowCanvasProps) {
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  const createTransitionMutation = useCreateTransition(slug);

  // Build reactflow nodes from workflow states
  const initialNodes: Node<StateNodeData>[] = useMemo(
    () =>
      workflow.states.map((state) => ({
        id: state.name,
        type: 'stateNode',
        position: { x: 0, y: 0 },
        data: {
          label: state.label,
          name: state.name,
          color: state.color,
          isInitial: state.name === workflow.initialState,
          stateId: state.id,
        },
      })),
    [workflow.states, workflow.initialState],
  );

  // Build reactflow edges from workflow transitions
  const initialEdges: Edge[] = useMemo(
    () =>
      workflow.transitions.map((t) => ({
        id: t.id,
        source: t.fromStateName,
        target: t.toStateName,
        label: t.name,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: { strokeWidth: 2 },
        labelStyle: { fontSize: 11, fontWeight: 500 },
        labelBgStyle: { fill: 'var(--background)', fillOpacity: 0.9 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
      })),
    [workflow.transitions],
  );

  // Apply auto-layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(initialNodes, initialEdges),
    [initialNodes, initialEdges],
  );

  const [nodes, setNodes] = useState(layoutedNodes);
  const [edges, setEdges] = useState(layoutedEdges);

  // Re-layout when workflow data changes
  useMemo(() => {
    const { nodes: newNodes, edges: newEdges } = getLayoutedElements(initialNodes, initialEdges);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [initialNodes, initialEdges]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  // Handle drag-to-connect (create new transition)
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;

      // Find state IDs from names
      const fromState = workflow.states.find((s) => s.name === connection.source);
      const toState = workflow.states.find((s) => s.name === connection.target);
      if (!fromState || !toState) return;

      // Check if transition already exists
      const existing = workflow.transitions.find(
        (t) => t.fromStateName === connection.source && t.toStateName === connection.target,
      );
      if (existing) return;

      createTransitionMutation.mutate({
        definitionId: workflow.id,
        data: {
          fromStateId: fromState.id,
          toStateId: toState.id,
          name: `${fromState.label} → ${toState.label}`,
        },
      });
    },
    [workflow, createTransitionMutation],
  );

  // Handle node click (select state)
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const state = workflow.states.find((s) => s.name === node.id);
      if (state) setSelectedItem({ type: 'state', state });
    },
    [workflow.states],
  );

  // Handle edge click (select transition)
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      const transition = workflow.transitions.find((t) => t.id === edge.id);
      if (transition) setSelectedItem({ type: 'transition', transition });
    },
    [workflow.transitions],
  );

  const onPaneClick = useCallback(() => setSelectedItem(null), []);

  return (
    <div className="flex h-full">
      <div className="flex-1 h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          connectionLineStyle={{ strokeWidth: 2 }}
          defaultEdgeOptions={{
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
            style: { strokeWidth: 2 },
          }}
        >
          <Background gap={16} size={1} />
          <Controls />
          <MiniMap
            nodeStrokeWidth={3}
            nodeColor={(node) => {
              const data = node.data as StateNodeData;
              return data.color ?? '#6B7280';
            }}
            zoomable
            pannable
          />
        </ReactFlow>
      </div>

      {/* Side panel */}
      {selectedItem && (
        <div className="w-72 border-l border-border bg-background p-4 overflow-y-auto shrink-0">
          {selectedItem.type === 'state' ? (
            <StateConfigPanel
              state={selectedItem.state}
              isInitial={selectedItem.state.name === workflow.initialState}
              slug={slug}
              onClose={() => setSelectedItem(null)}
            />
          ) : (
            <TransitionConfigPanel
              transition={selectedItem.transition}
              slug={slug}
              onClose={() => setSelectedItem(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
