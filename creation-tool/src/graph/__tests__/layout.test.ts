import { describe, it, expect } from "vitest";
import type { StoryGraph } from "@fabler/types";
import { layoutGraph, NODE_WIDTH, NODE_HEIGHT } from "../layout";

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

  it("converts dagre's centre coordinate to React Flow's top-left origin", () => {
    // A lone node's centre is dagre's origin plus half its own box, i.e.
    // dagre places it at (NODE_WIDTH / 2, NODE_HEIGHT / 2). Converting that
    // centre to a top-left corner must land exactly on (0, 0) — computed
    // from the constants, not restated as a literal, so this stays correct
    // if the node dimensions ever change.
    const solo: StoryGraph = {
      nodes: [{ id: "solo", name: "Alone", is_start: true, position: null }],
      edges: [],
    };
    const { nodes } = layoutGraph(solo);
    const expected = {
      x: NODE_WIDTH / 2 - NODE_WIDTH / 2,
      y: NODE_HEIGHT / 2 - NODE_HEIGHT / 2,
    };
    expect(nodes[0].position).toEqual(expected);
    expect(nodes[0].position).toEqual({ x: 0, y: 0 });
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

  it("mixes saved and auto-laid-out positions in one graph", () => {
    // The core "auto-layout with manual override" promise: some pages carry
    // an author-chosen position, others don't, and each must be handled by
    // its own path rather than one clobbering the other.
    const g: StoryGraph = {
      nodes: [
        { id: "a", name: "Start", is_start: true, position: { x: 111, y: 222 } },
        { id: "b", name: "Middle", is_start: false, position: null },
        { id: "c", name: "End", is_start: false, position: { x: 333, y: 444 } },
        { id: "d", name: "Also new", is_start: false, position: null },
      ],
      edges: [
        { id: "a:c1", source: "a", target: "b", label: "Go", is_dangling: false },
        { id: "b:c1", source: "b", target: "c", label: "Go", is_dangling: false },
        { id: "b:c2", source: "b", target: "d", label: "Go", is_dangling: false },
      ],
    };

    const { nodes } = layoutGraph(g);
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

    // Saved nodes keep their exact saved coordinates.
    expect(byId.a.position).toEqual({ x: 111, y: 222 });
    expect(byId.c.position).toEqual({ x: 333, y: 444 });

    const savedPositions = [byId.a.position, byId.c.position];

    // Unsaved nodes got a real, finite, laid-out position — not a default,
    // and not accidentally equal to a saved node's coordinates.
    for (const id of ["b", "d"]) {
      const pos = byId[id].position;
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
      for (const saved of savedPositions) {
        expect(pos).not.toEqual(saved);
      }
    }
  });
});
