# Story Graph View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-screen map of the story — pages as nodes, choices as edges — that authors can arrange, with validation problems shown in place.

**Architecture:** `Page` gains an optional `editor` metadata field (position lives there) which `build_manifest` strips from exported bundles. A `get_story_graph` command returns nodes and edges. React Flow renders; dagre lays out anything without a saved position. Story content is read-only in the graph — positions are the only thing it writes.

**Tech Stack:** Rust, ts-rs, Tauri commands, React 18, `@xyflow/react`, `dagre`, Jotai, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-26-graph-view-design.md`

## Global Constraints

- Types crossing into TypeScript are GENERATED. Never hand-write a mirror; add `#[derive(TS)]` with `#[ts(export, export_to = "../../types/src/")]` and run `yarn codegen`. CI fails on stale or orphaned generated files.
- All user-facing strings live in `creation-tool/src/i18n/translations.ts`.
- eslint is at 0 errors / 0 warnings with `no-floating-promises` and `no-misused-promises` as ERRORS. Async event handlers go through `useTrackedAction`.
- The graph never mutates story content — no choice creation, deletion or retargeting. Positions only.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings` are CI gates and are clean.
- Run `yarn verify` from the repo root before each commit.

---

### Task 1: Editor metadata on `Page`, stripped at export

**Files:** `shared/src/models.rs`, `shared/src/bundle.rs`

**Produces:** `EditorMetadata`, `Position`, `Page.editor`

- [ ] **Step 1: Write the failing tests**

Add to `shared/src/bundle.rs`'s test module:

```rust
    #[test]
    fn build_manifest_strips_editor_metadata() {
        // Authoring state must never reach a reader's bundle.
        let mut pages = sample_pages();
        pages[0].editor = Some(crate::models::EditorMetadata {
            position: Some(crate::models::Position { x: 10.0, y: 20.0 }),
        });

        let manifest = build_manifest(&sample_story(), pages);

        assert!(manifest.pages.iter().all(|p| p.editor.is_none()));
        let json = serde_json::to_string(&manifest).unwrap();
        assert!(!json.contains("editor"), "bundle must not mention editor state: {json}");
    }
```

Add to `shared/src/models.rs`'s test module:

```rust
    #[test]
    fn page_without_editor_metadata_round_trips() {
        // Existing story.json files have no `editor` key at all.
        let json = r#"{"id":"a1b2c","name":"Start","body":{"content":[]},"choices":[],"flag_operations":[]}"#;
        let page: Page = serde_json::from_str(json).unwrap();
        assert!(page.editor.is_none());

        // And a page without it must not write the key back.
        let out = serde_json::to_string(&page).unwrap();
        assert!(!out.contains("editor"), "absent metadata must stay absent: {out}");
    }

    #[test]
    fn page_with_position_round_trips() {
        let mut page = Page {
            id: "a1b2c".into(),
            name: "Start".into(),
            body: Document::empty(),
            choices: vec![],
            flag_operations: vec![],
            editor: None,
        };
        page.editor = Some(EditorMetadata {
            position: Some(Position { x: 1.5, y: -2.5 }),
        });

        let parsed: Page = serde_json::from_str(&serde_json::to_string(&page).unwrap()).unwrap();
        let pos = parsed.editor.unwrap().position.unwrap();
        assert_eq!((pos.x, pos.y), (1.5, -2.5));
    }
```

- [ ] **Step 2: Run to verify they fail**

Run: `cargo test -p shared`
Expected: compile error — no field `editor` on `Page`.

- [ ] **Step 3: Add the types**

In `shared/src/models.rs`:

```rust
/// Authoring-only state attached to a page. Never reaches a reader:
/// `build_manifest` clears it when packing a bundle.
///
/// This is a general slot, not a position field with extra steps — the next
/// authoring-only concern (collapsed state, colour tags) belongs here too.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct EditorMetadata {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position: Option<Position>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct Position {
    pub x: f64,
    pub y: f64,
}
```

And on `Page`, after `flag_operations`:

```rust
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub editor: Option<EditorMetadata>,
```

Every `Page { .. }` literal in the workspace now needs `editor: None`. `cargo test` will enumerate them.

In `shared/src/bundle.rs`, change `build_manifest` to strip:

```rust
pub fn build_manifest(story: &crate::models::Story, pages: Vec<Page>) -> Manifest {
    // Authoring state is not part of the published story.
    let pages = pages
        .into_iter()
        .map(|mut p| {
            p.editor = None;
            p
        })
        .collect();

    Manifest { /* unchanged */ }
}
```

- [ ] **Step 4: Regenerate and verify**

Run: `yarn codegen` — expect 23 files in `types/src/` (21 + `EditorMetadata` + `Position`).
Run: `cargo test --workspace`, `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, then `yarn verify`.

