# Rich Text Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain-text page body with a structured rich text document model, a TipTap editor in the creation tool, and a semantic HTML renderer in the player.

**Architecture:** A `Document` content type is added to the shared Rust crate and mirrored in TypeScript. The `Page.body` field changes from `String`/`string` to `Document`. TipTap is used in the creation tool with a conversion layer between TipTap's JSON and our document model. The player renders documents as semantic HTML via a recursive `ContentRenderer` component.

**Tech Stack:** Rust (serde with tagged enums), TypeScript, TipTap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-image`), React

---

## File Map

### Shared crate

| File | Responsibility |
|---|---|
| `shared/src/content.rs` | Document, Block, Inline, Mark types with serde |
| `shared/src/models.rs` | Page.body changes from String to Document |
| `shared/src/migration.rs` | Format version migration framework (scaffolding) |
| `shared/src/lib.rs` | Add new modules |

### Player package

| File | Responsibility |
|---|---|
| `player/engine/types.ts` | Add Document, Block, Inline, Mark TS types; change ManifestPage.body |
| `player/ui/ContentRenderer.tsx` | Recursive renderer: Document → semantic HTML |
| `player/ui/PageView.tsx` | Use ContentRenderer instead of plain text |

### Creation tool frontend

| File | Responsibility |
|---|---|
| `creation-tool/src/types.ts` | Page.body changes from string to Document |
| `creation-tool/src/editor/convert.ts` | documentToTipTap / tipTapToDocument conversion |
| `creation-tool/src/components/RichTextEditor.tsx` | TipTap editor with toolbar |
| `creation-tool/src/components/PageCard.tsx` | Replace Textarea with RichTextEditor |
| `creation-tool/src/player/convertToManifest.ts` | Pass Document through (no conversion needed) |
| `creation-tool/src/player/PreviewView.tsx` | Use ContentRenderer |
| `creation-tool/package.json` | Add TipTap dependencies |

### Creation tool backend

| File | Responsibility |
|---|---|
| `creation-tool/src-tauri/src/commands.rs` | Add copy_asset command |
| `creation-tool/src-tauri/src/project/mod.rs` | Add copy_asset method |
| `creation-tool/src-tauri/src/main.rs` | Register copy_asset command |

### Test fixtures

| File | Responsibility |
|---|---|
| `test-fixtures/minimal.json` | Update body to Document format |
| `test-fixtures/branching.json` | Update body to Document format |
| `test-fixtures/flags.json` | Update body to Document format |

---

## Task 1: Shared Crate — Content Types

**Files:**
- Create: `shared/src/content.rs`
- Modify: `shared/src/lib.rs`

- [ ] **Step 1: Create shared/src/content.rs with types and tests**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Document {
    #[serde(default)]
    pub content: Vec<Block>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Block {
    Paragraph {
        #[serde(default)]
        content: Vec<Inline>,
    },
    Blockquote {
        content: Vec<Block>,
    },
    Image {
        src: String,
        alt: String,
    },
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

impl Document {
    pub fn empty() -> Self {
        Document {
            content: vec![Block::Paragraph { content: vec![] }],
        }
    }

    pub fn from_plain_text(text: &str) -> Self {
        if text.is_empty() {
            return Self::empty();
        }
        Document {
            content: text
                .split('\n')
                .map(|line| Block::Paragraph {
                    content: if line.is_empty() {
                        vec![]
                    } else {
                        vec![Inline {
                            text: line.to_string(),
                            marks: vec![],
                        }]
                    },
                })
                .collect(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_document() {
        let doc = Document::empty();
        assert_eq!(doc.content.len(), 1);
        let json = serde_json::to_string(&doc).unwrap();
        let parsed: Document = serde_json::from_str(&json).unwrap();
        assert_eq!(doc, parsed);
    }

    #[test]
    fn document_with_formatting() {
        let doc = Document {
            content: vec![Block::Paragraph {
                content: vec![
                    Inline { text: "Hello ".into(), marks: vec![] },
                    Inline { text: "world".into(), marks: vec![Mark::Bold] },
                ],
            }],
        };
        let json = serde_json::to_string(&doc).unwrap();
        assert!(json.contains("\"type\":\"paragraph\""));
        assert!(json.contains("\"bold\""));
        let parsed: Document = serde_json::from_str(&json).unwrap();
        assert_eq!(doc, parsed);
    }

    #[test]
    fn document_with_all_block_types() {
        let doc = Document {
            content: vec![
                Block::Paragraph {
                    content: vec![Inline { text: "Text".into(), marks: vec![] }],
                },
                Block::Image { src: "hero.png".into(), alt: "Hero image".into() },
                Block::HorizontalRule,
                Block::Blockquote {
                    content: vec![Block::Paragraph {
                        content: vec![Inline {
                            text: "A quote".into(),
                            marks: vec![Mark::Italic],
                        }],
                    }],
                },
            ],
        };
        let json = serde_json::to_string(&doc).unwrap();
        let parsed: Document = serde_json::from_str(&json).unwrap();
        assert_eq!(doc, parsed);
    }

    #[test]
    fn from_plain_text() {
        let doc = Document::from_plain_text("Line 1\nLine 2\n\nLine 4");
        assert_eq!(doc.content.len(), 4);
        match &doc.content[0] {
            Block::Paragraph { content } => {
                assert_eq!(content[0].text, "Line 1");
            }
            _ => panic!("expected paragraph"),
        }
        match &doc.content[2] {
            Block::Paragraph { content } => {
                assert!(content.is_empty()); // empty line
            }
            _ => panic!("expected empty paragraph"),
        }
    }

    #[test]
    fn from_plain_text_empty() {
        let doc = Document::from_plain_text("");
        assert_eq!(doc.content.len(), 1);
    }
}
```

