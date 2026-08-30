import dagre from "@dagrejs/dagre";
import type { GraphEdge, StoryGraph } from "@fabler/types";

/** Node dimensions dagre reserves; must match the rendered node's CSS. */
export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 52;

export interface PositionedNode {
  id: string;
  name: string;
  is_start: boolean;
  position: { x: number; y: number };
}

/**
 * Place every node, preferring the author's own arrangement.
 *
 * Layered top-to-bottom rather than force-directed: a story flows from its
 * start page, so depth reads as narrative distance. Dagre breaks cycles
 * itself, which matters because story graphs loop.
 *
 * Known limitation: dagre lays out ALL nodes in one pass, and saved
 * positions are substituted in only afterwards, so dagre's placement for a
 * new, unsaved node knows nothing about where manually-placed nodes ended
 * up. A newly added page can therefore land on top of one an author has
 * moved. The remedy is the "Auto-arrange" control in `StoryGraphView`,
 * which clears every saved position (via `clearEditorPositions`) and
 * re-runs layout from scratch, rather than a collision-avoidance algorithm
 * here.
 */
export function layoutGraph(graph: StoryGraph): {
  nodes: PositionedNode[];
  edges: GraphEdge[];
} {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 70 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of graph.edges) {
    // A dangling edge names a target that does not exist. Handing it to
    // dagre would silently create a phantom node for it. `is_dangling` is
    // computed once in `shared/src/graph.rs`, where the full page-id set
    // lives; recomputing it here would be a second, drifting definition of
    // the same fact.
    if (!edge.is_dangling) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const nodes = graph.nodes.map((node) => {
    if (node.position) {
      return { ...node, position: { x: node.position.x, y: node.position.y } };
    }
    const laid = g.node(node.id) as { x: number; y: number };
    return {
      ...node,
      // dagre reports centres; React Flow wants top-left.
      position: { x: laid.x - NODE_WIDTH / 2, y: laid.y - NODE_HEIGHT / 2 },
    };
  });

  return { nodes, edges: graph.edges };
}