- [ ] **Step 5: Commit**

```bash
git add shared types creation-tool reader
git commit -m "feat(shared): add authoring-only editor metadata to Page"
```

---

### Task 2: The `get_story_graph` command

**Files:** `shared/src/graph.rs` (new), `shared/src/lib.rs`, `creation-tool/src-tauri/src/project/mod.rs`, `commands.rs`, `main.rs`, `test_server.rs`, `creation-tool/src/api.ts`

**Produces:** `StoryGraph`, `GraphNode`, `GraphEdge`; `api.getStoryGraph()`

- [ ] **Step 1: Write the failing test**

Create `shared/src/graph.rs` with only its test module:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::Document;
    use crate::models::{Choice, Page, Story};

    fn page(id: &str, name: &str, choices: Vec<Choice>) -> Page {
        Page {
            id: id.into(),
            name: name.into(),
            body: Document::empty(),
            choices,
            flag_operations: vec![],
            editor: None,
        }
    }

    fn choice(id: &str, text: &str, target: &str) -> Choice {
        Choice {
            id: id.into(),
            text: text.into(),
            target: target.into(),
            flag_operations: vec![],
            conditions: vec![],
        }
    }

    fn story(start: &str) -> Story {
        Story {
            format_version: 1,
            id: "s1a2b".into(),
            title: "T".into(),
            start_page: start.into(),
            flags: vec![],
        }
    }

    #[test]
    fn builds_a_node_per_page_and_an_edge_per_choice() {
        let pages = vec![
            page("aaa11", "Start", vec![choice("c1", "Go", "bbb22")]),
            page("bbb22", "End", vec![]),
        ];
        let graph = build_graph(&story("aaa11"), &pages);

        assert_eq!(graph.nodes.len(), 2);
        assert_eq!(graph.edges.len(), 1);
        assert_eq!(graph.edges[0].source, "aaa11");
        assert_eq!(graph.edges[0].target, "bbb22");
        assert_eq!(graph.edges[0].label, "Go");
        assert!(!graph.edges[0].is_dangling);
    }

    #[test]
    fn marks_the_start_page() {
        let pages = vec![page("aaa11", "Start", vec![]), page("bbb22", "Other", vec![])];
        let graph = build_graph(&story("bbb22"), &pages);

        let start: Vec<&str> = graph
            .nodes
            .iter()
            .filter(|n| n.is_start)
            .map(|n| n.id.as_str())
            .collect();
        assert_eq!(start, vec!["bbb22"]);
    }

    #[test]
    fn flags_an_edge_whose_target_is_missing() {
        // The author most needs to see the connection that goes nowhere,
        // so it must survive into the graph rather than be filtered out.
        let pages = vec![page("aaa11", "Start", vec![choice("c1", "Go", "gone9")])];
        let graph = build_graph(&story("aaa11"), &pages);

        assert_eq!(graph.edges.len(), 1);
        assert!(graph.edges[0].is_dangling);
        assert_eq!(graph.edges[0].target, "gone9");
    }

    #[test]
    fn carries_saved_positions_through() {
        let mut pages = vec![page("aaa11", "Start", vec![])];
        pages[0].editor = Some(crate::models::EditorMetadata {
            position: Some(crate::models::Position { x: 3.0, y: 4.0 }),
        });
        let graph = build_graph(&story("aaa11"), &pages);

        let pos = graph.nodes[0].position.unwrap();
        assert_eq!((pos.x, pos.y), (3.0, 4.0));
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cargo test -p shared graph`
Expected: cannot find `build_graph`.

- [ ] **Step 3: Implement**

Prepend to `shared/src/graph.rs`:

```rust
use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::models::{Page, Position, Story};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct GraphNode {
    pub id: String,
    pub name: String,
    pub is_start: bool,
    /// Author-placed position, if any. Absent nodes get an automatic layout.
    pub position: Option<Position>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct GraphEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub label: String,
    /// True when `target` names no existing page. Kept rather than dropped:
    /// a choice that leads nowhere is exactly what the author needs to see.
    pub is_dangling: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct StoryGraph {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

pub fn build_graph(story: &Story, pages: &[Page]) -> StoryGraph {
    let ids: HashSet<&str> = pages.iter().map(|p| p.id.as_str()).collect();

    let nodes = pages
        .iter()
        .map(|p| GraphNode {
            id: p.id.clone(),
            name: p.name.clone(),
            is_start: p.id == story.start_page,
            position: p.editor.as_ref().and_then(|e| e.position),
        })
        .collect();

    let edges = pages
        .iter()
        .flat_map(|p| {
            p.choices.iter().map(move |c| GraphEdge {
                id: format!("{}:{}", p.id, c.id),
                source: p.id.clone(),
                target: c.target.clone(),
                label: c.text.clone(),
                is_dangling: !ids.contains(c.target.as_str()),
            })
        })
        .collect();

    StoryGraph { nodes, edges }
}
```

Add `pub mod graph;` to `shared/src/lib.rs` (alphabetical: after `content`).

- [ ] **Step 4: Wire the command**

Follow the six-step checklist in `CLAUDE.md`:

`Project` method in `creation-tool/src-tauri/src/project/mod.rs`:

```rust
    /// Build the page/choice graph for the story map.
    pub fn story_graph(&self) -> AppResult<shared::graph::StoryGraph> {
        let story = self.story();
        let pages = self.read_all_pages()?;
        Ok(shared::graph::build_graph(&story, &pages))
    }
```

Command in `commands.rs`:

```rust
#[tauri::command]
pub fn get_story_graph(state: State<ProjectState>) -> Result<shared::graph::StoryGraph, String> {
    with_project(&state, |p| p.story_graph())
}
```

Register in `main.rs`'s `invoke_handler`. Add a `test_server.rs` arm:

```rust
            "get_story_graph" => project
                .story_graph()
                .map(|g| json!(g))
                .map_err(|e| e.to_string()),
```

Add to BOTH builders in `creation-tool/src/api.ts`:

```typescript
    getStoryGraph: () => call<StoryGraph>("get_story_graph"),      // http
    getStoryGraph: () => invoke<StoryGraph>("get_story_graph"),    // tauri
```

importing `StoryGraph` from `@fabler/types`. No `types.ts` edit — step 6 of the checklist is `yarn codegen`.

- [ ] **Step 5: Verify**

Run: `yarn codegen` (expect 26 files: 23 + `GraphNode`, `GraphEdge`, `StoryGraph`), `cargo test --workspace`, `cargo build -p creation-tool --features test-server`, `yarn verify`.

- [ ] **Step 6: Commit**

```bash
git add shared types creation-tool
git commit -m "feat(graph): add get_story_graph command"
```

---

### Task 3: Layout helper

**Files:** `creation-tool/package.json`, `creation-tool/src/graph/layout.ts` (new), `creation-tool/src/graph/__tests__/layout.test.ts` (new)

**Produces:** `layoutGraph(graph): { nodes: PositionedNode[]; edges: GraphEdge[] }`

- [ ] **Step 1: Install**

```bash
cd creation-tool
yarn add @xyflow/react dagre
yarn add -D @types/dagre
```

- [ ] **Step 2: Write the failing test**

Create `creation-tool/src/graph/__tests__/layout.test.ts`:

```typescript
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
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd creation-tool && npx vitest run layout`
Expected: cannot resolve `../layout`.

- [ ] **Step 4: Implement**

Create `creation-tool/src/graph/layout.ts`:

```typescript
import dagre from "dagre";
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
    const laid = g.node(node.id);
    return {
      ...node,
      // dagre reports centres; React Flow wants top-left.
      position: { x: laid.x - NODE_WIDTH / 2, y: laid.y - NODE_HEIGHT / 2 },
    };
  });

  return { nodes, edges: graph.edges };
}
```

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run` (expect 34 + 5), `npx tsc --noEmit`, `npx eslint .` (0/0), `yarn verify`.

