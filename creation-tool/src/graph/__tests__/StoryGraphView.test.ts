import { describe, it, expect } from "vitest";
import type { GraphEdge, Problem, StoryGraph } from "@fabler/types";
import type { PositionedNode } from "../layout";
import { NODE_WIDTH, NODE_HEIGHT } from "../layout";
import {
  severityByPage,
  toFlowNodes,
  toFlowEdges,
  resolveGraphViewMode,
  missingNodeId,
  buildMissingNodes,
} from "../StoryGraphView";

const problem = (over: Partial<Problem> = {}): Problem => ({
  severity: "error",
  page_id: "a",
  page_name: "Page A",
  detail: { code: "unreachable_page" },
  ...over,
});

describe("severityByPage", () => {
  it("ignores story-level problems with no page_id", () => {
    const worst = severityByPage([problem({ page_id: null })]);
    expect(worst.size).toBe(0);
  });

  it("records the worst severity per page", () => {
    const worst = severityByPage([
      problem({ page_id: "a", severity: "warning" }),
      problem({ page_id: "a", severity: "error" }),
    ]);
    expect(worst.get("a")).toBe("error");
  });

  it("does not let a later warning downgrade an existing error", () => {
    const worst = severityByPage([
      problem({ page_id: "a", severity: "error" }),
      problem({ page_id: "a", severity: "warning" }),
    ]);
    expect(worst.get("a")).toBe("error");
  });

  it("keeps warning when no error was ever seen for that page", () => {
    const worst = severityByPage([problem({ page_id: "b", severity: "warning" })]);
    expect(worst.get("b")).toBe("warning");
  });
});

