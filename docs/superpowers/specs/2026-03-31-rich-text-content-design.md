# Rich Text Content — Design Spec

## Overview

Replace the plain-text `body` field on pages with a structured rich text document model. The content is a tree of typed nodes (paragraphs, blockquotes, images, horizontal rules) with inline formatting marks (bold, italic). The creation tool uses TipTap for editing. The player renders the document tree as semantic HTML without any editor dependency. Images are stored as asset files referenced by filename.

## Content Model

### Rust types (`shared/src/content.rs`)

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Document {
    pub content: Vec<Block>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Block {
    Paragraph { #[serde(default)] content: Vec<Inline> },
    Blockquote { content: Vec<Block> },
    Image { src: String, alt: String },
    HorizontalRule,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Inline {
    pub text: String,
    #[serde(default)]
    pub marks: Vec<Mark>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Mark {
    Bold,
    Italic,
}
```

### TypeScript types (`player/engine/types.ts`)

Mirror of the Rust types:

```typescript
interface Document {
    content: Block[];
}

type Block =
    | { type: "paragraph"; content: Inline[] }
    | { type: "blockquote"; content: Block[] }
    | { type: "image"; src: string; alt: string }
    | { type: "horizontal_rule" };

interface Inline {
    text: string;
    marks: Mark[];
}

type Mark = "bold" | "italic";
```

### JSON format

```json
{
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "text": "Hello ", "marks": [] },
        { "text": "world", "marks": ["bold"] }
      ]
    },
    {
      "type": "image",
      "src": "hero.png",
      "alt": "A dark cave entrance"
    },
    { "type": "horizontal_rule" },
    {
      "type": "blockquote",
      "content": [
        {
          "type": "paragraph",
          "content": [{ "text": "A wise quote", "marks": ["italic"] }]
        }
      ]
    }
  ]
}
```

### Page type change

The `Page.body` field changes from `String` to `Document`:

```rust
pub struct Page {
    pub id: String,
    pub name: String,
    pub body: Document,     // was: String
    pub choices: Vec<Choice>,
    pub flag_operations: Vec<FlagOperation>,
}
```

Same change in the TypeScript `Page` and `ManifestPage` types.

### Empty document

A new page starts with an empty document:

```json
{ "content": [{ "type": "paragraph", "content": [] }] }
```

This matches TipTap's default empty state.

## Format Version Migration Framework

The `story.json` has a `format_version` field. When a project is opened, the version is checked. If it's older than the current version, migration functions run sequentially to bring it up to date.

For now this is scaffolding — there are no old-format projects to migrate. The framework is:

```rust
const CURRENT_VERSION: u32 = 1;

fn migrate_project(dir: &Path, from_version: u32) -> Result<()> {
    // Each version bump has a migration function
    // e.g. if from_version < 2 { migrate_v1_to_v2(dir)?; }
    // Currently no migrations needed
    Ok(())
}
```

This runs on `Project::open()` before returning.

## TipTap Editor Integration

### New dependency

Add to `creation-tool/package.json`:
- `@tiptap/react`
- `@tiptap/starter-kit` (provides paragraph, bold, italic, blockquote, horizontal rule)
- `@tiptap/extension-image`

### Editor component (`creation-tool/src/components/RichTextEditor.tsx`)

- Initializes TipTap with the configured extensions
- Toolbar with buttons: **B**, *I*, blockquote, horizontal rule, image
- Image button opens a file picker (Tauri dialog), copies file to project assets, inserts image node
- Loads content by converting `Document` → TipTap JSON
- Saves content by converting TipTap JSON → `Document` on blur / debounced change

### TipTap ↔ Document conversion (`creation-tool/src/editor/convert.ts`)

Two functions:

- `documentToTipTap(doc: Document)` → TipTap-compatible JSON for loading into the editor
- `tipTapToDocument(json: TipTapJSON)` → `Document` for saving

The conversion is a straightforward mapping:

| Our type | TipTap type |
|---|---|
| `Block::Paragraph` | `{ type: "paragraph", content: [...] }` |
| `Block::Blockquote` | `{ type: "blockquote", content: [...] }` |
| `Block::Image` | `{ type: "image", attrs: { src, alt } }` |
| `Block::HorizontalRule` | `{ type: "horizontalRule" }` |
| `Inline` | `{ type: "text", text, marks: [...] }` |
| `Mark::Bold` | `{ type: "bold" }` |
| `Mark::Italic` | `{ type: "italic" }` |

Key differences to handle:
- TipTap uses `"horizontalRule"` (camelCase), we use `"horizontal_rule"` (snake_case)
- TipTap wraps marks as `{ type: "bold" }` objects, we use string enums `"bold"`
- TipTap image attrs use `{ src, alt }` as attributes, we have them as direct fields
- TipTap uses `{ type: "text", text: "..." }` for inline content, we use `{ text: "...", marks: [] }`

### PageCard change

The `<Textarea>` for the body in `PageCard.tsx` is replaced with `<RichTextEditor>`. The component receives the `Document` and an `onChange` callback.

## Player Rendering

### Content renderer (`player/ui/ContentRenderer.tsx`)

A recursive React component that renders the document tree as semantic HTML:

```
Document → map blocks
  Paragraph → <p> with inline content
  Blockquote → <blockquote> with nested blocks (recursive)
  Image → <img> with src from AssetResolver, full width
  HorizontalRule → <hr>

Inline → <span> with marks applied
  Bold → <strong>
  Italic → <em>
```

Images use the `AssetResolver` interface to get the correct URL:
- Reader: Tauri asset protocol (`convertFileSrc`)
- Player test app: static files from publicDir
- Future HTML export: inline data URLs

**No TipTap dependency in the player.** The player stays lightweight — just maps the typed document to React elements.

### Accessibility

Semantic HTML throughout: `<p>`, `<blockquote>`, `<strong>`, `<em>`, `<img alt="...">`, `<hr>`. Screen readers get proper document structure.

### PreviewView

The creation tool's `PreviewView` uses the same `ContentRenderer` from the player package.

## Asset Management

### Image insertion flow

1. Author clicks "insert image" in toolbar
2. Tauri file picker opens
3. Selected image is copied to `{project_dir}/assets/` via a new Tauri command
4. Image node is inserted into the editor referencing the filename

### New Tauri command

```
copy_asset(source_path: String) → String
```

Copies file to `{project_dir}/assets/`, handles name collisions (appends `-2`, `-3`, etc.), returns the filename.

### Asset URL resolution for playtest/preview

The creation tool's playtest and preview need to display images from the project's assets directory. Use Tauri's `convertFileSrc()` with the known project directory path. A creation-tool-specific `AssetResolver` constructs the URLs.

### Bundle export

Already handled — `export_bundle` reads all files from `assets/` and includes them in the zip. No changes needed.

## Scope

### In scope
- `Document` content model (Rust + TypeScript)
- TipTap editor with paragraph, bold, italic, blockquote, horizontal rule, image
- TipTap ↔ Document conversion layer
- Player `ContentRenderer` for rendering documents
- Image asset management (copy to project, reference by filename)
- Format version migration scaffolding (currently no-op)
- Update test fixtures and E2E tests

### Out of scope
- Variable/dynamic text nodes (future)
- Headings, lists, links, strikethrough, code (future extensions)
- Image resizing, captions, alignment (future)
- Collaborative editing
- Markdown import/export
