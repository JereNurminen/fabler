import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type NodeProps,
  type NodeTypes,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphEdge, Problem, StoryGraph } from "@fabler/types";
import api from "../api";
import { useTranslation } from "../i18n";
import { useTrackedAction } from "../hooks/useTrackedAction";
import { getLinkToPage } from "../utilities/routing";
import { layoutGraph, NODE_WIDTH, NODE_HEIGHT, type PositionedNode } from "./layout";
import { MISSING_NODE_PREFIX, missingNodeId } from "./missingNode";
import { usePositionPersistence } from "./usePositionPersistence";
import "./graph.css";

export { MISSING_NODE_PREFIX, missingNodeId };

interface StoryGraphViewProps {
  onClose: () => void;
}

/**
 * A custom node data type must be assignable to `Record<string, unknown>`
 * for React Flow v12's `Node<T>` generic constraint. Extending it directly
 * (rather than a bare `{ label: string }`) makes that assignability
 * unconditional instead of relying on structural-typing quirks.
 */
export interface StoryNodeData extends Record<string, unknown> {
  label: string;
}

export type StoryNode = Node<StoryNodeData>;

/**
 * Custom node renderer, replacing React Flow's built-in "default" node.
 *
 * The label sits in its own element rather than as a direct text child of
 * the sized node wrapper: `-webkit-line-clamp` needs to compute its own
 * intrinsic height from line-height and the clamp count, and that
 * calculation breaks (extra, unclamped lines leak past the clip box) when
 * the SAME element also carries an explicit inline height — which the node
 * wrapper always does, from NODE_WIDTH/NODE_HEIGHT below. Verified against
 * a standalone repro before landing this structure.
 */
function StoryFlowNode({ data }: NodeProps<StoryNode>) {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <span className="story-node__label">{data.label}</span>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

const nodeTypes: NodeTypes = { storyNode: StoryFlowNode };

/** Worst severity affecting each page, for node styling. */
export function severityByPage(problems: Problem[]): Map<string, "error" | "warning"> {
  const worst = new Map<string, "error" | "warning">();
  for (const p of problems) {
    if (!p.page_id) continue;
    if (p.severity === "error") worst.set(p.page_id, "error");
    else if (p.severity === "warning" && !worst.has(p.page_id)) {
      worst.set(p.page_id, "warning");
    }
  }
  return worst;
}

/**
 * Convert dagre-positioned nodes into React Flow's node shape, driving the
 * inline size from NODE_WIDTH/NODE_HEIGHT so it can never drift from what
 * layoutGraph reserved for each box.
 */
export function toFlowNodes(
  positioned: PositionedNode[],
  severity: Map<string, "error" | "warning">,
): StoryNode[] {
  return positioned.map(
    (n): StoryNode => ({
      id: n.id,
      type: "storyNode",
      position: n.position,
      data: { label: n.name || n.id },
      style: { width: NODE_WIDTH, height: NODE_HEIGHT },
      className: [
        "story-node",
        n.is_start && "story-node--start",
        severity.get(n.id) === "error" && "story-node--error",
        severity.get(n.id) === "warning" && "story-node--warning",
      ]
        .filter(Boolean)
        .join(" "),
    }),
  );
}

/**
 * Convert graph edges to React Flow's edge shape.
 *
 * Dangling edges are kept rather than dropped — a choice that leads nowhere
 * is the most important thing the map can show an author — but their
 * `target` is redirected to the synthetic missing-target node id, since
 * React Flow cannot route an edge to a node that does not exist. Pair with
 * `buildMissingNodes`, which creates that synthetic node.
 */
export function toFlowEdges(edges: GraphEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.is_dangling ? missingNodeId(e.target) : e.target,
    label: e.label || undefined,
  }));
}

/**
 * Build one synthetic stub node per unique dangling-edge target, so
 * `toFlowEdges`'s redirected edges have somewhere to point.
 *
 * Deduplicated by target: two different choices dangling to the same
 * missing id share one stub, same as two choices to the same real page
 * share one real node. Not draggable — there is no backing page to persist
 * a position onto — and positioned near the first source that references
 * it (offset per distinct target) since dagre never laid these out: they
 * are not real pages and were deliberately kept out of the dagre pass.
 */