```bash
git add creation-tool package.json yarn.lock
git commit -m "feat(graph): lay out the story map with dagre"
```

---

### Task 4: The graph overlay

**Files:** `creation-tool/src/graph/StoryGraphView.tsx` (new), `creation-tool/src/graph/graph.css` (new), `creation-tool/src/i18n/translations.ts`, `creation-tool/src/pages/StoryEditorPage.tsx`, `creation-tool/src/components/layout/Sidebar.tsx`, `creation-tool/src/components/layout/BottomBar.tsx`, `creation-tool/src/components/layout/EditorChromeContext.tsx`

**Consumes:** `layoutGraph`, `api.getStoryGraph`, `api.validateStory`

- [ ] **Step 1: Translations**

Add to `translations.ts`, before `dynamic`:

```typescript
  // Story map
  graph: {
    title: "Story map",
    close: "Close map",
    loading: "Loading story map…",
    empty: "This story has no pages yet",
    danglingTarget: "leads nowhere",
  },
```

And to `buttons`: `storyMap: "Story map",`

- [ ] **Step 2: The view**

Create `creation-tool/src/graph/StoryGraphView.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Problem, StoryGraph } from "@fabler/types";
import api from "../api";
import { useTranslation } from "../i18n";
import { getLinkToPage } from "../utilities/routing";
import { layoutGraph } from "./layout";
import "./graph.css";

interface StoryGraphViewProps {
  onClose: () => void;
}

/** Worst severity affecting each page, for node styling. */
function severityByPage(problems: Problem[]): Map<string, "error" | "warning"> {
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

export function StoryGraphView({ onClose }: StoryGraphViewProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [graph, setGraph] = useState<StoryGraph | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);

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
    const severity = severityByPage(problems);
    setNodes(
      laidOut.nodes.map((n) => ({
        id: n.id,
        position: n.position,
        data: { label: n.name || n.id },
        className: [
          "story-node",
          n.is_start && "story-node--start",
          severity.get(n.id) === "error" && "story-node--error",
          severity.get(n.id) === "warning" && "story-node--warning",
        ]
          .filter(Boolean)
          .join(" "),
      })),
    );
  }, [laidOut, problems]);

  const edges: Edge[] = useMemo(
    () =>
      (laidOut?.edges ?? [])
        // A dangling edge has no node to end at; React Flow cannot route it.
        // Task 5 renders these as stubs — for now they are omitted rather
        // than crashing the renderer.
        .filter((e) => !e.is_dangling)
        .map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label || undefined,
        })),
    [laidOut],
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const openPage = useCallback(
    (_: unknown, node: Node) => {
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
```

