import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  type KeyCode,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { StateNode, type StateNodeData } from './StateNode';
import { StateConfigPanel } from './StateConfigPanel';
import { TransitionConfigPanel } from './TransitionConfigPanel';
import { getLayoutedElements } from './auto-layout';
import { useCreateTransition, useDeleteState, useDeleteTransition } from '../hooks';
import type { WorkflowDefinition, WorkflowState, WorkflowTransition } from '../types';

const nodeTypes = { stateNode: StateNode };

// Entry point node — small filled circle before initial state
const ENTRY_NODE_ID = '__entry__';

interface WorkflowCanvasProps {
  workflow: WorkflowDefinition;
  slug: string;
}

type SelectedItem =
  | { type: 'state'; state: WorkflowState }
  | { type: 'transition'; transition: WorkflowTransition };

export function WorkflowCanvas({ workflow, slug }: WorkflowCanvasProps) {
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const isInitialLayout = useRef(true);

  const createTransitionMutation = useCreateTransition(slug);
  const deleteStateMutation = useDeleteState(slug);
  const deleteTransitionMutation = useDeleteTransition(slug);

  // Build nodes + edges from workflow data and apply layout
  useEffect(() => {
    const stateNodes: Node<StateNodeData>[] = workflow.states.map((state) => ({
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
    }));

    // Entry point dot
    const entryNode: Node = {
      id: ENTRY_NODE_ID,
      type: 'input',
      position: { x: 0, y: 0 },
      data: {},
      style: {
        width: 16,
        height: 16,
        minWidth: 16,
        minHeight: 16,
        borderRadius: '50%',
        backgroundColor: '#6B7280',
        border: 'none',
        padding: 0,
      },
      selectable: false,
      draggable: false,
    };

    const allNodes = [entryNode, ...stateNodes];

    const transitionEdges: Edge[] = workflow.transitions.map((t) => ({
      id: t.id,
      source: t.fromStateName,
      target: t.toStateName,
      label: t.name,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#94a3b8' },
      style: { strokeWidth: 2, stroke: '#94a3b8' },
      labelStyle: {
        fontSize: 10,
        fontWeight: 600,
        fill: '#475569',
        letterSpacing: '0.02em',
      },
      labelBgStyle: {
        fill: '#f1f5f9',
        fillOpacity: 1,
        stroke: '#cbd5e1',
        strokeWidth: 1,
        rx: 10,
        ry: 10,
      },
      labelBgPadding: [8, 4] as [number, number],
      labelBgBorderRadius: 10,
    }));

    // Entry → initial state edge
    const entryEdge: Edge = {
      id: '__entry_edge__',
      source: ENTRY_NODE_ID,
      target: workflow.initialState,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#6B7280' },
      style: { strokeWidth: 2, stroke: '#6B7280', strokeDasharray: '4 4' },
      deletable: false,
    };

    const allEdges = [entryEdge, ...transitionEdges];

    const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(allNodes, allEdges);

    // Preserve user-dragged positions on data updates (not initial load)
    if (isInitialLayout.current) {
      setNodes(layouted);
      isInitialLayout.current = false;
    } else {
      // Merge: keep existing positions for known nodes, add new ones from layout
      setNodes((prev) => {
        const prevMap = new Map(prev.map((n) => [n.id, n]));
        return layouted.map((n) => {
          const existing = prevMap.get(n.id);
          if (existing) {
            return { ...n, position: existing.position };
          }
          return n;
        });
      });
    }
    setEdges(layoutedEdges);
  }, [workflow]);

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
      if (connection.source === ENTRY_NODE_ID) return;

      const fromState = workflow.states.find((s) => s.name === connection.source);
      const toState = workflow.states.find((s) => s.name === connection.target);
      if (!fromState || !toState) return;

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
      if (node.id === ENTRY_NODE_ID) return;
      const state = workflow.states.find((s) => s.name === node.id);
      if (state) setSelectedItem({ type: 'state', state });
    },
    [workflow.states],
  );

  // Handle edge click (select transition)
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (edge.id === '__entry_edge__') return;
      const transition = workflow.transitions.find((t) => t.id === edge.id);
      if (transition) setSelectedItem({ type: 'transition', transition });
    },
    [workflow.transitions],
  );

  const onPaneClick = useCallback(() => setSelectedItem(null), []);

  // Apply hover highlight to connected nodes and the hovered edge
  const displayNodes = useMemo(() => {
    if (!hoveredEdgeId) {
      // Clear highlights
      return nodes.map((n) => ({
        ...n,
        data: { ...n.data, highlighted: false },
      }));
    }
    const hoveredEdge = edges.find((e) => e.id === hoveredEdgeId);
    if (!hoveredEdge) return nodes;
    const connectedNodeIds = new Set([hoveredEdge.source, hoveredEdge.target]);
    return nodes.map((n) => ({
      ...n,
      data: { ...n.data, highlighted: connectedNodeIds.has(n.id) },
    }));
  }, [nodes, edges, hoveredEdgeId]);

  const displayEdges = useMemo(() => {
    if (!hoveredEdgeId) return edges;
    return edges.map((e) => {
      if (e.id === hoveredEdgeId) {
        return {
          ...e,
          style: { ...e.style, strokeWidth: 3, stroke: '#6366f1' },
          markerEnd: { type: MarkerType.ArrowClosed as const, width: 18, height: 18, color: '#6366f1' },
          labelStyle: { ...e.labelStyle, fill: '#4338ca' },
          labelBgStyle: { ...e.labelBgStyle, fill: '#eef2ff', stroke: '#a5b4fc' },
        };
      }
      // Dim other edges
      if (e.id !== '__entry_edge__') {
        return {
          ...e,
          style: { ...e.style, opacity: 0.3 },
          labelStyle: { ...e.labelStyle, opacity: 0.3 },
          labelBgStyle: { ...e.labelBgStyle, fillOpacity: 0.3 },
        };
      }
      return { ...e, style: { ...e.style, opacity: 0.3 } };
    });
  }, [edges, hoveredEdgeId]);

  // Edge hover handlers
  const onEdgeMouseEnter = useCallback((_: React.MouseEvent, edge: Edge) => {
    if (edge.id === '__entry_edge__') return;
    setHoveredEdgeId(edge.id);
  }, []);

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeId(null);
  }, []);

  // Delete key handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!selectedItem) return;
        // Don't delete if user is typing in an input
        if (
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement
        )
          return;

        if (selectedItem.type === 'state') {
          if (selectedItem.state.name === workflow.initialState) return; // Can't delete initial
          deleteStateMutation.mutate(selectedItem.state.id);
          setSelectedItem(null);
        } else {
          deleteTransitionMutation.mutate(selectedItem.transition.id);
          setSelectedItem(null);
        }
      }
    },
    [selectedItem, workflow.initialState, deleteStateMutation, deleteTransitionMutation],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-full">
      <div className="flex-1 h-full workflow-canvas">
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onEdgeMouseEnter={onEdgeMouseEnter}
          onEdgeMouseLeave={onEdgeMouseLeave}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          connectionLineStyle={{ strokeWidth: 2 }}
          deleteKeyCode={null as unknown as KeyCode}
          defaultEdgeOptions={{
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#94a3b8' },
            style: { strokeWidth: 2, stroke: '#94a3b8' },
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeStrokeWidth={3}
            nodeColor={(node) => {
              if (node.id === ENTRY_NODE_ID) return '#6B7280';
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