export function buildMissingNodes(
  edges: GraphEdge[],
  positioned: PositionedNode[],
  label: string,
): StoryNode[] {
  const positionById = new Map(positioned.map((n) => [n.id, n.position]));
  const bySourceOfTarget = new Map<string, string>();
  for (const edge of edges) {
    if (!edge.is_dangling) continue;
    if (!bySourceOfTarget.has(edge.target)) {
      bySourceOfTarget.set(edge.target, edge.source);
    }
  }

  return [...bySourceOfTarget.entries()].map(([target, source], index): StoryNode => {
    const sourcePosition = positionById.get(source) ?? { x: 0, y: 0 };
    return {
      id: missingNodeId(target),
      type: "storyNode",
      position: {
        x: sourcePosition.x + index * (NODE_WIDTH + 40),
        y: sourcePosition.y + NODE_HEIGHT + 60,
      },
      data: { label },
      style: { width: NODE_WIDTH, height: NODE_HEIGHT },
      className: "story-node story-node--missing",
      draggable: false,
    };
  });
}

/**
 * Which of the graph view's mutually-exclusive panels to show.
 *
 * Deliberately keyed off `graph` and `loadError` only, never off the
 * `nodes` React state array: `nodes` is populated by a follow-up effect (it
 * has to be state, not derived, so drags can mutate it) and lags one render
 * behind `graph` arriving. Driving the empty/graph decision from `nodes`
 * would paint the "no pages" message for that one tick even when the story
 * has pages. `graph.nodes` reflects the fetch result immediately, so this
 * function is pure and synchronous with no such gap.
 *
 * Validation failures never surface here: `getStoryGraph` failing makes the
 * whole map unusable, so it blocks everything behind an error panel with
 * retry. `validateStory` failing only means severity badges are missing —
 * the map itself is still useful, so that failure is swallowed (logged,
 * not surfaced) and simply leaves `problems` empty.
 */
export type GraphViewMode = "loading" | "error" | "empty" | "graph";

export function resolveGraphViewMode(state: {
  graph: StoryGraph | null;
  loadError: boolean;
}): GraphViewMode {
  if (state.loadError) return "error";
  if (!state.graph) return "loading";
  if (state.graph.nodes.length === 0) return "empty";
  return "graph";
}

export function StoryGraphView({ onClose }: StoryGraphViewProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [graph, setGraph] = useState<StoryGraph | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [nodes, setNodes] = useState<StoryNode[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);

    api
      .getStoryGraph()
      .then((g) => {
        if (!cancelled) setGraph(g);
      })
      .catch((error: unknown) => {
        console.error("Failed to load story map:", error);
        if (!cancelled) setLoadError(true);
      });

    // Validation is an overlay on top of the graph (severity badges), not a
    // prerequisite for it — a failure here should not strand the author on
    // the loading screen when the map itself loaded fine.
    api
      .validateStory()
      .then((report) => {
        if (!cancelled) setProblems(report.problems);
      })
      .catch((error: unknown) => {
        console.error("Failed to validate story:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const laidOut = useMemo(() => (graph ? layoutGraph(graph) : null), [graph]);

  useEffect(() => {
    if (!laidOut) return;
    const realNodes = toFlowNodes(laidOut.nodes, severityByPage(problems));
    const stubNodes = buildMissingNodes(laidOut.edges, laidOut.nodes, t.graph.danglingTarget);
    setNodes([...realNodes, ...stubNodes]);
  }, [laidOut, problems, t]);

  const viewMode = resolveGraphViewMode({ graph, loadError });

  const edges: Edge[] = useMemo(() => toFlowEdges(laidOut?.edges ?? []), [laidOut]);

  const onNodesChange = useCallback((changes: NodeChange<StoryNode>[]) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const savePosition = usePositionPersistence();
  const onNodeDragStop = useCallback<OnNodeDrag<StoryNode>>(
    (_event, node) => savePosition(node),
    [savePosition],
  );

  const autoArrange = useTrackedAction(async () => {
    await api.clearEditorPositions();
    retry();
  });

  const openPage = useCallback<NodeMouseHandler<StoryNode>>(
    (_event, node) => {
      if (node.id.startsWith(MISSING_NODE_PREFIX)) return;
      setLocation(getLinkToPage(node.id));
      onClose();
    },
    [setLocation, onClose],
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" data-testid="story-graph">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b shrink-0">
        <span className="text-sm font-medium text-gray-600">{t.graph.title}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={autoArrange}
            className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            {t.graph.autoArrange}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            {t.graph.close}
          </button>
        </div>
      </div>
      <div className="flex-1">
        {viewMode === "loading" ? (
          <p className="p-6 text-sm text-gray-500">{t.graph.loading}</p>
        ) : viewMode === "error" ? (
          <div className="p-6 text-sm text-gray-500">
            <p>{t.graph.loadError}</p>
            <button
              onClick={retry}
              className="mt-2 px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
            >
              {t.graph.retry}
            </button>
          </div>
        ) : viewMode === "empty" ? (
          <p className="p-6 text-sm text-gray-500 italic">{t.graph.empty}</p>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={openPage}
            onNodeDragStop={onNodeDragStop}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
