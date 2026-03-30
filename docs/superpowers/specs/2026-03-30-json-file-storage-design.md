# JSON File Storage Migration — Design Spec

## Overview

Replace SQLite with a file-based project format. Each story is a directory containing a `.story.json` metadata file, individual `.page.json` files per page, and an `assets/` directory for images. All IDs are 5-character hex strings. The creation tool opens one project at a time, selected via a file dialog.

## Directory Structure

```
my-story/
├── my-story.story.json
├── pages/
│   ├── a3f2b-entrance.page.json
│   └── b7c1d-dark-tunnel.page.json
└── assets/
    └── hero.png
```

### `.story.json`

```json
{
  "format_version": 1,
  "title": "The Dark Cave",
  "start_page": "a3f2b",
  "flags": [
    { "id": "f1a2c", "name": "has_torch", "default_value": false }
  ]
}
```

- `format_version` — for future migrations between story format versions.
- `start_page` — 5-char hex ID referencing a page.
- `flags` — story-wide boolean flags. Each has a 5-char hex `id`, `name`, and `default_value`.

### `.page.json`

```json
{
  "id": "a3f2b",
  "name": "Entrance",
  "body": "You stand at the mouth of a dark cave.",
  "choices": [
    {
      "id": "c1b3e",
      "text": "Enter the cave",
      "target": "b7c1d",
      "flag_operations": [],
      "conditions": []
    }
  ],
  "flag_operations": []
}
```

- The `id` field inside the JSON is authoritative.
- The filename follows the pattern `{id}-{slugified-name}.page.json`. The name portion is cosmetic — renaming a page updates the filename for readability, but references use the `id`.
- `body` is a plain string for now. Will become rich text JSON in a future spec.
- `choices[].target` references a page ID.
- `choices[].flag_operations` and `choices[].conditions` use flag IDs from `story.json`.

### `assets/`

Loose image files. Referenced by filename from page content (relevant once rich text with images is added).

## ID Scheme

All IDs are 5-character lowercase hex strings (e.g. `a3f2b`), generated randomly. This gives ~1 million unique values — more than enough for any story. On collision (checked at creation time), regenerate.

IDs are used for: pages, choices, flags. They are stable — renaming a page changes the filename but not its ID.

## Rust Data Types

### Shared crate (`shared/src/models.rs`) — rewritten

```rust
pub struct Story {
    pub format_version: u32,
    pub title: String,
    pub start_page: String,
    pub flags: Vec<Flag>,
}

pub struct Flag {
    pub id: String,
    pub name: String,
    pub default_value: bool,
}

pub struct Page {
    pub id: String,
    pub name: String,
    pub body: String,
    pub choices: Vec<Choice>,
    pub flag_operations: Vec<FlagOperation>,
}

pub struct Choice {
    pub id: String,
    pub text: String,
    pub target: String,
    pub flag_operations: Vec<FlagOperation>,
    pub conditions: Vec<Condition>,
}

pub struct FlagOperation {
    pub flag_id: String,
    pub operation: String,
}

pub struct Condition {
    pub flag_id: String,
    pub required_value: bool,
}

pub struct PageListItem {
    pub id: String,
    pub name: String,
}
```

Key changes from current types:
- All IDs are `String` (5-char hex) instead of `i64`.
- `Choice.target` instead of `target_page`.
- `Condition` instead of `ChoiceCondition` — simpler name, no `id` field.
- `FlagOperation` drops the `id` field.
- No back-references (`story_id`, `page_id`) — parent is implicit from the file.
- These types are nearly identical to the bundle manifest types, making export conversion trivial.

### Shared crate dependencies — simplified

Remove: `sqlx`, `chrono`, `specta`, `specta-typescript`, `tauri-specta`, `ts-rs`, `tauri`.

Keep: `serde`, `serde_json`, `zip`, `thiserror`.

The shared crate becomes pure data types + serde + bundle packing. No Tauri dependency.

## Creation Tool Backend

### Project module (`creation-tool/src-tauri/src/project/`)