describe("toFlowNodes", () => {
  const positioned: PositionedNode[] = [
    { id: "a", name: "Start", is_start: true, position: { x: 1, y: 2 } },
    { id: "b", name: "", is_start: false, position: { x: 3, y: 4 } },
  ];

  it("carries id and position through unchanged", () => {
    const [a] = toFlowNodes(positioned, new Map());
    expect(a.id).toBe("a");
    expect(a.position).toEqual({ x: 1, y: 2 });
  });

  it("falls back to the id as the label when the name is blank", () => {
    const [, b] = toFlowNodes(positioned, new Map());
    expect(b.data.label).toBe("b");
  });

  it("sizes every node from NODE_WIDTH/NODE_HEIGHT rather than a restated literal", () => {
    const [a] = toFlowNodes(positioned, new Map());
    expect(a.style).toEqual({ width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  it("marks the start node with story-node--start", () => {
    const [a, b] = toFlowNodes(positioned, new Map());
    expect(a.className).toContain("story-node--start");
    expect(b.className).not.toContain("story-node--start");
  });

  it("applies error styling over warning when a page has an error", () => {
    const severity = new Map<string, "error" | "warning">([["a", "error"]]);
    const [a] = toFlowNodes(positioned, severity);
    expect(a.className).toContain("story-node--error");
    expect(a.className).not.toContain("story-node--warning");
  });

  it("applies warning styling for a warning-only page", () => {
    const severity = new Map<string, "error" | "warning">([["b", "warning"]]);
    const [, b] = toFlowNodes(positioned, severity);
    expect(b.className).toContain("story-node--warning");
  });
});

describe("toFlowEdges", () => {
  const edges: GraphEdge[] = [
    { id: "a:c1", source: "a", target: "b", label: "Go", is_dangling: false },
    { id: "a:c2", source: "a", target: "gone9", label: "Nowhere", is_dangling: true },
  ];

  it("keeps dangling edges rather than dropping them", () => {
    const flowEdges = toFlowEdges(edges);
    expect(flowEdges).toHaveLength(2);
    expect(flowEdges.map((e) => e.id)).toEqual(["a:c1", "a:c2"]);
  });

  it("re-routes a dangling edge to the synthetic missing-target node instead of the nonexistent id", () => {
    // React Flow cannot route to a node that does not exist, so a dangling
    // edge's `target` must never remain the raw (missing) page id.
    const flowEdges = toFlowEdges(edges);
    const dangling = flowEdges.find((e) => e.id === "a:c2");
    expect(dangling?.source).toBe("a");
    expect(dangling?.target).toBe(missingNodeId("gone9"));
    expect(dangling?.label).toBe("Nowhere");
  });

  it("carries source, target and label through for a live edge", () => {
    const [edge] = toFlowEdges(edges);
    expect(edge).toMatchObject({ source: "a", target: "b", label: "Go" });
  });

  it("turns an empty label into undefined rather than an empty string", () => {
    const [edge] = toFlowEdges([
      { id: "x:c1", source: "x", target: "y", label: "", is_dangling: false },
    ]);
    expect(edge.label).toBeUndefined();
  });
});

describe("missingNodeId", () => {
  it("namespaces a missing target id so it can never collide with a real page id", () => {
    expect(missingNodeId("gone9")).toBe("missing:gone9");
  });
});

describe("buildMissingNodes", () => {
  const positioned: PositionedNode[] = [
    { id: "a", name: "Start", is_start: true, position: { x: 100, y: 200 } },
  ];

  it("creates a stub node for a dangling edge, labelled and styled as missing", () => {
    const edges: GraphEdge[] = [
      { id: "a:c1", source: "a", target: "gone9", label: "Nowhere", is_dangling: true },
    ];
    const [stub] = buildMissingNodes(edges, positioned, "leads nowhere");
    expect(stub.id).toBe(missingNodeId("gone9"));
    expect(stub.data.label).toBe("leads nowhere");
    expect(stub.className).toContain("story-node--missing");
  });

  it("ignores non-dangling edges entirely", () => {
    const edges: GraphEdge[] = [
      { id: "a:c1", source: "a", target: "b", label: "Go", is_dangling: false },
    ];
    expect(buildMissingNodes(edges, positioned, "leads nowhere")).toHaveLength(0);
  });

  it("deduplicates multiple dangling edges that share the same missing target", () => {
    const edges: GraphEdge[] = [
      { id: "a:c1", source: "a", target: "gone9", label: "One", is_dangling: true },
      { id: "a:c2", source: "a", target: "gone9", label: "Two", is_dangling: true },
    ];
    expect(buildMissingNodes(edges, positioned, "leads nowhere")).toHaveLength(1);
  });

  it("does not let the stub node's size drift from NODE_WIDTH/NODE_HEIGHT", () => {
    const edges: GraphEdge[] = [
      { id: "a:c1", source: "a", target: "gone9", label: "One", is_dangling: true },
    ];
    const [stub] = buildMissingNodes(edges, positioned, "leads nowhere");
    expect(stub.style).toEqual({ width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  it("positions distinct missing targets so they do not stack on top of each other", () => {
    const edges: GraphEdge[] = [
      { id: "a:c1", source: "a", target: "gone9", label: "One", is_dangling: true },
      { id: "a:c2", source: "a", target: "gone8", label: "Two", is_dangling: true },
    ];
    const [first, second] = buildMissingNodes(edges, positioned, "leads nowhere");
    expect(first.position).not.toEqual(second.position);
  });
});

describe("resolveGraphViewMode", () => {
  const graphWithPages: StoryGraph = {
    nodes: [{ id: "a", name: "A", is_start: true, position: null }],
    edges: [],
  };
  const emptyGraph: StoryGraph = { nodes: [], edges: [] };

  it("shows loading before the graph fetch has resolved", () => {
    expect(resolveGraphViewMode({ graph: null, loadError: false })).toBe("loading");
  });

  it("shows the error panel when the graph fetch failed", () => {
    expect(resolveGraphViewMode({ graph: null, loadError: true })).toBe("error");
  });

  it("prioritizes the error panel even if a graph value is somehow also present", () => {
    expect(resolveGraphViewMode({ graph: graphWithPages, loadError: true })).toBe("error");
  });

  it("shows empty only when the fetched graph genuinely has no pages", () => {
    expect(resolveGraphViewMode({ graph: emptyGraph, loadError: false })).toBe("empty");
  });

  // Regression test for a real bug: nodes are mirrored into local React
  // state (`nodes`) via a follow-up effect, one render tick after `graph`
  // itself arrives, because drags need to mutate that state. Deciding
  // "empty" from that lagging state array (instead of from `graph` itself)
  // painted "this story has no pages yet" for one tick on every story that
  // has pages. This function takes no `nodes` array at all, precisely so
  // that lag can't leak into the decision — this test pins that a populated
  // graph reads as "graph" immediately, with nothing else required.
  it("shows the graph as soon as the fetched graph has pages, with no dependency on any other state", () => {
    expect(resolveGraphViewMode({ graph: graphWithPages, loadError: false })).toBe("graph");
  });
});
