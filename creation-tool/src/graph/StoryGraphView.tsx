import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphEdge, Problem, StoryGraph } from "@fabler/types";
import api from "../api";
import { useTranslation } from "../i18n";
import { getLinkToPage } from "../utilities/routing";
import { layoutGraph, NODE_WIDTH, NODE_HEIGHT, type PositionedNode } from "./layout";
import "./graph.css";

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
 * Convert graph edges to React Flow's edge shape, dropping dangling edges —
 * React Flow cannot route an edge to a node that does not exist. Task 5
 * replaces this filter with rendered stubs; the underlying data is untouched,
 * only what is handed to the renderer is filtered.
 */
export function toFlowEdges(edges: GraphEdge[]): Edge[] {
  return edges
    .filter((e) => !e.is_dangling)
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label || undefined,
    }));
}

export function StoryGraphView({ onClose }: StoryGraphViewProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [graph, setGraph] = useState<StoryGraph | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [nodes, setNodes] = useState<StoryNode[]>([]);

  useEffect(() => {
    void Promise.all([api.getStoryGraph(), api.validateStory()])
      .then(([g, report]) => {
        setGraph(g);
        setProblems(report.problems);
      })
      .catch((error: unknown) => {
        console.error("Failed to load story map:", error);
      });
  }, []);

  const laidOut = useMemo(() => (graph ? layoutGraph(graph) : null), [graph]);

  useEffect(() => {
    if (!laidOut) return;
    setNodes(toFlowNodes(laidOut.nodes, severityByPage(problems)));
  }, [laidOut, problems]);

  const edges: Edge[] = useMemo(() => toFlowEdges(laidOut?.edges ?? []), [laidOut]);

  const onNodesChange = useCallback((changes: NodeChange<StoryNode>[]) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const openPage = useCallback<NodeMouseHandler<StoryNode>>(
    (_event, node) => {
      setLocation(getLinkToPage(node.id));
      onClose();
    },
    [setLocation, onClose],
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" data-testid="story-graph">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b shrink-0">
        <span className="text-sm font-medium text-gray-600">{t.graph.title}</span>
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
        >
          {t.graph.close}
        </button>
      </div>
      <div className="flex-1">
        {!laidOut ? (
          <p className="p-6 text-sm text-gray-500">{t.graph.loading}</p>
        ) : nodes.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 italic">{t.graph.empty}</p>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onNodeClick={openPage}
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
