import dagre from "@dagrejs/dagre";
import type { GraphEdge, StoryGraph } from "@fabler/types";

/** Node dimensions dagre reserves; must match the rendered node's CSS. */
const NODE_WIDTH = 180;
const NODE_HEIGHT = 52;

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
 */
export function layoutGraph(graph: StoryGraph): {
  nodes: PositionedNode[];
  edges: GraphEdge[];
} {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 70 });
  g.setDefaultEdgeLabel(() => ({}));

  const known = new Set(graph.nodes.map((n) => n.id));
  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of graph.edges) {
    // A dangling edge names a target that does not exist. Handing it to
    // dagre would silently create a phantom node for it.
    if (known.has(edge.source) && known.has(edge.target)) {
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
