/**
 * TaskGraph — React Flow dependency graph with dagre auto-layout.
 * Shows tasks as card nodes with directed edges for blocker relationships.
 * Replaces the previous D3 force-directed implementation with proper
 * hierarchical layout and styled card nodes.
 */

import { useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import { Badge } from './ui/badge';
import type { Task, TaskStep } from '../../shared/ipcChannels';

// ── Theme constants ──────────────────────────────────────────────────
const STATUS_BORDER: Record<string, string> = {
  pending: 'border-l-zinc-500',
  in_progress: 'border-l-amber-500',
  completed: 'border-l-emerald-500',
  blocked: 'border-l-red-500',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-zinc-600 text-zinc-200',
  in_progress: 'bg-amber-900/60 text-amber-300',
  completed: 'bg-emerald-900/60 text-emerald-300',
  blocked: 'bg-red-900/60 text-red-300',
};

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-zinc-500',
};

const CATEGORY_COLORS: Record<string, string> = {
  feature: 'bg-violet-900/60 text-violet-300',
  enhancement: 'bg-indigo-900/60 text-indigo-300',
  bug: 'bg-orange-900/60 text-orange-300',
  fix: 'bg-orange-900/60 text-orange-300',
  refactor: 'bg-cyan-900/60 text-cyan-300',
  research: 'bg-pink-900/60 text-pink-300',
  docs: 'bg-blue-900/60 text-blue-300',
  test: 'bg-teal-900/60 text-teal-300',
  chore: 'bg-zinc-700 text-zinc-300',
};

const CATEGORY_SHORT: Record<string, string> = {
  feature: 'Feat',
  enhancement: 'Enh',
  bug: 'Bug',
  fix: 'Fix',
  refactor: 'Refac',
  research: 'Rsrch',
  docs: 'Docs',
  test: 'Test',
  chore: 'Chore',
};

// Node dimensions for dagre layout
const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

// ── Dagre layout ─────────────────────────────────────────────────────
interface TaskNodeData {
  task: Task;
  isBlocked: boolean;
  [key: string]: unknown;
}

