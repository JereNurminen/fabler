# Story graph view — design

Date: 2026-08-26
Status: approved for implementation

## Problem

There is no way to see a story's shape. Authors navigate a flat, alphabetical
page list and hold the branching structure in their heads. Validation can now
tell them a page is unreachable, but not *why*, or what it should have
connected to.

## Goals

- Render pages as nodes and choices as edges, at a few hundred pages.
- Click a node to open that page in the editor.
- Surface existing validation problems in place — broken edges, greyed
  unreachable pages — rather than inventing a second analysis.
- Let authors arrange the map, and remember where they put things.

## Non-goals

- **Editing story content from the graph.** No creating or deleting choices,
  no retargeting by dragging an edge, no inline text editing. Positions are
  the only thing the graph writes. This is what keeps the feature small:
  no mutation plumbing, no optimistic-update conflicts, no undo design.
- Reader-side anything. The graph is an authoring tool.
- Migration handling. There are no stories in the wild.

## Architecture

### Editor metadata on the page, stripped at export

`Page` gains an optional `editor` field — a general home for authoring-only
state, of which node position is the first occupant:

```rust
pub struct EditorMetadata {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position: Option<Position>,
}

pub struct Position { pub x: f64, pub y: f64 }

// on Page:
#[serde(default, skip_serializing_if = "Option::is_none")]
pub editor: Option<EditorMetadata>,
```

`build_manifest` clears it, so `.fabler` bundles never carry authoring state
to readers. `skip_serializing_if` means the field vanishes entirely rather
than serialising as `null`.

A sibling `layout.json` was considered and rejected: a general metadata slot
on the entity is reusable for the next authoring-only field, and "stripped at
export" addresses the objection that motivated the alternative.

No migration is needed. `#[serde(default)]` means existing `story.json` files
load with `editor: None`, and there are no stories in the wild regardless.

### Positions are cosmetic, and the code should treat them that way

A lost position is a visual annoyance; a lost page edit is data loss. So
position writes are debounced and fire-and-forget — they report failure
through the existing save-status indicator like any other write, but nothing
blocks on them and no dialog interrupts the drag.

### Graph data comes from the backend

A new `get_story_graph` command returns nodes and edges, mirroring
`validate_story`. Server-side because the frontend holds only `{id, name}` per
page; building the graph client-side would mean fetching every page over IPC.
Rust already reads them all via `Project::read_all_pages`.

```rust
pub struct StoryGraph {
    pub nodes: Vec<GraphNode>,   // id, name, is_start, position: Option<Position>
    pub edges: Vec<GraphEdge>,   // id, source, target, label, is_dangling
}
```

`is_dangling` marks an edge whose target does not exist. Those edges have no
node to point at, so React Flow cannot route them — the graph renders them as
stubs ending in a marker rather than dropping them silently, because a
dangling choice the author cannot see is the problem they most need to see.

### Layout

`dagre` computes a layered top-to-bottom layout for any node without a saved
position; nodes with one keep it. Layered rather than force-directed because
stories flow from a start page, so depth reads as narrative distance. Dagre
breaks cycles automatically, which matters — story graphs loop.

### Problem overlay reuses validation

The existing `validate_story` supplies the annotations: pages carrying an
error render with a red border, `unreachable_page` warnings render greyed.
No second analysis, and the graph stays consistent with the problems panel
by construction.

### Placement

A full-screen overlay opened from the sidebar, mirroring `PlaytestView` —
the graph needs more canvas than any other view here, and the pattern already
exists. Clicking a node closes the overlay and routes to that page.

## Testing

- Rust: `get_story_graph` builds correct nodes and edges; `is_dangling` set
  for a choice pointing at a deleted page; `build_manifest` strips `editor`;
  `Page` round-trips with and without the field.
- TS unit: the dagre-layout helper places unpositioned nodes and preserves
  saved ones.
- E2E: open the overlay, see a node per page, click through to a page,
  confirm a dangling choice renders as a stub.

Position persistence is deliberately not e2e-tested — driving React Flow drag
in Playwright is slow and brittle, and the failure mode is cosmetic.

## Risk

React Flow is the first visualisation dependency in a lean codebase. It is
carrying pan, zoom, drag, selection and edge routing — hand-rolling those is
where the schedule would go. At a few hundred nodes its SVG renderer is
comfortably within range.