Replaces the `db/` module entirely. A `Project` struct holds the path to the project directory and provides file I/O operations.

```
Project::open(story_json_path) → Project   // reads .story.json, validates
Project::create(dir_path, title) → Project // creates directory structure

project.story() → &Story                  // cached in memory
project.save_story(story) → ()            // writes .story.json

project.list_pages() → Vec<PageListItem>  // reads filenames, extracts id + name
project.read_page(id) → Page              // reads one .page.json
project.save_page(page) → ()              // writes .page.json, renames file if name changed
project.create_page(name) → Page          // generates ID, creates file
project.delete_page(id) → ()              // removes file

project.export_bundle(output_path) → ()   // zip into .fabler
project.import_bundle(fabler_path) → ()   // unzip .fabler into project
```

The `Project` struct caches `story.json` in memory (it's small — metadata + flags only). Page files are read on demand, matching the current lazy-loading pattern via `pageAtomFamily`.

### Tauri Commands

```
// Project lifecycle
open_project(path: String) → Story
create_project(path: String, title: String) → Story
close_project()

// Pages
list_pages() → Vec<PageListItem>
get_page(id: String) → Page
save_page(page: Page) → ()
create_page(name: String) → Page
delete_page(id: String) → ()

// Story metadata & flags
save_story(story: Story) → ()

// Export
export_bundle(output_path: String) → ()
```

Simplification vs current commands: flags, flag operations, and conditions are no longer separate endpoints. They are part of the `Page` or `Story` JSON — the frontend reads the whole object, modifies it, writes it back. This eliminates ~10 current Tauri commands.

## Frontend Changes

### App flow

- The app opens with a "New Project" / "Open Project" dialog instead of a story list.
- "Open Project" filters for `*.story.json` files. The app derives the project directory from the selected file's parent path.
- Once a project is open, the editor works the same as before.

### State management (Jotai atoms)

- `currentStoryIdAtom` → `currentProjectAtom` (holds story metadata from the opened project).
- `pageAtomFamily(id)` still lazy-loads page content by ID — same pattern.
- `allPagesAtom` derives from `list_pages()` command.
- `storyFlagsAtom` derives from `currentProjectAtom.flags`.
- `patchPage` → `savePage` — sends the complete `Page` object, not a partial patch.
- Flag management edits the `Story` object and calls `save_story`.

### API layer

The `api.ts` / `api-http.ts` dual-mode pattern stays for E2E testing. The HTTP API endpoints change to match the new commands.

### Removed UI

- Start page (story list) → replaced by open/create project flow.
- Debug menu "Reset database" → removed.

## Bundle Export & Reader

### Export

1. Read `.story.json` + all `.page.json` files.
2. Merge into a single `manifest.json` (story metadata + all pages inline).
3. Copy `assets/` directory.
4. Zip into `.fabler`.

The bundle format (manifest.json + assets/) is unchanged. The reader is unaffected.

### Import (opening .fabler in creation tool)

Unzip, split the single manifest into `.story.json` + individual `.page.json` files. Reverse of export.

### Bundle size

A LOTR-length story (~575,000 words, ~2,000 pages) produces a ~4 MB manifest. Trivial for any device. Images are separate files loaded on demand.

## What Gets Removed

- `creation-tool/src-tauri/migrations/` — all SQL migration files.
- `creation-tool/src-tauri/src/db/` — entire module.
- `creation-tool/src-tauri/src/schema.rs` — TOML schema generator.
- `creation-tool/src-tauri/src/app/setup.rs` — SQLite setup.
- `creation-tool/src-tauri/src/models/` — patch/create models (no longer needed with full-object saves).
- `creation-tool/src/bindings.ts` — auto-generated types, replaced by hand-written types.
- `creation-tool/src/pages/StartPage.tsx` — story list, replaced by open/create flow.
- SQLite dependencies from both `creation-tool/src-tauri/Cargo.toml` and `shared/Cargo.toml`.
- Type generation dependencies from `shared/Cargo.toml` (`specta`, `tauri-specta`, `ts-rs`, etc.).
- Debug menu "Reset database" entry.