Import `applyNodeChanges` from `@xyflow/react` alongside the others — verify the export exists in the installed version before relying on it.

- [ ] **Step 3: Node styling**

Create `creation-tool/src/graph/graph.css`:

```css
.story-node {
  width: 180px;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  font-size: 12px;
}
.story-node--start { border-color: #4f46e5; border-width: 2px; }
.story-node--error { border-color: #dc2626; background: #fef2f2; }
.story-node--warning { opacity: 0.55; border-style: dashed; }
```

- [ ] **Step 4: Wire it in**

Add `onOpenGraph: () => void` to `EditorChrome` in `EditorChromeContext.tsx`. Provide it from `StoryEditorPage` (a `graphOpen` state, mirroring `playtestOpen`), and render `{graphOpen && <StoryGraphView onClose={() => setGraphOpen(false)} />}` next to `PlaytestView`.

Add a button to `Sidebar`'s header beside Playtest, and to `BottomBar`'s icon row, both labelled `t.buttons.storyMap`.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit`, `npx eslint .` (0/0), `npx vitest run`, `yarn build`, `yarn test:e2e` (18 — unchanged), `yarn verify`.

```bash
git add creation-tool
git commit -m "feat(graph): add the story map overlay"
```

---

### Task 5: Persist positions, render dangling edges

**Files:** `creation-tool/src/graph/StoryGraphView.tsx`, `creation-tool/src/graph/usePositionPersistence.ts` (new), `creation-tool/src/api.ts` if needed

- [ ] **Step 1: Persist on drag end**

Create `creation-tool/src/graph/usePositionPersistence.ts`:

```typescript
import { useCallback, useRef } from "react";
import type { Node } from "@xyflow/react";
import api from "../api";
import { useTrackedAction } from "../hooks/useTrackedAction";

/** Coalesce rapid drags into one write per page. */
const DEBOUNCE_MS = 500;

/**
 * Save a node's position back onto its page.
 *
 * Positions are cosmetic — losing one is an annoyance, not data loss — so
 * this is debounced and fire-and-forget. It still reports failure through
 * the shared save-status indicator like any other write, but nothing blocks
 * on it and no dialog interrupts a drag.
 */
export function usePositionPersistence() {
  const timers = useRef(new Map<string, number>());

  const persist = useTrackedAction(async (pageId: string, x: number, y: number) => {
    const page = await api.getPage(pageId);
    await api.savePage({
      ...page,
      editor: { ...(page.editor ?? {}), position: { x, y } },
    });
  });

  return useCallback(
    (node: Node) => {
      const existing = timers.current.get(node.id);
      if (existing) window.clearTimeout(existing);
      timers.current.set(
        node.id,
        window.setTimeout(() => {
          timers.current.delete(node.id);
          persist(node.id, node.position.x, node.position.y);
        }, DEBOUNCE_MS),
      );
    },
    [persist],
  );
}
```

Wire it into `StoryGraphView` as React Flow's `onNodeDragStop={(_, node) => savePosition(node)}`.

- [ ] **Step 2: Render dangling edges as stubs**

Replace the `.filter((e) => !e.is_dangling)` in `StoryGraphView` with logic that keeps them: for each dangling edge, add a synthetic node `id: \`missing:${edge.target}\`` labelled with `t.graph.danglingTarget`, styled `.story-node--missing`, and point the edge at it. A choice that leads nowhere is the thing the author most needs to see; filtering it out defeats the point of the map.