- [ ] **Step 2: Add module to lib.rs**

In `shared/src/lib.rs`, add:
```rust
pub mod content;
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p shared -- content`

Expected: 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add shared/src/content.rs shared/src/lib.rs
git commit -m "feat: add Document content types for rich text"
```

---

## Task 2: Shared Crate — Update Page Model

**Files:**
- Modify: `shared/src/models.rs`

- [ ] **Step 1: Change Page.body from String to Document**

In `shared/src/models.rs`, add the import and change the field:

```rust
use crate::content::Document;
```

Change the `Page` struct:
```rust
pub struct Page {
    pub id: String,
    pub name: String,
    pub body: Document,  // was: String
    #[serde(default)]
    pub choices: Vec<Choice>,
    #[serde(default)]
    pub flag_operations: Vec<FlagOperation>,
}
```

- [ ] **Step 2: Update tests**

Update the `page_round_trip_json` test to use `Document`:
```rust
body: Document::from_plain_text("Hello world"),
```

Update the `page_list_item_from_page` test:
```rust
body: Document::empty(),
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p shared`

Expected: All model + content tests pass.

- [ ] **Step 4: Commit**

```bash
git add shared/src/models.rs
git commit -m "feat: change Page.body to Document type"
```

---

## Task 3: Shared Crate — Migration Framework

**Files:**
- Create: `shared/src/migration.rs`
- Modify: `shared/src/lib.rs`

- [ ] **Step 1: Create migration.rs**

```rust
use std::path::Path;

pub const CURRENT_FORMAT_VERSION: u32 = 1;

