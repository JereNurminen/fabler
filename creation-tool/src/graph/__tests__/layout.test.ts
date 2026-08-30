import { describe, it, expect } from "vitest";
import type { StoryGraph } from "@fabler/types";
import { layoutGraph } from "../layout";

const graph = (over: Partial<StoryGraph> = {}): StoryGraph => ({
  nodes: [
    { id: "a", name: "Start", is_start: true, position: null },
    { id: "b", name: "Next", is_start: false, position: null },
  ],
  edges: [
    { id: "a:c1", source: "a", target: "b", label: "Go", is_dangling: false },
  ],
  ...over,
});

describe("layoutGraph", () => {
  it("assigns a position to every unpositioned node", () => {
    const { nodes } = layoutGraph(graph());
    expect(nodes).toHaveLength(2);
    for (const n of nodes) {
      expect(Number.isFinite(n.position.x)).toBe(true);
      expect(Number.isFinite(n.position.y)).toBe(true);
    }
  });

  it("keeps an author-placed position exactly", () => {
    // An author who moved a node must find it where they left it.
    const g = graph();
    g.nodes[1].position = { x: 123, y: 456 };
    const { nodes } = layoutGraph(g);
    const b = nodes.find((n) => n.id === "b");
    expect(b?.position).toEqual({ x: 123, y: 456 });
  });

  it("lays the start page above what it leads to", () => {
    const { nodes } = layoutGraph(graph());
    const a = nodes.find((n) => n.id === "a");
    const b = nodes.find((n) => n.id === "b");
    expect(a!.position.y).toBeLessThan(b!.position.y);
  });

  it("terminates on a cycle", () => {
    const g = graph({
      edges: [
        { id: "a:c1", source: "a", target: "b", label: "Go", is_dangling: false },
        { id: "b:c2", source: "b", target: "a", label: "Back", is_dangling: false },
      ],
    });
    const { nodes } = layoutGraph(g);
    expect(nodes).toHaveLength(2);
  });

  it("does not try to lay out a dangling edge's phantom target", () => {
    // `gone9` is not a node; feeding it to dagre would invent one.
    const g = graph({
      edges: [
        { id: "a:c1", source: "a", target: "gone9", label: "Go", is_dangling: true },
      ],
    });
    const { nodes } = layoutGraph(g);
    expect(nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });
});
