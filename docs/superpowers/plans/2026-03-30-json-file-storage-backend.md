# JSON File Storage — Backend Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SQLite with JSON file-based project storage in the creation tool's Rust backend and shared types crate.

**Architecture:** The `shared` crate is stripped of database/type-gen dependencies and rewritten with new string-ID models. A new `project/` module in the creation tool replaces the `db/` module, reading/writing `.story.json` and `.page.json` files. Tauri commands are rewritten to use the `Project` struct instead of `Database`. The bundle format is updated to convert directly from the new shared types.

**Tech Stack:** Rust, serde_json, Tauri 2.0, zip crate

---

## File Map

### Shared crate — rewritten

| File | Responsibility |
|---|---|
| `shared/Cargo.toml` | Stripped to serde + serde_json + zip + thiserror only |
| `shared/src/lib.rs` | Module declarations |
| `shared/src/models.rs` | New model types with string IDs |
| `shared/src/bundle.rs` | Updated manifest types + conversion from new models |
| `shared/src/id.rs` | 5-char hex ID generation |

### Shared crate — deleted

| File | Reason |
|---|---|
| `shared/src/export.rs` | ExportedStory no longer needed — models are already the export format |
| `shared/bindings/` | ts-rs generated files, no longer needed |
| `shared/_build.rs` | ts-rs build script, no longer needed |
| `shared/proc_macros/` | No longer needed |

### Creation tool backend — new

| File | Responsibility |
|---|---|
| `creation-tool/src-tauri/src/project/mod.rs` | Project struct, open/create/close |
| `creation-tool/src-tauri/src/project/pages.rs` | Page file I/O (read, write, create, delete, list) |
| `creation-tool/src-tauri/src/project/story.rs` | Story file I/O (read, write) |
| `creation-tool/src-tauri/src/project/export.rs` | Bundle export (zip project into .fabler) |
| `creation-tool/src-tauri/src/project/import.rs` | Bundle import (unzip .fabler into project) |
| `creation-tool/src-tauri/src/commands.rs` | All Tauri commands (single file — much simpler now) |
| `creation-tool/src-tauri/src/error.rs` | Rewritten error types (no sqlx) |

### Creation tool backend — deleted

| File | Reason |
|---|---|
| `creation-tool/src-tauri/src/db/` | Entire module — replaced by project/ |
| `creation-tool/src-tauri/src/models/` | Patch/create models — no longer needed |
| `creation-tool/src-tauri/src/schema.rs` | TOML schema generator — removed |
| `creation-tool/src-tauri/src/app/setup.rs` | SQLite setup — replaced by project open/create |
| `creation-tool/src-tauri/migrations/` | SQL migrations — no longer needed |

### Creation tool backend — modified

| File | Change |
|---|---|
| `creation-tool/src-tauri/src/main.rs` | Rewrite: new command registration, setup hook, remove specta |
| `creation-tool/src-tauri/src/app/mod.rs` | Remove setup module |
| `creation-tool/src-tauri/src/app/menu.rs` | Update: remove "Reset database", keep import/export |
| `creation-tool/src-tauri/Cargo.toml` | Remove sqlx, chrono, specta, toml deps |

---

## Task 1: Shared Crate — Clean Dependencies and Add ID Generation

**Files:**
- Modify: `shared/Cargo.toml`
- Modify: `shared/src/lib.rs`
- Create: `shared/src/id.rs`
- Delete: `shared/src/export.rs`
- Delete: `shared/bindings/` directory
- Delete: `shared/_build.rs`
- Delete: `shared/proc_macros/` directory

- [ ] **Step 1: Strip shared/Cargo.toml**

Replace `shared/Cargo.toml` with:

```toml
[package]
name = "shared"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1"
zip = "2"
thiserror = "2"
rand = "0.8"
```

- [ ] **Step 2: Delete removed files**

```bash
rm -rf shared/src/export.rs shared/bindings/ shared/_build.rs shared/proc_macros/
```

- [ ] **Step 3: Create shared/src/id.rs**

```rust
use rand::Rng;

/// Generate a 5-character lowercase hex ID.
pub fn generate_id() -> String {
    let mut rng = rand::thread_rng();
    let value: u32 = rng.gen_range(0..0x100000); // 0 to 1,048,575
    format!("{:05x}", value)
}

/// Generate an ID that doesn't collide with existing IDs.
pub fn generate_unique_id(existing: &[&str]) -> String {
    loop {
        let id = generate_id();
        if !existing.contains(&id.as_str()) {
            return id;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn id_is_5_chars() {
        let id = generate_id();
        assert_eq!(id.len(), 5);
    }

    #[test]
    fn id_is_lowercase_hex() {
        let id = generate_id();
        assert!(id.chars().all(|c| c.is_ascii_hexdigit() && !c.is_uppercase()));
    }

    #[test]
    fn unique_id_avoids_collisions() {
        let existing = vec!["00000", "00001"];
        let id = generate_unique_id(&existing);
        assert!(!existing.contains(&id.as_str()));
    }
}
```

- [ ] **Step 4: Update shared/src/lib.rs**

```rust
pub mod bundle;
pub mod id;
pub mod models;
```

- [ ] **Step 5: Verify it compiles**

Run: `cd /Users/jnurminen/cyoa2 && cargo build -p shared 2>&1`

This will fail because models.rs and bundle.rs still reference old types. That's expected — we fix them next.

- [ ] **Step 6: Commit deletions and new files**

```bash
git add shared/
git commit -m "chore: strip shared crate dependencies, add ID generation, remove export/bindings"
```

---

## Task 2: Shared Crate — Rewrite Models

**Files:**
- Rewrite: `shared/src/models.rs`

