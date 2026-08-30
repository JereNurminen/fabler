import { describe, it, expect } from "vitest";
import type { GraphEdge, Problem } from "@fabler/types";
import type { PositionedNode } from "../layout";
import { NODE_WIDTH, NODE_HEIGHT } from "../layout";
import { severityByPage, toFlowNodes, toFlowEdges } from "../StoryGraphView";

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

  it("drops dangling edges rather than handing React Flow an unroutable target", () => {
    const flowEdges = toFlowEdges(edges);
    expect(flowEdges).toHaveLength(1);
    expect(flowEdges[0].id).toBe("a:c1");
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