/// Run any needed migrations on a project directory.
/// Currently a no-op scaffold for future format changes.
pub fn migrate_project(_dir: &Path, from_version: u32) -> Result<(), String> {
    if from_version > CURRENT_FORMAT_VERSION {
        return Err(format!(
            "Project format version {} is newer than supported version {}",
            from_version, CURRENT_FORMAT_VERSION
        ));
    }
    // Future migrations would go here:
    // if from_version < 2 { migrate_v1_to_v2(dir)?; }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn current_version_is_noop() {
        let tmp = TempDir::new().unwrap();
        assert!(migrate_project(tmp.path(), CURRENT_FORMAT_VERSION).is_ok());
    }

    #[test]
    fn future_version_returns_error() {
        let tmp = TempDir::new().unwrap();
        assert!(migrate_project(tmp.path(), CURRENT_FORMAT_VERSION + 1).is_err());
    }
}
```

- [ ] **Step 2: Add module to lib.rs**

```rust
pub mod migration;
```

- [ ] **Step 3: Add tempfile to shared dev-dependencies**

In `shared/Cargo.toml`:
```toml
[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p shared`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add shared/src/migration.rs shared/src/lib.rs shared/Cargo.toml
git commit -m "feat: add format version migration framework"
```

---

## Task 4: Fix Creation Tool and Reader Rust for New Page Type

**Files:**
- Modify: `creation-tool/src-tauri/src/project/pages.rs` (update test fixtures)
- Modify: `creation-tool/src-tauri/src/project/mod.rs` (use Document::empty for new pages)
- Modify: `reader/src-tauri/src/library.rs` (update test fixtures)

The `Page.body` is now `Document` instead of `String`. All Rust code that constructs `Page` objects needs updating.

- [ ] **Step 1: Update creation tool project module**

In `creation-tool/src-tauri/src/project/mod.rs`, find where new pages are created with an empty body. Change:
```rust
body: String::new(),
```
to:
```rust
body: shared::content::Document::empty(),
```

- [ ] **Step 2: Update creation tool page test fixtures**

In `creation-tool/src-tauri/src/project/pages.rs`, update `make_page` and any test that constructs `Page`:
```rust
body: shared::content::Document::from_plain_text("Content"),
```

- [ ] **Step 3: Update reader library test fixtures**

In `reader/src-tauri/src/library.rs`, update test pages:
```rust
body: shared::content::Document::from_plain_text("You begin your adventure."),
```

- [ ] **Step 4: Build and test everything**

Run: `cd /Users/jnurminen/cyoa2 && cargo test`

Expected: All Rust tests pass.

- [ ] **Step 5: Commit**

```bash
git add creation-tool/src-tauri/ reader/src-tauri/
git commit -m "fix: update Rust code for Document body type"
```

---

## Task 5: Player Types and Content Renderer

**Files:**
- Modify: `player/engine/types.ts`
- Create: `player/ui/ContentRenderer.tsx`
- Modify: `player/ui/PageView.tsx`

- [ ] **Step 1: Add Document types to player/engine/types.ts**

Add these types (after the ManifestCondition interface):

```typescript
// -- Rich text document types --

export interface Document {
  content: Block[];
}

export type Block =
  | { type: "paragraph"; content: Inline[] }
  | { type: "blockquote"; content: Block[] }
  | { type: "image"; src: string; alt: string }
  | { type: "horizontal_rule" };

export interface Inline {
  text: string;
  marks: Mark[];
}

export type Mark = "bold" | "italic";
```

Change `ManifestPage.body` from `string` to `Document`:
```typescript
export interface ManifestPage {
  id: string;
  name: string;
  body: Document;  // was: string
  assets: string[];
  flag_operations: ManifestFlagOperation[];
  choices: ManifestChoice[];
}
```

- [ ] **Step 2: Create player/ui/ContentRenderer.tsx**

```tsx
import type { AssetResolver, Block, Document, Inline, Mark } from "../engine/types";

interface ContentRendererProps {
  document: Document;
  assets: AssetResolver;
}

export function ContentRenderer({ document, assets }: ContentRendererProps) {
  return (
    <div className="leading-relaxed" style={{ color: "var(--player-text)" }}>
      {document.content.map((block, i) => (
        <BlockRenderer key={i} block={block} assets={assets} />
      ))}
    </div>
  );
}

function BlockRenderer({ block, assets }: { block: Block; assets: AssetResolver }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className="mb-[1em]">
          {block.content.map((inline, i) => (
            <InlineRenderer key={i} inline={inline} />
          ))}
        </p>
      );
    case "blockquote":
      return (
        <blockquote
          className="border-l-4 pl-[1em] mb-[1em] italic"
          style={{ borderColor: "var(--player-border)", color: "var(--player-text-muted)" }}
        >
          {block.content.map((child, i) => (
            <BlockRenderer key={i} block={child} assets={assets} />
          ))}
        </blockquote>
      );
    case "image": {
      const src = typeof assets.getAssetUrl === "function"
        ? assets.getAssetUrl(block.src)
        : block.src;
      return (
        <figure className="mb-[1em]">
          <img
            src={typeof src === "string" ? src : ""}
            alt={block.alt}
            className="w-full rounded"
            loading="lazy"
          />
        </figure>
      );
    }
    case "horizontal_rule":
      return (
        <hr
          className="my-[1.5em] border-0 h-px"
          style={{ backgroundColor: "var(--player-border)" }}
        />
      );
    default:
      return null;
  }
}

function InlineRenderer({ inline }: { inline: Inline }) {
  let element: React.ReactNode = inline.text;

  for (const mark of inline.marks) {
    switch (mark) {
      case "bold":
        element = <strong>{element}</strong>;
        break;
      case "italic":
        element = <em>{element}</em>;
        break;
    }
  }

  return <>{element}</>;
}
```

- [ ] **Step 3: Update player/ui/PageView.tsx**

Replace the plain text body rendering with ContentRenderer:

```tsx
import type { AssetResolver, ManifestPage } from "../engine/types";
import { ContentRenderer } from "./ContentRenderer";

interface PageViewProps {
  page: ManifestPage;
  assets: AssetResolver;
}

export function PageView({ page, assets }: PageViewProps) {
  return (
    <article
      className="max-w-prose mx-auto"
      aria-label={page.name}
      tabIndex={-1}
    >
      <h1
        className="text-[1.5em] font-bold mb-[1em]"
        style={{ color: "var(--player-text)" }}
      >
        {page.name}
      </h1>
      <ContentRenderer document={page.body} assets={assets} />
    </article>
  );
}
```

- [ ] **Step 4: Run player unit tests**

Run: `cd /Users/jnurminen/cyoa2/player && npx vitest run`

Expected: 25 tests pass (runtime tests don't touch body rendering).

- [ ] **Step 5: Commit**

```bash
git add player/engine/types.ts player/ui/ContentRenderer.tsx player/ui/PageView.tsx
git commit -m "feat: add ContentRenderer for rich text documents in player"
```

---

## Task 6: Update Test Fixtures

**Files:**
- Modify: `test-fixtures/minimal.json`
- Modify: `test-fixtures/branching.json`
- Modify: `test-fixtures/flags.json`

All test fixture page bodies change from strings to Document objects.

- [ ] **Step 1: Update minimal.json**

Change the body from a string to a Document. For example:
```json
"body": "This is a story with just one page. There is nothing else to do."
```
becomes:
```json
"body": {
  "content": [
    {
      "type": "paragraph",
      "content": [{ "text": "This is a story with just one page. There is nothing else to do.", "marks": [] }]
    }
  ]
}
```

Apply this transformation to every page body in all three fixture files. Each original string becomes a Document with one paragraph containing one inline text node.

- [ ] **Step 2: Run player E2E tests**

Run: `cd /Users/jnurminen/cyoa2/player && npx playwright test`

Expected: All 13 tests pass (text content is now in paragraphs, test selectors may need adjustment).

If tests fail because the text is now in `<p>` tags instead of a plain `<div>`, update the test selectors. For example, `page.locator("article").toContainText(...)` should still work since `<p>` is inside `<article>`.

- [ ] **Step 3: Commit**

```bash
git add test-fixtures/
git commit -m "feat: update test fixtures with Document body format"
```

---

## Task 7: Creation Tool Types and TipTap Dependencies

**Files:**
- Modify: `creation-tool/src/types.ts`
- Modify: `creation-tool/package.json`

- [ ] **Step 1: Add Document types to creation-tool/src/types.ts**

Add after the existing types:

```typescript
// -- Rich text document types --

export interface Document {
  content: Block[];
}

export type Block =
  | { type: "paragraph"; content: Inline[] }
  | { type: "blockquote"; content: Block[] }
  | { type: "image"; src: string; alt: string }
  | { type: "horizontal_rule" };

export interface Inline {
  text: string;
  marks: Mark[];
}

export type Mark = "bold" | "italic";
```

Change `Page.body` from `string` to `Document`:
```typescript
export interface Page {
  id: string;
  name: string;
  body: Document;  // was: string
  choices: Choice[];
  flag_operations: FlagOperation[];
}
```

- [ ] **Step 2: Add TipTap dependencies**

Read `creation-tool/package.json`. Add to dependencies:
```json
"@tiptap/react": "^2.12.0",
"@tiptap/starter-kit": "^2.12.0",
"@tiptap/extension-image": "^2.12.0"
```

Run: `cd /Users/jnurminen/cyoa2 && yarn install`

- [ ] **Step 3: Commit**

```bash
git add creation-tool/src/types.ts creation-tool/package.json yarn.lock
git commit -m "feat: add Document types and TipTap dependencies to creation tool"
```

---

## Task 8: TipTap ↔ Document Conversion Layer

**Files:**
- Create: `creation-tool/src/editor/convert.ts`
- Create: `creation-tool/src/editor/__tests__/convert.test.ts`

- [ ] **Step 1: Write conversion tests**

Create `creation-tool/src/editor/__tests__/convert.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { documentToTipTap, tipTapToDocument } from "../convert";
import type { Document } from "../../types";

describe("documentToTipTap", () => {
  it("converts a paragraph with formatted text", () => {
    const doc: Document = {
      content: [
        {
          type: "paragraph",
          content: [
            { text: "Hello ", marks: [] },
            { text: "world", marks: ["bold", "italic"] },
          ],
        },
      ],
    };
    const result = documentToTipTap(doc);
    expect(result.type).toBe("doc");
    expect(result.content[0].type).toBe("paragraph");
    expect(result.content[0].content[0]).toEqual({ type: "text", text: "Hello " });
    expect(result.content[0].content[1]).toEqual({
      type: "text",
      text: "world",
      marks: [{ type: "bold" }, { type: "italic" }],
    });
  });

  it("converts an image", () => {
    const doc: Document = {
      content: [{ type: "image", src: "hero.png", alt: "Hero" }],
    };
    const result = documentToTipTap(doc);
    expect(result.content[0].type).toBe("image");
    expect(result.content[0].attrs).toEqual({ src: "hero.png", alt: "Hero" });
  });

  it("converts a horizontal rule", () => {
    const doc: Document = {
      content: [{ type: "horizontal_rule" }],
    };
    const result = documentToTipTap(doc);
    expect(result.content[0].type).toBe("horizontalRule");
  });

  it("converts a blockquote", () => {
    const doc: Document = {
      content: [
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ text: "Quote", marks: [] }] },
          ],
        },
      ],
    };
    const result = documentToTipTap(doc);
    expect(result.content[0].type).toBe("blockquote");
    expect(result.content[0].content[0].type).toBe("paragraph");
  });

  it("converts empty document", () => {
    const doc: Document = { content: [{ type: "paragraph", content: [] }] };
    const result = documentToTipTap(doc);
    expect(result.type).toBe("doc");
    expect(result.content[0].type).toBe("paragraph");
  });
});

describe("tipTapToDocument", () => {
  it("converts a paragraph with marks", () => {
    const tiptap = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
          ],
        },
      ],
    };
    const doc = tipTapToDocument(tiptap);
    expect(doc.content[0].type).toBe("paragraph");
    if (doc.content[0].type === "paragraph") {
      expect(doc.content[0].content[0]).toEqual({ text: "Hello ", marks: [] });
      expect(doc.content[0].content[1]).toEqual({ text: "bold", marks: ["bold"] });
    }
  });

  it("converts an image", () => {
    const tiptap = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "cave.png", alt: "Cave" } },
      ],
    };
    const doc = tipTapToDocument(tiptap);
    expect(doc.content[0]).toEqual({ type: "image", src: "cave.png", alt: "Cave" });
  });

  it("converts horizontalRule to horizontal_rule", () => {
    const tiptap = {
      type: "doc",
      content: [{ type: "horizontalRule" }],
    };
    const doc = tipTapToDocument(tiptap);
    expect(doc.content[0].type).toBe("horizontal_rule");
  });

  it("round-trips through both conversions", () => {
    const original: Document = {
      content: [
        {
          type: "paragraph",
          content: [
            { text: "Normal ", marks: [] },
            { text: "bold", marks: ["bold"] },
          ],
        },
        { type: "horizontal_rule" },
        { type: "image", src: "test.png", alt: "Test" },
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ text: "Quoted", marks: ["italic"] }] },
          ],
        },
      ],
    };
    const result = tipTapToDocument(documentToTipTap(original));
    expect(result).toEqual(original);
  });
});
```

- [ ] **Step 2: Implement convert.ts**

Create `creation-tool/src/editor/convert.ts`:

```typescript
import type { Document, Block, Inline, Mark } from "../types";

// TipTap JSON types (simplified)
interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string }[];
  attrs?: Record<string, string>;
}

// --- Document → TipTap ---

export function documentToTipTap(doc: Document): TipTapNode {
  return {
    type: "doc",
    content: doc.content.map(blockToTipTap),
  };
}

function blockToTipTap(block: Block): TipTapNode {
  switch (block.type) {
    case "paragraph":
      return {
        type: "paragraph",
        content: block.content.length > 0
          ? block.content.map(inlineToTipTap)
          : undefined,
      };
    case "blockquote":
      return {
        type: "blockquote",
        content: block.content.map(blockToTipTap),
      };
    case "image":
      return {
        type: "image",
        attrs: { src: block.src, alt: block.alt },
      };
    case "horizontal_rule":
      return { type: "horizontalRule" };
  }
}

function inlineToTipTap(inline: Inline): TipTapNode {
  const node: TipTapNode = { type: "text", text: inline.text };
  if (inline.marks.length > 0) {
    node.marks = inline.marks.map((m) => ({ type: m }));
  }
  return node;
}

// --- TipTap → Document ---

export function tipTapToDocument(tiptap: TipTapNode): Document {
  return {
    content: (tiptap.content || []).map(tipTapToBlock),
  };
}

function tipTapToBlock(node: TipTapNode): Block {
  switch (node.type) {
    case "paragraph":
      return {
        type: "paragraph",
        content: (node.content || []).map(tipTapToInline),
      };
    case "blockquote":
      return {
        type: "blockquote",
        content: (node.content || []).map(tipTapToBlock),
      };
    case "image":
      return {
        type: "image",
        src: node.attrs?.src || "",
        alt: node.attrs?.alt || "",
      };
    case "horizontalRule":
      return { type: "horizontal_rule" };
    default:
      // Unknown block types become empty paragraphs
      return { type: "paragraph", content: [] };
  }
}

function tipTapToInline(node: TipTapNode): Inline {
  return {
    text: node.text || "",
    marks: (node.marks || []).map((m) => m.type as Mark),
  };
}
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/jnurminen/cyoa2/creation-tool && npx vitest run`

Expected: Conversion tests + existing converter tests pass.

- [ ] **Step 4: Commit**

```bash
git add creation-tool/src/editor/
git commit -m "feat: add TipTap ↔ Document conversion layer"
```

---

## Task 9: RichTextEditor Component

**Files:**
- Create: `creation-tool/src/components/RichTextEditor.tsx`

- [ ] **Step 1: Create RichTextEditor.tsx**

```tsx
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { useEffect } from "react";
import { documentToTipTap, tipTapToDocument } from "../editor/convert";
import type { Document } from "../types";

interface RichTextEditorProps {
  document: Document;
  onUpdate: (doc: Document) => void;
  onImageInsert?: () => Promise<string | null>;
}

export function RichTextEditor({ document, onUpdate, onImageInsert }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        listItem: false,
        bulletList: false,
        orderedList: false,
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
    ],
    content: documentToTipTap(document),
    onBlur: ({ editor }) => {
      const doc = tipTapToDocument(editor.getJSON());
      onUpdate(doc);
    },
  });

  // Sync external document changes (e.g. page switch)
  useEffect(() => {
    if (editor && !editor.isFocused) {
      const currentJSON = JSON.stringify(editor.getJSON());
      const newJSON = JSON.stringify(documentToTipTap(document));
      if (currentJSON !== newJSON) {
        editor.commands.setContent(documentToTipTap(document));
      }
    }
  }, [document, editor]);

  if (!editor) return null;

  const handleImageInsert = async () => {
    if (!onImageInsert) return;
    const filename = await onImageInsert();
    if (filename) {
      editor.chain().focus().setImage({ src: filename, alt: "" }).run();
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex gap-1 p-2 border-b border-gray-200 bg-gray-50">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Bold"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italic"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="Blockquote"
        >
          &ldquo;
        </ToolbarButton>
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          label="Horizontal rule"
        >
          ―
        </ToolbarButton>
        {onImageInsert && (
          <ToolbarButton
            active={false}
            onClick={handleImageInsert}
            label="Insert image"
          >
            🖼
          </ToolbarButton>
        )}
      </div>
      {/* Editor */}
      <EditorContent
        editor={editor}
        className="p-3 min-h-[200px] prose prose-sm max-w-none focus:outline-none"
      />
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`px-2 py-1 rounded text-sm min-w-[32px] min-h-[32px] ${
        active
          ? "bg-indigo-100 text-indigo-700"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add creation-tool/src/components/RichTextEditor.tsx
git commit -m "feat: add RichTextEditor component with TipTap"
```

---

## Task 10: Asset Copy Command

**Files:**
- Modify: `creation-tool/src-tauri/src/project/mod.rs`
- Modify: `creation-tool/src-tauri/src/commands.rs`
- Modify: `creation-tool/src-tauri/src/main.rs`

- [ ] **Step 1: Add copy_asset to Project**

In `creation-tool/src-tauri/src/project/mod.rs`, add:

```rust
pub fn copy_asset(&self, source_path: &str) -> AppResult<String> {
    let source = std::path::PathBuf::from(source_path);
    let filename = source
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| AppError::Custom("Invalid source path".into()))?
        .to_string();

    let assets_dir = self.dir.join("assets");
    std::fs::create_dir_all(&assets_dir)?;

    let mut target_name = filename.clone();
    let mut counter = 2;
    while assets_dir.join(&target_name).exists() {
        let stem = std::path::Path::new(&filename)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("file");
        let ext = std::path::Path::new(&filename)
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        target_name = if ext.is_empty() {
            format!("{}-{}", stem, counter)
        } else {
            format!("{}-{}.{}", stem, counter, ext)
        };
        counter += 1;
    }

    std::fs::copy(&source, assets_dir.join(&target_name))?;
    Ok(target_name)
}

pub fn get_assets_dir(&self) -> std::path::PathBuf {
    self.dir.join("assets")
}
```

- [ ] **Step 2: Add Tauri commands**

In `creation-tool/src-tauri/src/commands.rs`, add:

```rust
#[tauri::command]
pub fn copy_asset(source_path: String, state: State<ProjectState>) -> Result<String, String> {
    with_project(&state, |p| p.copy_asset(&source_path))
}

#[tauri::command]
pub fn get_project_assets_dir(state: State<ProjectState>) -> Result<String, String> {
    with_project(&state, |p| Ok(p.get_assets_dir().to_string_lossy().to_string()))
}
```

- [ ] **Step 3: Register in main.rs**

Add `commands::copy_asset` and `commands::get_project_assets_dir` to the `invoke_handler`.

- [ ] **Step 4: Add to frontend API**

In `creation-tool/src/api.ts`, add:
```typescript
copyAsset: (sourcePath: string) =>
  invoke<string>("copy_asset", { sourcePath }),

getProjectAssetsDir: () =>
  invoke<string>("get_project_assets_dir"),
```

- [ ] **Step 5: Build and test**

Run: `cd /Users/jnurminen/cyoa2 && cargo build -p creation-tool`

Expected: Compiles.

- [ ] **Step 6: Commit**

```bash
git add creation-tool/src-tauri/ creation-tool/src/api.ts
git commit -m "feat: add asset copy command for image insertion"
```

---

## Task 11: Wire RichTextEditor into PageCard

**Files:**
- Modify: `creation-tool/src/components/PageCard.tsx`

- [ ] **Step 1: Read and update PageCard**

Replace the `<Textarea>` for the body with `<RichTextEditor>`. Key changes:

1. Import `RichTextEditor` and remove `Textarea` import
2. The `body` local state changes from `string` to `Document`
3. The `handleSave` compares documents (use `JSON.stringify` for comparison)
4. Add an image insert handler that calls `api.copyAsset()` via Tauri dialog:

```typescript
import { open as openDialog } from "@tauri-apps/plugin-dialog";

const handleImageInsert = async (): Promise<string | null> => {
  const filePath = await openDialog({
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
  });
  if (!filePath) return null;
  return api.copyAsset(filePath);
};
```

5. Replace the Textarea with:
```tsx
<RichTextEditor
  document={body}
  onUpdate={setBody}
  onImageInsert={handleImageInsert}
/>
```

The implementer should read the full PageCard, understand the current body handling pattern, and make minimal changes.

- [ ] **Step 2: Commit**

```bash
git add creation-tool/src/components/PageCard.tsx
git commit -m "feat: replace textarea with RichTextEditor in PageCard"
```

---

## Task 12: Update Manifest Converter and PreviewView

**Files:**
- Modify: `creation-tool/src/player/convertToManifest.ts`
- Modify: `creation-tool/src/player/PreviewView.tsx`

- [ ] **Step 1: Update convertToManifest.ts**

The `body` field is now a `Document` which matches the manifest's `Document` type. The conversion is now a passthrough — just `body: p.body`. The current code already does `body: p.body` so it should work without changes.

Verify by reading the file. If it still works, no changes needed.

- [ ] **Step 2: Update PreviewView.tsx**

Replace the plain text body rendering with ContentRenderer from the player package:

```tsx
import { ContentRenderer } from "@fabler/player/ui/ContentRenderer";
import type { Page } from "../types";
import type { AssetResolver } from "@fabler/player/engine/types";

const noopAssets: AssetResolver = {
  getAssetUrl: (path: string) => path,
};

interface PreviewViewProps {
  page: Page;
}

export function PreviewView({ page }: PreviewViewProps) {
  return (
    <div
      className="h-full overflow-y-auto p-6"
      data-theme="light"
      data-font-size="medium"
    >
      <article className="max-w-prose mx-auto">
        <h1 className="text-xl font-bold mb-4 text-gray-900">
          {page.name}
        </h1>
        <ContentRenderer document={page.body} assets={noopAssets} />
        {page.choices.length > 0 && (
          <nav className="mt-8 pt-4 border-t border-gray-200">
            <ul className="list-none p-0 m-0 flex flex-col gap-3">
              {page.choices.map((choice) => (
                <li key={choice.id}>
                  <div className="w-full text-left p-4 rounded-lg border border-gray-200 bg-gray-50 text-gray-500">
                    {choice.text}
                  </div>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {page.choices.length === 0 && (
          <div className="mt-8 pt-4 border-t border-gray-200">
            <p className="text-center italic text-gray-400">The End</p>
          </div>
        )}
      </article>
    </div>
  );
}
```

Also add the `ContentRenderer` export to `player/ui/index.ts`:
```typescript
export { ContentRenderer } from "./ContentRenderer";
```

And add to `player/package.json` exports:
```json
"./ui/ContentRenderer": "./ui/ContentRenderer.tsx"
```

- [ ] **Step 3: Commit**

```bash
git add creation-tool/src/player/ player/ui/index.ts player/package.json
git commit -m "feat: use ContentRenderer in PreviewView"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Run all Rust tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test`

Expected: All tests pass (shared 11+, creation-tool 6, reader 12).

- [ ] **Step 2: Run creation tool unit tests**

Run: `cd /Users/jnurminen/cyoa2/creation-tool && npx vitest run`

Expected: Conversion tests + existing tests pass.

- [ ] **Step 3: Run player tests**

Run: `cd /Users/jnurminen/cyoa2/player && npx vitest run && npx playwright test`

Expected: 25 unit + 13 E2E tests pass.

- [ ] **Step 4: Build all Rust crates**

Run: `cd /Users/jnurminen/cyoa2 && cargo build -p creation-tool && cargo build -p fabler-reader`

Expected: Both compile.