- [ ] **Step 1: Write tests for new model serialization**

Append to `shared/src/models.rs` (create the file first, tests will fail):

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn story_round_trip_json() {
        let story = Story {
            format_version: 1,
            title: "Test".into(),
            start_page: "a1b2c".into(),
            flags: vec![Flag {
                id: "f1a2c".into(),
                name: "has_key".into(),
                default_value: false,
            }],
        };
        let json = serde_json::to_string(&story).unwrap();
        let parsed: Story = serde_json::from_str(&json).unwrap();
        assert_eq!(story, parsed);
    }

    #[test]
    fn page_round_trip_json() {
        let page = Page {
            id: "a1b2c".into(),
            name: "Entrance".into(),
            body: "Hello world".into(),
            choices: vec![Choice {
                id: "c1b2c".into(),
                text: "Go north".into(),
                target: "d1e2f".into(),
                flag_operations: vec![FlagOperation {
                    flag_id: "f1a2c".into(),
                    operation: "set_true".into(),
                }],
                conditions: vec![Condition {
                    flag_id: "f1a2c".into(),
                    required_value: true,
                }],
            }],
            flag_operations: vec![],
        };
        let json = serde_json::to_string(&page).unwrap();
        let parsed: Page = serde_json::from_str(&json).unwrap();
        assert_eq!(page, parsed);
    }

    #[test]
    fn page_list_item_from_page() {
        let page = Page {
            id: "abc12".into(),
            name: "Test Page".into(),
            body: String::new(),
            choices: vec![],
            flag_operations: vec![],
        };
        let item = PageListItem::from(&page);
        assert_eq!(item.id, "abc12");
        assert_eq!(item.name, "Test Page");
    }
}
```

- [ ] **Step 2: Rewrite shared/src/models.rs**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Story {
    pub format_version: u32,
    pub title: String,
    pub start_page: String,
    #[serde(default)]
    pub flags: Vec<Flag>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Flag {
    pub id: String,
    pub name: String,
    pub default_value: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Page {
    pub id: String,
    pub name: String,
    pub body: String,
    #[serde(default)]
    pub choices: Vec<Choice>,
    #[serde(default)]
    pub flag_operations: Vec<FlagOperation>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Choice {
    pub id: String,
    pub text: String,
    pub target: String,
    #[serde(default)]
    pub flag_operations: Vec<FlagOperation>,
    #[serde(default)]
    pub conditions: Vec<Condition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlagOperation {
    pub flag_id: String,
    pub operation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Condition {
    pub flag_id: String,
    pub required_value: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PageListItem {
    pub id: String,
    pub name: String,
}

impl From<&Page> for PageListItem {
    fn from(page: &Page) -> Self {
        PageListItem {
            id: page.id.clone(),
            name: page.name.clone(),
        }
    }
}
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p shared -- models`

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add shared/src/models.rs
git commit -m "feat: rewrite shared models with string IDs for file-based storage"
```

---

## Task 3: Shared Crate — Update Bundle Module

**Files:**
- Rewrite: `shared/src/bundle.rs`

The manifest types become thin wrappers around the model types. The main addition is `format_version` on the manifest and the pack/unpack functions stay the same.

- [ ] **Step 1: Rewrite shared/src/bundle.rs**

Since the shared models now match the manifest format almost exactly, the `Manifest` struct can reuse model types directly. The conversion from `Story` + `Vec<Page>` to `Manifest` is trivial.

```rust
use std::collections::HashMap;
use std::io::{Cursor, Read, Write};

use serde::{Deserialize, Serialize};

use crate::models::{Choice, Condition, Flag, FlagOperation, Page, Story};

/// The bundle manifest — a self-contained story with all pages inline.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Manifest {
    pub format_version: u32,
    pub story: ManifestStory,
    #[serde(default)]
    pub flags: Vec<Flag>,
    pub pages: Vec<Page>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ManifestStory {
    pub id: String,
    pub title: String,
    pub start_page: String,
}

/// Build a Manifest from a Story and its pages.
pub fn build_manifest(story: &Story, pages: Vec<Page>) -> Manifest {
    Manifest {
        format_version: story.format_version,
        story: ManifestStory {
            id: "export".into(), // project doesn't have a story ID — it's a directory
            title: story.title.clone(),
            start_page: story.start_page.clone(),
        },
        flags: story.flags.clone(),
        pages,
    }
}

#[derive(Debug)]
pub struct BundleContents {
    pub manifest: Manifest,
    pub assets: HashMap<String, Vec<u8>>,
}

/// Pack a manifest and assets into a .fabler zip archive (in memory).
pub fn pack_bundle(contents: &BundleContents) -> Result<Vec<u8>, BundleError> {
    let mut buf = Cursor::new(Vec::new());
    {
        let mut zip = zip::ZipWriter::new(&mut buf);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        let manifest_json = serde_json::to_string_pretty(&contents.manifest)
            .map_err(|e| BundleError::Serialize(e.to_string()))?;
        zip.start_file("manifest.json", options)
            .map_err(|e| BundleError::Zip(e.to_string()))?;
        zip.write_all(manifest_json.as_bytes())
            .map_err(|e| BundleError::Io(e.to_string()))?;

        for (name, data) in &contents.assets {
            zip.start_file(format!("assets/{name}"), options)
                .map_err(|e| BundleError::Zip(e.to_string()))?;
            zip.write_all(data)
                .map_err(|e| BundleError::Io(e.to_string()))?;
        }

        zip.finish().map_err(|e| BundleError::Zip(e.to_string()))?;
    }
    Ok(buf.into_inner())
}