function getLayoutedElements(
  nodes: Node<TaskNodeData>[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node<TaskNodeData>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 60, marginx: 20, marginy: 20 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const isHorizontal = direction === 'LR';
  return {
    nodes: nodes.map((node) => {
      const pos = g.node(node.id);
      return {
        ...node,
        targetPosition: isHorizontal ? Position.Left : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        position: {
          x: pos.x - NODE_WIDTH / 2,
          y: pos.y - NODE_HEIGHT / 2,
        },
      };
    }),
    edges,
  };
}

// ── Custom card node ─────────────────────────────────────────────────
function TaskCardNode({ data, selected, targetPosition, sourcePosition }: NodeProps) {
  const { task, isBlocked } = data as TaskNodeData;
  const displayStatus = isBlocked ? 'blocked' : task.status;
  const completedSteps = task.steps?.filter((s: TaskStep) => s.completed).length ?? 0;
  const totalSteps = task.steps?.length ?? 0;
  const hasSteps = totalSteps > 0;

  return (
    <>
      <Handle
        type="target"
        position={targetPosition ?? Position.Top}
        className="!bg-border-default !w-2 !h-2 !border-0"
      />
      <div
        className={cn(
          'bg-bg-secondary rounded-lg border-l-[3px] border border-border-subtle px-3 py-2 w-[220px] transition-shadow',
          STATUS_BORDER[displayStatus],
          selected && 'ring-1 ring-accent shadow-glow'
        )}
      >
        <div className="flex items-start gap-2 mb-1">
          <span className="text-[11px] font-medium text-text-primary leading-tight flex-1 line-clamp-2 flex items-center gap-1">
            {task.private && <Lock className="w-3 h-3 text-amber-500/70 shrink-0" />}
            {task.title}
          </span>
          <div
            className={cn('w-2 h-2 rounded-full shrink-0 mt-0.5', PRIORITY_DOT[task.priority])}
            title={`${task.priority} priority`}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="secondary"
            className={cn('text-[9px] capitalize px-1.5 py-0', STATUS_BADGE[displayStatus])}
          >
            {displayStatus.replace('_', ' ')}
          </Badge>
          {task.category && (
            <Badge
              variant="secondary"
              className={cn('text-[8px] px-1 py-0', CATEGORY_COLORS[task.category] || CATEGORY_COLORS.chore)}
            >
              {CATEGORY_SHORT[task.category] || task.category}
            </Badge>
          )}
          {hasSteps && (
            <span className="text-[9px] text-text-tertiary ml-auto">
              {completedSteps}/{totalSteps}
            </span>
          )}
        </div>
        {hasSteps && (
          <div className="mt-1.5 h-1 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all"
              style={{ width: `${Math.round((completedSteps / totalSteps) * 100)}%` }}
            />
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={sourcePosition ?? Position.Bottom}
        className="!bg-border-default !w-2 !h-2 !border-0"
      />
    </>
  );
}

const nodeTypes: NodeTypes = {
  taskCard: TaskCardNode as any,
};

// ── React Flow CSS variable overrides for SubFrame dark theme ────────
const FLOW_THEME_VARS: React.CSSProperties = {
  '--xy-background-color': '#0f0f10',
  '--xy-edge-stroke-default': '#6b6660',
  '--xy-node-border-radius': '8px',
  '--xy-controls-button-background-color': '#1a1a1c',
  '--xy-controls-button-background-color-hover': '#222225',
  '--xy-controls-button-color': '#a09b94',
  '--xy-controls-button-color-hover': '#e8e6e3',
  '--xy-controls-button-border-color': 'rgba(255,255,255,0.08)',
  '--xy-minimap-background-color': '#0f0f10',
  '--xy-minimap-mask-background': 'rgba(15,15,16,0.7)',
} as React.CSSProperties;

// ── Main graph component ─────────────────────────────────────────────
interface TaskGraphProps {
  tasks: Task[];
  onSelectTask?: (taskId: string) => void;
  className?: string;
  /** Compact mode uses LR layout and hides controls (sidebar) */
  compact?: boolean;
}

function TaskGraphInner({ tasks, onSelectTask, className, compact }: TaskGraphProps) {
  const { fitView } = useReactFlow();
  const prevCountRef = useRef(tasks.length);

  // Derive blocked task IDs
  const blockedIds = useMemo(() => {
    const activeIds = new Set(tasks.filter((t) => t.status !== 'completed').map((t) => t.id));
    return new Set(
      tasks
        .filter((t) => t.blockedBy?.some((id: string) => activeIds.has(id)))
        .map((t) => t.id)
    );
  }, [tasks]);

  // Build nodes + edges, apply dagre layout
  const { nodes, edges } = useMemo(() => {
    const activeTasks = tasks.filter((t) => t.status !== 'completed');
    if (activeTasks.length === 0) return { nodes: [] as Node<TaskNodeData>[], edges: [] as Edge[] };

    const rawNodes: Node<TaskNodeData>[] = activeTasks.map((task) => ({
      id: task.id,
      type: 'taskCard',
      position: { x: 0, y: 0 },
      data: { task, isBlocked: blockedIds.has(task.id) },
    }));

    const nodeIds = new Set(rawNodes.map((n) => n.id));

    const rawEdges: Edge[] = [];
    for (const task of activeTasks) {
      if (!task.blockedBy) continue;
      for (const dep of task.blockedBy) {
        if (nodeIds.has(dep)) {
          const sourceTask = activeTasks.find((t) => t.id === dep);
          rawEdges.push({
            id: `${dep}->${task.id}`,
            source: dep,
            target: task.id,
            type: 'smoothstep',
            animated: sourceTask?.status === 'in_progress',
            style: { stroke: '#6b6660', strokeWidth: 1.5 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#6b6660',
              width: 16,
              height: 16,
            },
          });
        }
      }
    }

    return getLayoutedElements(rawNodes, rawEdges, compact ? 'LR' : 'TB');
  }, [tasks, blockedIds, compact]);

  // Re-fit when task count changes
  useEffect(() => {
    if (prevCountRef.current !== tasks.length) {
      prevCountRef.current = tasks.length;
      setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
    }
  }, [tasks.length, fitView]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectTask?.(node.id);
    },
    [onSelectTask]
  );

  if (nodes.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-full text-text-tertiary text-sm', className)}>
        No active tasks to display
      </div>
    );
  }

  return (
    <div className={cn('w-full h-full min-h-[200px]', className)} style={FLOW_THEME_VARS}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={2}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background color="rgba(255,255,255,0.03)" gap={20} />
        {!compact && <Controls showInteractive={false} />}
      </ReactFlow>
    </div>
  );
}

export function TaskGraph(props: TaskGraphProps) {
  return (
    <ReactFlowProvider>
      <TaskGraphInner {...props} />
    </ReactFlowProvider>
  );
}