Add to `graph.css`:

```css
.story-node--missing {
  border-style: dashed;
  border-color: #dc2626;
  background: #fef2f2;
  color: #991b1b;
  font-style: italic;
}
```

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit`, `npx eslint .` (0/0), `yarn build`, `yarn verify`.

```bash
git add creation-tool
git commit -m "feat(graph): persist node positions, show dangling choices"
```

---

### Task 6: End-to-end coverage

**Files:** `creation-tool/e2e/graph.spec.ts` (new), `creation-tool/e2e/helpers.ts`

- [ ] **Step 1: Write the spec**

Create `creation-tool/e2e/graph.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import {
  resetProject,
  createPageViaApi,
  getPageViaApi,
  savePageViaApi,
  listPagesViaApi,
  navigateToEditor,
} from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetProject(request);
});

async function linkStartTo(request: APIRequestContext, target: string) {
  const pages = await listPagesViaApi(request);
  const start = await getPageViaApi(request, pages[0].id);
  start.choices.push({
    id: "clink",
    text: "Go",
    target,
    flag_operations: [],
    conditions: [],
  });
  await savePageViaApi(request, start);
  return start;
}

test.describe("Story map", () => {
  test("renders a node for each page", async ({ page, request }) => {
    await createPageViaApi(request, "Second");
    await navigateToEditor(page);

    await page.getByRole("button", { name: /story map/i }).click();

    const map = page.getByTestId("story-graph");
    await expect(map).toBeVisible();
    await expect(map.locator(".story-node")).toHaveCount(2);
  });

  test("clicking a node opens that page", async ({ page, request }) => {
    const second = await createPageViaApi(request, "Second");
    await navigateToEditor(page);

    await page.getByRole("button", { name: /story map/i }).click();
    await page.getByTestId("story-graph").getByText("Second").click();

    await expect(page).toHaveURL(new RegExp(`/editor/page/${second.id}$`));
    await expect(page.getByTestId("story-graph")).toHaveCount(0);
  });

  test("a choice leading nowhere is visible on the map", async ({ page, request }) => {
    // The whole point of the map is seeing structure that is wrong.
    await linkStartTo(request, "gone9");
    await navigateToEditor(page);

    await page.getByRole("button", { name: /story map/i }).click();

    await expect(
      page.getByTestId("story-graph").locator(".story-node--missing"),
    ).toHaveCount(1);
  });

  test("closing returns to the editor", async ({ page }) => {
    await navigateToEditor(page);
    await page.getByRole("button", { name: /story map/i }).click();
    await page.getByRole("button", { name: /close map/i }).click();
    await expect(page.getByTestId("story-graph")).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run and verify**

Run: `cd creation-tool && yarn test:e2e` — expect 22 (18 + 4).

If a test fails on React Flow not having rendered, prefer `await expect(...).toBeVisible()` on the container before asserting counts, rather than adding a fixed `waitForTimeout`.

- [ ] **Step 3: Prove the dangling test bites**

Temporarily restore the `.filter((e) => !e.is_dangling)` from Task 4 in `StoryGraphView`, re-run `yarn test:e2e --grep "leading nowhere"`, and CONFIRM IT FAILS. Restore and confirm it passes. Paste both outputs into your report.

- [ ] **Step 4: Full verification and commit**

Run `yarn verify` from the repo root, `yarn test:e2e` from `creation-tool/`, `npx playwright test` from `player/`.

```bash
git add creation-tool
git commit -m "test(graph): cover the story map end to end"
```

---

## Self-Review Notes

**Spec coverage.** Editor metadata + export stripping → Task 1. `get_story_graph` incl. `is_dangling` → Task 2. Dagre layout preserving author positions → Task 3. Overlay, node click, problem overlay → Task 4. Position persistence + dangling stubs → Task 5. E2E → Task 6.

**Known uncertainty.** Task 4 uses `applyNodeChanges` and the `NodeChange` type from `@xyflow/react`; the exact export surface differs between React Flow v11 (`reactflow`) and v12 (`@xyflow/react`). The task says to verify before relying on it. This is flagged rather than hidden.

**Deliberately deferred.** Position persistence is not e2e-tested — driving React Flow drag in Playwright is slow and brittle and the failure mode is cosmetic. Task 5's correctness rests on `useTrackedAction`'s existing tests plus typechecking.