/// Unpack a .fabler zip archive from bytes.
pub fn unpack_bundle(data: &[u8]) -> Result<BundleContents, BundleError> {
    let cursor = Cursor::new(data);
    let mut archive =
        zip::ZipArchive::new(cursor).map_err(|e| BundleError::Zip(e.to_string()))?;

    let manifest: Manifest = {
        let mut file = archive
            .by_name("manifest.json")
            .map_err(|_| BundleError::MissingManifest)?;
        let mut json = String::new();
        file.read_to_string(&mut json)
            .map_err(|e| BundleError::Io(e.to_string()))?;
        serde_json::from_str(&json).map_err(|e| BundleError::Deserialize(e.to_string()))?
    };

    let mut assets = HashMap::new();
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| BundleError::Zip(e.to_string()))?;
        let name = file.name().to_string();
        if let Some(asset_name) = name.strip_prefix("assets/") {
            if !asset_name.is_empty() && !file.is_dir() {
                let mut data = Vec::new();
                file.read_to_end(&mut data)
                    .map_err(|e| BundleError::Io(e.to_string()))?;
                assets.insert(asset_name.to_string(), data);
            }
        }
    }

    Ok(BundleContents { manifest, assets })
}

#[derive(Debug, thiserror::Error)]
pub enum BundleError {
    #[error("Serialization error: {0}")]
    Serialize(String),
    #[error("Deserialization error: {0}")]
    Deserialize(String),
    #[error("Zip error: {0}")]
    Zip(String),
    #[error("IO error: {0}")]
    Io(String),
    #[error("Bundle is missing manifest.json")]
    MissingManifest,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::*;

    fn sample_story() -> Story {
        Story {
            format_version: 1,
            title: "Test Story".into(),
            start_page: "p1".into(),
            flags: vec![Flag {
                id: "f1".into(),
                name: "has_key".into(),
                default_value: false,
            }],
        }
    }

    fn sample_pages() -> Vec<Page> {
        vec![
            Page {
                id: "p1".into(),
                name: "Start".into(),
                body: "You are here.".into(),
                choices: vec![Choice {
                    id: "c1".into(),
                    text: "Go".into(),
                    target: "p2".into(),
                    flag_operations: vec![FlagOperation {
                        flag_id: "f1".into(),
                        operation: "set_true".into(),
                    }],
                    conditions: vec![],
                }],
                flag_operations: vec![],
            },
            Page {
                id: "p2".into(),
                name: "End".into(),
                body: "The end.".into(),
                choices: vec![],
                flag_operations: vec![],
            },
        ]
    }

    #[test]
    fn build_manifest_from_story_and_pages() {
        let story = sample_story();
        let pages = sample_pages();
        let manifest = build_manifest(&story, pages.clone());
        assert_eq!(manifest.format_version, 1);
        assert_eq!(manifest.story.title, "Test Story");
        assert_eq!(manifest.story.start_page, "p1");
        assert_eq!(manifest.flags.len(), 1);
        assert_eq!(manifest.pages.len(), 2);
        assert_eq!(manifest.pages[0].choices[0].target, "p2");
    }

    #[test]
    fn bundle_round_trip() {
        let manifest = build_manifest(&sample_story(), sample_pages());
        let mut assets = HashMap::new();
        assets.insert("hero.png".into(), vec![0x89, 0x50, 0x4E, 0x47]);

        let contents = BundleContents { manifest: manifest.clone(), assets };
        let packed = pack_bundle(&contents).unwrap();
        let unpacked = unpack_bundle(&packed).unwrap();

        assert_eq!(manifest, unpacked.manifest);
        assert_eq!(unpacked.assets.get("hero.png"), Some(&vec![0x89, 0x50, 0x4E, 0x47]));
    }

    #[test]
    fn unpack_missing_manifest_fails() {
        let mut buf = Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut buf);
            let options = zip::write::SimpleFileOptions::default();
            zip.start_file("not-manifest.txt", options).unwrap();
            zip.write_all(b"hello").unwrap();
            zip.finish().unwrap();
        }
        let result = unpack_bundle(&buf.into_inner());
        assert!(matches!(result, Err(BundleError::MissingManifest)));
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p shared`

Expected: All model tests (3) + bundle tests (3) pass.

- [ ] **Step 3: Commit**

```bash
git add shared/src/bundle.rs
git commit -m "feat: simplify bundle module to use shared model types directly"
```

---

## Task 4: Creation Tool — Rewrite Error Types and Clean Cargo.toml

**Files:**
- Rewrite: `creation-tool/src-tauri/src/error.rs`
- Modify: `creation-tool/src-tauri/Cargo.toml`

- [ ] **Step 1: Rewrite error.rs**

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Bundle error: {0}")]
    Bundle(#[from] shared::bundle::BundleError),

    #[error("No project open")]
    NoProjectOpen,

    #[error("Page not found: {0}")]
    PageNotFound(String),

    #[error("{0}")]
    Custom(String),
}

pub type AppResult<T> = Result<T, AppError>;

impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}
```

- [ ] **Step 2: Update Cargo.toml**

Read `creation-tool/src-tauri/Cargo.toml`. Remove these dependencies:
- `sqlx`
- `chrono`
- `specta`
- `specta-typescript`
- `tauri-specta`
- `toml`
- `futures`
- `dotenv`
- `anyhow`

Remove the `test-server` feature and its optional deps (`axum`, `tower-http`).

Keep: `tauri`, `serde`, `serde_json`, `tokio`, `shared`, `thiserror`, `tauri-plugin-dialog`, `tauri-plugin-fs`.

- [ ] **Step 3: Verify it compiles (it won't yet — main.rs still references old modules)**

This step just ensures the Cargo.toml and error.rs are valid. The build will fail on main.rs — that's expected.

- [ ] **Step 4: Commit**

```bash
git add creation-tool/src-tauri/src/error.rs creation-tool/src-tauri/Cargo.toml
git commit -m "chore: rewrite error types, remove SQLite dependencies"
```

---

## Task 5: Creation Tool — Project Module

**Files:**
- Create: `creation-tool/src-tauri/src/project/mod.rs`
- Create: `creation-tool/src-tauri/src/project/story.rs`
- Create: `creation-tool/src-tauri/src/project/pages.rs`
- Create: `creation-tool/src-tauri/src/project/export.rs`
- Create: `creation-tool/src-tauri/src/project/import.rs`

This is the largest task. The `Project` struct manages a story directory.

- [ ] **Step 1: Create project/mod.rs**

```rust
pub mod story;
pub mod pages;
pub mod export;
pub mod import;

use std::path::PathBuf;
use std::sync::Mutex;
use shared::models::{Story, Page, PageListItem};
use crate::error::{AppError, AppResult};

pub struct Project {
    dir: PathBuf,
    story: Mutex<Story>,
}

impl Project {
    /// Open an existing project from a .story.json file path.
    pub fn open(story_json_path: &str) -> AppResult<Self> {
        let path = PathBuf::from(story_json_path);
        let dir = path
            .parent()
            .ok_or_else(|| AppError::Custom("Invalid story path".into()))?
            .to_path_buf();

        let story = story::read_story(&path)?;

        // Ensure pages/ and assets/ directories exist
        std::fs::create_dir_all(dir.join("pages"))?;
        std::fs::create_dir_all(dir.join("assets"))?;

        Ok(Project {
            dir,
            story: Mutex::new(story),
        })
    }

    /// Create a new project in the given directory.
    pub fn create(dir_path: &str, title: &str) -> AppResult<Self> {
        let dir = PathBuf::from(dir_path);
        std::fs::create_dir_all(&dir)?;
        std::fs::create_dir_all(dir.join("pages"))?;
        std::fs::create_dir_all(dir.join("assets"))?;

        // Create the initial page
        let first_page_id = shared::id::generate_id();
        let first_page = Page {
            id: first_page_id.clone(),
            name: "Start".into(),
            body: String::new(),
            choices: vec![],
            flag_operations: vec![],
        };
        pages::write_page(&dir.join("pages"), &first_page)?;

        // Create the story file
        let story = Story {
            format_version: 1,
            title: title.into(),
            start_page: first_page_id,
            flags: vec![],
        };

        // Derive story filename from directory name
        let dir_name = dir
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("story");
        let story_path = dir.join(format!("{}.story.json", dir_name));
        story::write_story(&story_path, &story)?;

        Ok(Project {
            dir,
            story: Mutex::new(story),
        })
    }

    pub fn dir(&self) -> &PathBuf {
        &self.dir
    }

    pub fn story(&self) -> Story {
        self.story.lock().unwrap().clone()
    }

    pub fn save_story(&self, story: Story) -> AppResult<()> {
        let story_path = self.find_story_file()?;
        story::write_story(&story_path, &story)?;
        *self.story.lock().unwrap() = story;
        Ok(())
    }

    pub fn list_pages(&self) -> AppResult<Vec<PageListItem>> {
        pages::list_pages(&self.dir.join("pages"))
    }

    pub fn read_page(&self, id: &str) -> AppResult<Page> {
        pages::read_page(&self.dir.join("pages"), id)
    }

    pub fn save_page(&self, page: &Page) -> AppResult<()> {
        pages::write_page(&self.dir.join("pages"), page)
    }

    pub fn create_page(&self, name: &str) -> AppResult<Page> {
        let existing_ids: Vec<String> = self
            .list_pages()?
            .iter()
            .map(|p| p.id.clone())
            .collect();
        let existing_refs: Vec<&str> = existing_ids.iter().map(|s| s.as_str()).collect();

        let id = shared::id::generate_unique_id(&existing_refs);
        let page = Page {
            id,
            name: name.into(),
            body: String::new(),
            choices: vec![],
            flag_operations: vec![],
        };
        pages::write_page(&self.dir.join("pages"), &page)?;
        Ok(page)
    }

    pub fn delete_page(&self, id: &str) -> AppResult<()> {
        pages::delete_page(&self.dir.join("pages"), id)
    }

    pub fn export_bundle(&self, output_path: &str) -> AppResult<()> {
        export::export_bundle(self, output_path)
    }

    pub fn import_bundle(&self, _bundle_path: &str) -> AppResult<()> {
        // Import into an existing project — not needed for MVP
        Err(AppError::Custom("Import into existing project not yet supported".into()))
    }

    /// Find the .story.json file in the project directory.
    fn find_story_file(&self) -> AppResult<PathBuf> {
        for entry in std::fs::read_dir(&self.dir)? {
            let entry = entry?;
            let path = entry.path();
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.ends_with(".story.json") {
                    return Ok(path);
                }
            }
        }
        Err(AppError::Custom("No .story.json file found in project".into()))
    }
}
```

- [ ] **Step 2: Create project/story.rs**

```rust
use std::path::Path;
use shared::models::Story;
use crate::error::AppResult;

pub fn read_story(path: &Path) -> AppResult<Story> {
    let json = std::fs::read_to_string(path)?;
    let story: Story = serde_json::from_str(&json)?;
    Ok(story)
}

pub fn write_story(path: &Path, story: &Story) -> AppResult<()> {
    let json = serde_json::to_string_pretty(story)?;
    std::fs::write(path, json)?;
    Ok(())
}
```

- [ ] **Step 3: Create project/pages.rs**

```rust
use std::path::Path;
use shared::models::{Page, PageListItem};
use crate::error::{AppError, AppResult};

fn slugify(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn page_filename(id: &str, name: &str) -> String {
    let slug = slugify(name);
    if slug.is_empty() {
        format!("{}.page.json", id)
    } else {
        format!("{}-{}.page.json", id, slug)
    }
}

/// Find the page file by ID prefix. Returns the full path.
fn find_page_file(pages_dir: &Path, id: &str) -> AppResult<std::path::PathBuf> {
    let prefix = format!("{}", id);
    for entry in std::fs::read_dir(pages_dir)? {
        let entry = entry?;
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if name_str.starts_with(&prefix) && name_str.ends_with(".page.json") {
            return Ok(entry.path());
        }
    }
    Err(AppError::PageNotFound(id.into()))
}

pub fn read_page(pages_dir: &Path, id: &str) -> AppResult<Page> {
    let path = find_page_file(pages_dir, id)?;
    let json = std::fs::read_to_string(path)?;
    let page: Page = serde_json::from_str(&json)?;
    Ok(page)
}

pub fn write_page(pages_dir: &Path, page: &Page) -> AppResult<()> {
    // Remove old file if it exists (name may have changed → filename changes)
    if let Ok(old_path) = find_page_file(pages_dir, &page.id) {
        std::fs::remove_file(old_path)?;
    }

    let filename = page_filename(&page.id, &page.name);
    let path = pages_dir.join(filename);
    let json = serde_json::to_string_pretty(page)?;
    std::fs::write(path, json)?;
    Ok(())
}

pub fn delete_page(pages_dir: &Path, id: &str) -> AppResult<()> {
    let path = find_page_file(pages_dir, id)?;
    std::fs::remove_file(path)?;
    Ok(())
}

pub fn list_pages(pages_dir: &Path) -> AppResult<Vec<PageListItem>> {
    let mut items = Vec::new();

    if !pages_dir.exists() {
        return Ok(items);
    }

    for entry in std::fs::read_dir(pages_dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

        if !name.ends_with(".page.json") {
            continue;
        }

        match std::fs::read_to_string(&path) {
            Ok(json) => {
                if let Ok(page) = serde_json::from_str::<Page>(&json) {
                    items.push(PageListItem::from(&page));
                }
            }
            Err(_) => continue,
        }
    }

    items.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;
    use shared::models::Page;
    use tempfile::TempDir;

    fn make_page(id: &str, name: &str) -> Page {
        Page {
            id: id.into(),
            name: name.into(),
            body: "Content".into(),
            choices: vec![],
            flag_operations: vec![],
        }
    }

    #[test]
    fn write_and_read_page() {
        let tmp = TempDir::new().unwrap();
        let page = make_page("abc12", "Test Page");
        write_page(tmp.path(), &page).unwrap();
        let loaded = read_page(tmp.path(), "abc12").unwrap();
        assert_eq!(page, loaded);
    }

    #[test]
    fn write_page_renames_file_on_name_change() {
        let tmp = TempDir::new().unwrap();
        let page = make_page("abc12", "Old Name");
        write_page(tmp.path(), &page).unwrap();

        let updated = Page { name: "New Name".into(), ..page };
        write_page(tmp.path(), &updated).unwrap();

        // Old file should be gone
        let files: Vec<_> = std::fs::read_dir(tmp.path())
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();
        assert_eq!(files.len(), 1);
        assert!(files[0].contains("new-name"));
    }

    #[test]
    fn list_pages_returns_all() {
        let tmp = TempDir::new().unwrap();
        write_page(tmp.path(), &make_page("aaa11", "Beta")).unwrap();
        write_page(tmp.path(), &make_page("bbb22", "Alpha")).unwrap();

        let items = list_pages(tmp.path()).unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].name, "Alpha"); // sorted
        assert_eq!(items[1].name, "Beta");
    }

    #[test]
    fn delete_page_removes_file() {
        let tmp = TempDir::new().unwrap();
        write_page(tmp.path(), &make_page("abc12", "Test")).unwrap();
        delete_page(tmp.path(), "abc12").unwrap();
        assert!(read_page(tmp.path(), "abc12").is_err());
    }

    #[test]
    fn read_nonexistent_page_returns_error() {
        let tmp = TempDir::new().unwrap();
        assert!(read_page(tmp.path(), "nope").is_err());
    }

    #[test]
    fn slugify_handles_special_chars() {
        assert_eq!(slugify("The Dark Cave"), "the-dark-cave");
        assert_eq!(slugify("Hello   World!"), "hello-world");
        assert_eq!(slugify(""), "");
    }
}
```

- [ ] **Step 4: Create project/export.rs**

```rust
use std::collections::HashMap;
use shared::bundle::{build_manifest, pack_bundle, BundleContents};
use crate::error::AppResult;
use super::Project;

pub fn export_bundle(project: &Project, output_path: &str) -> AppResult<()> {
    let story = project.story();
    let page_list = project.list_pages()?;

    let mut pages = Vec::new();
    for item in &page_list {
        pages.push(project.read_page(&item.id)?);
    }

    let manifest = build_manifest(&story, pages);

    // Collect assets
    let assets_dir = project.dir().join("assets");
    let mut assets = HashMap::new();
    if assets_dir.exists() {
        for entry in std::fs::read_dir(&assets_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    let data = std::fs::read(&path)?;
                    assets.insert(name.to_string(), data);
                }
            }
        }
    }

    let contents = BundleContents { manifest, assets };
    let bundle_data = pack_bundle(&contents)?;
    std::fs::write(output_path, bundle_data)?;
    Ok(())
}
```

- [ ] **Step 5: Create project/import.rs**

Import a `.fabler` bundle into a new project directory.

```rust
use std::path::Path;
use shared::bundle::unpack_bundle;
use shared::models::{Story, Page};
use crate::error::AppResult;
use super::pages;
use super::story;

/// Import a .fabler bundle into a new project directory.
pub fn import_bundle_to_project(bundle_data: &[u8], dir: &Path) -> AppResult<()> {
    let contents = unpack_bundle(bundle_data)?;

    std::fs::create_dir_all(dir)?;
    std::fs::create_dir_all(dir.join("pages"))?;
    std::fs::create_dir_all(dir.join("assets"))?;

    // Write story file
    let s = Story {
        format_version: contents.manifest.format_version,
        title: contents.manifest.story.title.clone(),
        start_page: contents.manifest.story.start_page.clone(),
        flags: contents.manifest.flags.clone(),
    };

    let dir_name = dir
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("story");
    story::write_story(&dir.join(format!("{}.story.json", dir_name)), &s)?;

    // Write page files
    let pages_dir = dir.join("pages");
    for page in &contents.manifest.pages {
        pages::write_page(&pages_dir, page)?;
    }

    // Write assets
    let assets_dir = dir.join("assets");
    for (name, data) in &contents.assets {
        std::fs::write(assets_dir.join(name), data)?;
    }

    Ok(())
}
```

- [ ] **Step 6: Add tempfile dev dependency**

In `creation-tool/src-tauri/Cargo.toml`, add:

```toml
[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 7: Run tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p creation-tool`

Note: This will fail because main.rs still references old modules. Run just the project tests:

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p creation-tool -- project::pages`

If that doesn't work due to main.rs compile errors, temporarily comment out main.rs content and test. The implementer should handle this pragmatically.

- [ ] **Step 8: Commit**

```bash
git add creation-tool/src-tauri/src/project/
git commit -m "feat: add project module for JSON file-based story storage"
```

---

## Task 6: Creation Tool — Rewrite Commands and Main

**Files:**
- Create: `creation-tool/src-tauri/src/commands.rs` (single file replacing commands/ directory)
- Rewrite: `creation-tool/src-tauri/src/main.rs`
- Modify: `creation-tool/src-tauri/src/app/menu.rs`
- Modify: `creation-tool/src-tauri/src/app/mod.rs`
- Delete: `creation-tool/src-tauri/src/commands/` directory
- Delete: `creation-tool/src-tauri/src/db/` directory
- Delete: `creation-tool/src-tauri/src/models/` directory
- Delete: `creation-tool/src-tauri/src/schema.rs`
- Delete: `creation-tool/src-tauri/src/app/setup.rs`
- Delete: `creation-tool/src-tauri/migrations/`

- [ ] **Step 1: Create commands.rs**

```rust
use std::sync::Mutex;
use tauri::State;
use shared::models::{Story, Page, PageListItem};
use crate::project::Project;

pub struct ProjectState(pub Mutex<Option<Project>>);

fn with_project<T>(
    state: &State<ProjectState>,
    f: impl FnOnce(&Project) -> crate::error::AppResult<T>,
) -> Result<T, String> {
    let lock = state.0.lock().unwrap();
    let project = lock
        .as_ref()
        .ok_or_else(|| "No project open".to_string())?;
    f(project).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_project(
    path: String,
    state: State<'_, ProjectState>,
) -> Result<Story, String> {
    let project = Project::open(&path).map_err(|e| e.to_string())?;
    let story = project.story();
    *state.0.lock().unwrap() = Some(project);
    Ok(story)
}

#[tauri::command]
pub async fn create_project(
    path: String,
    title: String,
    state: State<'_, ProjectState>,
) -> Result<Story, String> {
    let project = Project::create(&path, &title).map_err(|e| e.to_string())?;
    let story = project.story();
    *state.0.lock().unwrap() = Some(project);
    Ok(story)
}

#[tauri::command]
pub async fn close_project(state: State<'_, ProjectState>) -> Result<(), String> {
    *state.0.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub async fn get_story(state: State<'_, ProjectState>) -> Result<Story, String> {
    with_project(&state, |p| Ok(p.story()))
}

#[tauri::command]
pub async fn save_story(
    story: Story,
    state: State<'_, ProjectState>,
) -> Result<(), String> {
    with_project(&state, |p| p.save_story(story.clone()))
}

#[tauri::command]
pub async fn list_pages(state: State<'_, ProjectState>) -> Result<Vec<PageListItem>, String> {
    with_project(&state, |p| p.list_pages())
}

#[tauri::command]
pub async fn get_page(
    id: String,
    state: State<'_, ProjectState>,
) -> Result<Page, String> {
    with_project(&state, |p| p.read_page(&id))
}

#[tauri::command]
pub async fn save_page(
    page: Page,
    state: State<'_, ProjectState>,
) -> Result<(), String> {
    with_project(&state, |p| p.save_page(&page))
}

#[tauri::command]
pub async fn create_page(
    name: String,
    state: State<'_, ProjectState>,
) -> Result<Page, String> {
    with_project(&state, |p| p.create_page(&name))
}

#[tauri::command]
pub async fn delete_page(
    id: String,
    state: State<'_, ProjectState>,
) -> Result<(), String> {
    with_project(&state, |p| p.delete_page(&id))
}

#[tauri::command]
pub async fn export_bundle(
    output_path: String,
    state: State<'_, ProjectState>,
) -> Result<(), String> {
    with_project(&state, |p| p.export_bundle(&output_path))
}
```

- [ ] **Step 2: Rewrite main.rs**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app;
mod commands;
mod error;
mod project;

use commands::ProjectState;
use std::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(ProjectState(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle();
            let menu = app::menu::create_menus(&handle)?;
            app.set_menu(menu)?;
            app::menu::setup_menu_handlers(&handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_project,
            commands::create_project,
            commands::close_project,
            commands::get_story,
            commands::save_story,
            commands::list_pages,
            commands::get_page,
            commands::save_page,
            commands::create_page,
            commands::delete_page,
            commands::export_bundle,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Update app/mod.rs**

```rust
pub mod menu;
```

(Remove `pub mod setup;` if present.)

- [ ] **Step 4: Update app/menu.rs**

Read the current file. Make these changes:
- Remove the "Reset database" menu item and its handler
- Keep "Import Story" and "Export Story" menu items and handlers (they emit events to the frontend)
- Keep Edit menu (Cut/Copy/Paste)

- [ ] **Step 5: Delete old modules**

```bash
rm -rf creation-tool/src-tauri/src/commands/
rm -rf creation-tool/src-tauri/src/db/
rm -rf creation-tool/src-tauri/src/models/
rm -f creation-tool/src-tauri/src/schema.rs
rm -f creation-tool/src-tauri/src/app/setup.rs
rm -rf creation-tool/src-tauri/migrations/
rm -f creation-tool/src-tauri/story_nodes.db
```

- [ ] **Step 6: Build**

Run: `cd /Users/jnurminen/cyoa2 && cargo build -p creation-tool`

Fix any compilation errors. Common issues:
- `app/menu.rs` may reference `Database` for reset — remove that handler
- Missing `use` statements in main.rs

- [ ] **Step 7: Run all tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p creation-tool`

Expected: Project module tests (6 pages tests) pass.

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p shared`

Expected: Model tests (3) + bundle tests (3) pass.

- [ ] **Step 8: Commit**

```bash
git add -A creation-tool/src-tauri/
git commit -m "feat: replace SQLite with JSON file-based project storage

Removes: db/, models/, schema.rs, setup.rs, migrations/, all sqlx dependencies
Adds: project/ module, simplified commands.rs
"
```

---

## Task 7: Update Reader App for New Shared Types

**Files:**
- Modify: `reader/src-tauri/src/library.rs`
- Modify: `reader/src-tauri/src/commands.rs`
- Modify: `reader/src-tauri/Cargo.toml`

The reader uses `shared::bundle::Manifest` which now references `shared::models::Page` directly instead of the old `ManifestPage` type. Update the reader to match.

- [ ] **Step 1: Update reader Cargo.toml**

The `shared` crate no longer exports `specta`/`tauri`/`sqlx` types. The reader's dependency on `shared` should still work. Check if any imports need updating.

- [ ] **Step 2: Update library.rs imports and test fixtures**

The `Manifest` type now uses `shared::models::{Page, Flag, Choice, FlagOperation, Condition}` instead of separate `ManifestPage`, `ManifestFlag`, etc. types. Update test fixtures to use the new types.

Read `reader/src-tauri/src/library.rs`. Update:
- Import paths: `use shared::models::{Page, Flag};` instead of `use shared::bundle::{ManifestPage, ManifestFlag};`
- Test fixtures: Use the new `Page` struct (which now has the same shape as old `ManifestPage`)
- The `ManifestStory` type still exists in `shared::bundle` — keep using it

- [ ] **Step 3: Update commands.rs**

Read `reader/src-tauri/src/commands.rs`. The `Manifest` type import should still work. Check for any broken imports.

- [ ] **Step 4: Build and test**

Run: `cd /Users/jnurminen/cyoa2 && cargo build -p fabler-reader && cargo test -p fabler-reader`

Expected: All 12 reader tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add reader/src-tauri/
git commit -m "fix: update reader app for new shared model types"
```

---

## Task 8: Update Player Package for New Types

**Files:**
- Modify: `player/engine/types.ts`

The player's TypeScript types should now match the new shared Rust types. The main changes:
- `ManifestFlagOperation.operation` is already `"set_true" | "set_false" | "toggle"` — keep it
- `ManifestCondition` matches new `Condition` type — already fine
- No `id` fields on FlagOperation/Condition — already removed

- [ ] **Step 1: Verify player types match**

Read `player/engine/types.ts`. Compare with the new `shared/src/models.rs`. The types should already be compatible since we aligned them during the player build. If any mismatches exist, fix them.

- [ ] **Step 2: Run player tests**

Run: `cd /Users/jnurminen/cyoa2/player && npx vitest run && npx playwright test`

Expected: 25 unit tests + 13 E2E tests pass.

- [ ] **Step 3: Commit if changes were needed**

---

## Task 9: Update Creation Tool Frontend Types

**Files:**
- Create: `creation-tool/src/types.ts` (hand-written types replacing bindings.ts)
- Delete: `creation-tool/src/bindings.ts`
- Modify: `creation-tool/src/api.ts`
- Modify: `creation-tool/src/api-http.ts`

- [ ] **Step 1: Create creation-tool/src/types.ts**

```typescript
// Types matching the Rust shared::models types and Tauri commands.
// These replace the auto-generated bindings.ts.

export interface Story {
  format_version: number;
  title: string;
  start_page: string;
  flags: Flag[];
}

export interface Flag {
  id: string;
  name: string;
  default_value: boolean;
}

export interface Page {
  id: string;
  name: string;
  body: string;
  choices: Choice[];
  flag_operations: FlagOperation[];
}

export interface Choice {
  id: string;
  text: string;
  target: string;
  flag_operations: FlagOperation[];
  conditions: Condition[];
}

export interface FlagOperation {
  flag_id: string;
  operation: "set_true" | "set_false" | "toggle";
}

export interface Condition {
  flag_id: string;
  required_value: boolean;
}

export interface PageListItem {
  id: string;
  name: string;
}

export type Result<T, E> =
  | { status: "ok"; data: T }
  | { status: "error"; error: E };
```

- [ ] **Step 2: Rewrite api.ts**

```typescript
import { invoke } from "@tauri-apps/api/core";
import type { Story, Page, PageListItem } from "./types";

const api = {
  openProject: (path: string) =>
    invoke<Story>("open_project", { path }),

  createProject: (path: string, title: string) =>
    invoke<Story>("create_project", { path, title }),

  closeProject: () =>
    invoke<void>("close_project"),

  getStory: () =>
    invoke<Story>("get_story"),

  saveStory: (story: Story) =>
    invoke<void>("save_story", { story }),

  listPages: () =>
    invoke<PageListItem[]>("list_pages"),

  getPage: (id: string) =>
    invoke<Page>("get_page", { id }),

  savePage: (page: Page) =>
    invoke<void>("save_page", { page }),

  createPage: (name: string) =>
    invoke<Page>("create_page", { name }),

  deletePage: (id: string) =>
    invoke<void>("delete_page", { id }),

  exportBundle: (outputPath: string) =>
    invoke<void>("export_bundle", { outputPath }),
};

export default api;
```

Note: The `invoke` function from Tauri already handles serialization and error propagation. No `Result` wrapper needed — errors become rejected promises.

- [ ] **Step 3: Delete bindings.ts**

```bash
rm creation-tool/src/bindings.ts
```

- [ ] **Step 4: Update or delete api-http.ts**

The HTTP API mode (for E2E testing) needs to be updated to match the new command surface, or removed temporarily. For now, create a stub that will be implemented when the frontend is wired up:

```typescript
// TODO: Implement HTTP API adapter for E2E testing with new command surface
// For now, the creation tool only works in Tauri mode.
```

The implementer should either update it to match the new API or remove the dual-mode pattern temporarily.

- [ ] **Step 5: Commit**

```bash
git add creation-tool/src/types.ts creation-tool/src/api.ts
git rm creation-tool/src/bindings.ts
git add creation-tool/src/api-http.ts
git commit -m "feat: replace auto-generated bindings with hand-written types and simplified API"
```

---

## Task 10: Update Manifest Converter and Player Integration

**Files:**
- Modify: `creation-tool/src/player/convertToManifest.ts`
- Modify: `creation-tool/src/player/PlaytestView.tsx`
- Modify: `creation-tool/src/player/PreviewView.tsx`
- Modify: `creation-tool/src/player/__tests__/convertToManifest.test.ts`

Since the creation tool's types now match the player's manifest types almost exactly, the converter becomes much simpler.

- [ ] **Step 1: Simplify convertToManifest.ts**

```typescript
import type { Manifest } from "@fabler/player/engine/types";
import type { Page, Flag, Story } from "../types";

export function convertToManifest(
  story: Story,
  pages: Page[],
): Manifest {
  return {
    format_version: story.format_version,
    story: {
      id: "preview",
      title: story.title,
      start_page: story.start_page,
    },
    flags: story.flags.map((f) => ({
      id: f.id,
      name: f.name,
      default_value: f.default_value,
    })),
    pages: pages.map((p) => ({
      id: p.id,
      name: p.name,
      body: p.body,
      assets: [],
      flag_operations: p.flag_operations.map((op) => ({
        flag_id: op.flag_id,
        operation: op.operation,
      })),
      choices: p.choices.map((c) => ({
        id: c.id,
        text: c.text,
        target: c.target,
        flag_operations: c.flag_operations.map((op) => ({
          flag_id: op.flag_id,
          operation: op.operation,
        })),
        conditions: c.conditions.map((cond) => ({
          flag_id: cond.flag_id,
          required_value: cond.required_value,
        })),
      })),
    })),
  };
}
```

No more `convertPageToManifestPage` — the types are almost identical now, just need to add the `assets` field.

- [ ] **Step 2: Update tests**

Rewrite `convertToManifest.test.ts` to use the new types from `../types` instead of `../../../bindings`.

- [ ] **Step 3: Update PlaytestView.tsx**

Read the current file. Update imports from `../bindings` to `../types`. The `api.getStory()` call now returns `Story` directly (not `Result<Story, string>`). Update accordingly — `invoke` throws on error, no `result.status` check needed.

- [ ] **Step 4: Update PreviewView.tsx**

Update imports from `../bindings` to `../types`. The `Page` type now has `choices` instead of `options`, and `target` instead of `target_page`.

- [ ] **Step 5: Run converter tests**

Run: `cd /Users/jnurminen/cyoa2/creation-tool && npx vitest run`

- [ ] **Step 6: Commit**

```bash
git add creation-tool/src/player/
git commit -m "feat: simplify manifest converter for new type system"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run shared crate tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p shared`

Expected: 6 tests pass (3 model + 3 bundle).

- [ ] **Step 2: Run creation tool Rust tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p creation-tool`

Expected: 6+ project module tests pass.

- [ ] **Step 3: Run reader tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p fabler-reader`

Expected: 12 tests pass.

- [ ] **Step 4: Run player tests**

Run: `cd /Users/jnurminen/cyoa2/player && npx vitest run && npx playwright test`

Expected: 25 + 13 tests pass.

- [ ] **Step 5: Run creation tool converter tests**

Run: `cd /Users/jnurminen/cyoa2/creation-tool && npx vitest run`

Expected: Tests pass.

- [ ] **Step 6: Build all Rust crates**

Run: `cd /Users/jnurminen/cyoa2 && cargo build -p creation-tool && cargo build -p fabler-reader`

Expected: Both compile.
