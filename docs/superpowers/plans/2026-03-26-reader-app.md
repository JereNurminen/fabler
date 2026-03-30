# Reader App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Fabler Reader — a standalone Tauri Mobile + Desktop app that opens `.fabler` bundle files and presents them through the shared player UI. Mobile-first, accessible.

**Architecture:** A new `reader/` Tauri project in the workspace. The Rust backend handles file type registration, bundle unpacking, save slot persistence (JSON files on disk), and asset serving. The frontend is the shared `@fabler/player` package plus a thin library screen. No database — story data lives in unpacked bundle directories, saves live as JSON files alongside them.

**Tech Stack:** Rust (Tauri 2.0, zip via shared crate), TypeScript, React 18, `@fabler/player`, Tailwind CSS 4, Vite

---

## File Map

### Rust — `reader/src-tauri/`

| File | Responsibility |
|---|---|
| `reader/src-tauri/Cargo.toml` | Tauri app with shared crate dependency |
| `reader/src-tauri/build.rs` | Tauri build script |
| `reader/src-tauri/tauri.conf.json` | Reader app config — mobile targets, file associations, window |
| `reader/src-tauri/src/main.rs` | App setup, command registration, plugin init |
| `reader/src-tauri/src/error.rs` | Error types |
| `reader/src-tauri/src/library.rs` | Story library management — list, install, delete stories |
| `reader/src-tauri/src/storage.rs` | Save slot persistence — read/write JSON files |
| `reader/src-tauri/src/assets.rs` | Asset serving from unpacked bundle directories |
| `reader/src-tauri/src/commands.rs` | Tauri commands exposing library, storage, asset operations |

### TypeScript — `reader/src/`

| File | Responsibility |
|---|---|
| `reader/package.json` | Package config with player + Tauri deps |
| `reader/tsconfig.json` | TypeScript config |
| `reader/vite.config.ts` | Vite bundler config |
| `reader/src/main.tsx` | App entry point |
| `reader/src/index.css` | Global styles |
| `reader/src/App.tsx` | Router — library vs player screen |
| `reader/src/screens/LibraryScreen.tsx` | Grid of installed stories |
| `reader/src/screens/PlayerScreen.tsx` | Mounts StoryPlayer with Tauri-backed adapters |
| `reader/src/adapters/TauriStorageAdapter.ts` | StorageAdapter backed by Tauri commands |
| `reader/src/adapters/TauriAssetResolver.ts` | AssetResolver backed by Tauri asset protocol |
| `reader/src/types.ts` | Reader-specific types (InstalledStory, etc.) |

### Modifications to existing files

| File | Change |
|---|---|
| `Cargo.toml` (root) | Add `reader/src-tauri` to workspace members |

---

## Task 1: Scaffold Tauri Project

**Files:**
- Create: `reader/src-tauri/Cargo.toml`
- Create: `reader/src-tauri/build.rs`
- Create: `reader/src-tauri/tauri.conf.json`
- Create: `reader/src-tauri/src/main.rs` (minimal)
- Create: `reader/src-tauri/src/error.rs`
- Modify: `Cargo.toml` (root workspace)

- [ ] **Step 1: Add reader to workspace**

In `/Users/jnurminen/cyoa2/Cargo.toml`, add `"reader/src-tauri"` to the workspace members list:

```toml
[workspace]
members = [
    "shared",
    "creation-tool/src-tauri",
    "reader/src-tauri",
]
resolver = "2"
```

- [ ] **Step 2: Create reader/src-tauri/Cargo.toml**

```toml
[package]
name = "fabler-reader"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "^2.0.0-rc.12", features = [] }

[dependencies]
tauri = { version = "2.0.0-rc.15", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1.40.0", features = ["full"] }
shared = { path = "../../shared" }
thiserror = "2"
tauri-plugin-dialog = "2.0.0-rc"
tauri-plugin-fs = "2.0.0-rc"

[features]
custom-protocol = ["tauri/custom-protocol"]
```

- [ ] **Step 3: Create reader/src-tauri/build.rs**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 4: Create reader/src-tauri/tauri.conf.json**

```json
{
  "build": {
    "beforeDevCommand": "yarn dev",
    "beforeBuildCommand": "yarn build",
    "devUrl": "http://localhost:1421",
    "frontendDist": "../dist"
  },
  "productName": "Fabler Reader",
  "version": "0.1.0",
  "app": {
    "windows": [
      {
        "title": "Fabler Reader",
        "width": 420,
        "height": 720
      }
    ],
    "security": {
      "csp": null,
      "capabilities": [
        {
          "identifier": "reader-core",
          "permissions": [
            "core:default",
            "dialog:default",
            "fs:allow-read-text-file",
            "fs:allow-write-text-file",
            "fs:allow-read-file",
            "fs:allow-app-read-recursive",
            "fs:allow-app-write-recursive"
          ],
          "windows": ["main"]
        }
      ]
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "fileAssociations": [
      {
        "ext": ["fabler"],
        "mimeType": "application/x-fabler",
        "description": "Fabler Story Bundle"
      }
    ]
  },
  "identifier": "com.fabler.reader"
}
```

Key differences from creation tool:
- Port 1421 (avoids conflict with creation tool's 1420)
- Window size 420x720 (mobile-proportioned for development)
- File associations for `.fabler` extension
- Broader fs permissions (needs to read binary assets, manage app data directory)
- Separate bundle identifier

- [ ] **Step 5: Create minimal main.rs**

Create `reader/src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 6: Create error.rs**

Create `reader/src-tauri/src/error.rs`:

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ReaderError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Bundle error: {0}")]
    Bundle(String),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Story not found: {0}")]
    StoryNotFound(String),

    #[error("{0}")]
    Custom(String),
}

pub type ReaderResult<T> = Result<T, ReaderError>;

impl From<ReaderError> for String {
    fn from(err: ReaderError) -> Self {
        err.to_string()
    }
}

impl From<shared::bundle::BundleError> for ReaderError {
    fn from(err: shared::bundle::BundleError) -> Self {
        ReaderError::Bundle(err.to_string())
    }
}
```

- [ ] **Step 7: Verify it compiles**

Run: `cd /Users/jnurminen/cyoa2 && cargo build -p fabler-reader`

Note: This will fail without the frontend dist directory. Create a placeholder:

```bash
mkdir -p reader/dist && echo '<html><body>placeholder</body></html>' > reader/dist/index.html
```

Then build again.

- [ ] **Step 8: Commit**

```bash
git add Cargo.toml reader/src-tauri/ reader/dist/index.html
git commit -m "feat: scaffold Tauri reader app project"
```

---

## Task 2: Story Library Management (Rust)

**Files:**
- Create: `reader/src-tauri/src/library.rs`

The library manages installed stories in the app data directory:

```
{app_data_dir}/
├── stories/
│   ├── {story-id}/
│   │   ├── manifest.json
│   │   ├── assets/
│   │   │   ├── hero.png
│   │   │   └── ...
│   │   └── saves/
│   │       ├── slot-1234.json
│   │       └── ...
│   └── {another-story-id}/
│       └── ...
```

- [ ] **Step 1: Create library.rs**

Create `reader/src-tauri/src/library.rs`:

```rust
use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};
use shared::bundle::{unpack_bundle, Manifest};
use crate::error::{ReaderError, ReaderResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledStory {
    pub id: String,
    pub title: String,
    pub path: String,
}

pub struct Library {
    stories_dir: PathBuf,
}

impl Library {
    pub fn new(app_data_dir: &Path) -> ReaderResult<Self> {
        let stories_dir = app_data_dir.join("stories");
        fs::create_dir_all(&stories_dir)?;
        Ok(Library { stories_dir })
    }

    /// Install a .fabler bundle from raw bytes
    pub fn install_bundle(&self, bundle_data: &[u8]) -> ReaderResult<InstalledStory> {
        let contents = unpack_bundle(bundle_data)?;
        let story_id = &contents.manifest.story.id;
        let story_dir = self.stories_dir.join(story_id);

        // Remove existing installation if present
        if story_dir.exists() {
            fs::remove_dir_all(&story_dir)?;
        }

        fs::create_dir_all(&story_dir)?;
        fs::create_dir_all(story_dir.join("assets"))?;
        fs::create_dir_all(story_dir.join("saves"))?;

        // Write manifest
        let manifest_json = serde_json::to_string_pretty(&contents.manifest)?;
        fs::write(story_dir.join("manifest.json"), manifest_json)?;

        // Write assets
        for (name, data) in &contents.assets {
            fs::write(story_dir.join("assets").join(name), data)?;
        }

        Ok(InstalledStory {
            id: story_id.clone(),
            title: contents.manifest.story.title.clone(),
            path: story_dir.to_string_lossy().to_string(),
        })
    }

    /// List all installed stories
    pub fn list_stories(&self) -> ReaderResult<Vec<InstalledStory>> {
        let mut stories = Vec::new();

        if !self.stories_dir.exists() {
            return Ok(stories);
        }

        for entry in fs::read_dir(&self.stories_dir)? {
            let entry = entry?;
            let path = entry.path();

            if !path.is_dir() {
                continue;
            }

            let manifest_path = path.join("manifest.json");
            if !manifest_path.exists() {
                continue;
            }

            match self.read_manifest(&manifest_path) {
                Ok(manifest) => {
                    stories.push(InstalledStory {
                        id: manifest.story.id,
                        title: manifest.story.title,
                        path: path.to_string_lossy().to_string(),
                    });
                }
                Err(_) => continue, // Skip corrupted stories
            }
        }

        stories.sort_by(|a, b| a.title.cmp(&b.title));
        Ok(stories)
    }

    /// Get the manifest for an installed story
    pub fn get_manifest(&self, story_id: &str) -> ReaderResult<Manifest> {
        let manifest_path = self.stories_dir.join(story_id).join("manifest.json");
        if !manifest_path.exists() {
            return Err(ReaderError::StoryNotFound(story_id.to_string()));
        }
        self.read_manifest(&manifest_path)
    }

    /// Get the path to an asset file for a story
    pub fn get_asset_path(&self, story_id: &str, asset_name: &str) -> ReaderResult<PathBuf> {
        let asset_path = self.stories_dir.join(story_id).join("assets").join(asset_name);
        if !asset_path.exists() {
            return Err(ReaderError::Custom(format!(
                "Asset not found: {asset_name} in story {story_id}"
            )));
        }
        Ok(asset_path)
    }

    /// Delete an installed story
    pub fn delete_story(&self, story_id: &str) -> ReaderResult<()> {
        let story_dir = self.stories_dir.join(story_id);
        if story_dir.exists() {
            fs::remove_dir_all(&story_dir)?;
        }
        Ok(())
    }

    fn read_manifest(&self, path: &Path) -> ReaderResult<Manifest> {
        let json = fs::read_to_string(path)?;
        let manifest: Manifest = serde_json::from_str(&json)?;
        Ok(manifest)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use shared::bundle::{pack_bundle, BundleContents, ManifestStory, ManifestPage, Manifest};
    use std::collections::HashMap;
    use tempfile::TempDir;

    fn make_test_bundle() -> Vec<u8> {
        let contents = BundleContents {
            manifest: Manifest::new(
                ManifestStory {
                    id: "test-story".into(),
                    title: "Test Story".into(),
                    start_page: "p1".into(),
                },
                vec![],
                vec![ManifestPage {
                    id: "p1".into(),
                    name: "Start".into(),
                    body: "Hello".into(),
                    assets: vec![],
                    flag_operations: vec![],
                    choices: vec![],
                }],
            ),
            assets: HashMap::new(),
        };
        pack_bundle(&contents).unwrap()
    }

    fn make_test_bundle_with_assets() -> Vec<u8> {
        let mut assets = HashMap::new();
        assets.insert("hero.png".into(), vec![0x89, 0x50, 0x4E, 0x47]);

        let contents = BundleContents {
            manifest: Manifest::new(
                ManifestStory {
                    id: "asset-story".into(),
                    title: "Story With Assets".into(),
                    start_page: "p1".into(),
                },
                vec![],
                vec![ManifestPage {
                    id: "p1".into(),
                    name: "Start".into(),
                    body: "Look at the image".into(),
                    assets: vec!["hero.png".into()],
                    flag_operations: vec![],
                    choices: vec![],
                }],
            ),
            assets,
        };
        pack_bundle(&contents).unwrap()
    }

    #[test]
    fn install_and_list() {
        let tmp = TempDir::new().unwrap();
        let library = Library::new(tmp.path()).unwrap();

        let bundle = make_test_bundle();
        let installed = library.install_bundle(&bundle).unwrap();
        assert_eq!(installed.id, "test-story");
        assert_eq!(installed.title, "Test Story");

        let stories = library.list_stories().unwrap();
        assert_eq!(stories.len(), 1);
        assert_eq!(stories[0].id, "test-story");
    }

    #[test]
    fn install_with_assets() {
        let tmp = TempDir::new().unwrap();
        let library = Library::new(tmp.path()).unwrap();

        let bundle = make_test_bundle_with_assets();
        library.install_bundle(&bundle).unwrap();

        let asset_path = library.get_asset_path("asset-story", "hero.png").unwrap();
        assert!(asset_path.exists());
        assert_eq!(fs::read(&asset_path).unwrap(), vec![0x89, 0x50, 0x4E, 0x47]);
    }

    #[test]
    fn get_manifest() {
        let tmp = TempDir::new().unwrap();
        let library = Library::new(tmp.path()).unwrap();

        let bundle = make_test_bundle();
        library.install_bundle(&bundle).unwrap();

        let manifest = library.get_manifest("test-story").unwrap();
        assert_eq!(manifest.story.title, "Test Story");
        assert_eq!(manifest.pages.len(), 1);
    }

    #[test]
    fn delete_story() {
        let tmp = TempDir::new().unwrap();
        let library = Library::new(tmp.path()).unwrap();

        let bundle = make_test_bundle();
        library.install_bundle(&bundle).unwrap();
        assert_eq!(library.list_stories().unwrap().len(), 1);

        library.delete_story("test-story").unwrap();
        assert_eq!(library.list_stories().unwrap().len(), 0);
    }

    #[test]
    fn reinstall_overwrites() {
        let tmp = TempDir::new().unwrap();
        let library = Library::new(tmp.path()).unwrap();

        let bundle = make_test_bundle();
        library.install_bundle(&bundle).unwrap();
        library.install_bundle(&bundle).unwrap(); // Should not fail

        assert_eq!(library.list_stories().unwrap().len(), 1);
    }

    #[test]
    fn story_not_found() {
        let tmp = TempDir::new().unwrap();
        let library = Library::new(tmp.path()).unwrap();

        let result = library.get_manifest("nonexistent");
        assert!(result.is_err());
    }
}
```

- [ ] **Step 2: Add tempfile dev dependency**

In `reader/src-tauri/Cargo.toml`, add:

```toml
[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 3: Add module to main.rs**

In `reader/src-tauri/src/main.rs`, add:

```rust
mod error;
mod library;
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p fabler-reader`

Expected: All 6 library tests pass.

- [ ] **Step 5: Commit**

```bash
git add reader/src-tauri/
git commit -m "feat: add story library management for reader app"
```

---

## Task 3: Save Slot Persistence (Rust)

**Files:**
- Create: `reader/src-tauri/src/storage.rs`

Save slots are stored as JSON files in `{story_dir}/saves/`.

- [ ] **Step 1: Create storage.rs**

Create `reader/src-tauri/src/storage.rs`:

```rust
use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};
use crate::error::ReaderResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedState {
    #[serde(rename = "gameState")]
    pub game_state: GameStateData,
    pub name: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameStateData {
    #[serde(rename = "currentPageId")]
    pub current_page_id: String,
    pub flags: std::collections::HashMap<String, bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlotInfo {
    #[serde(rename = "slotId")]
    pub slot_id: String,
    pub name: String,
    pub timestamp: u64,
}

pub struct SaveStorage {
    stories_dir: PathBuf,
}

impl SaveStorage {
    pub fn new(stories_dir: &Path) -> Self {
        SaveStorage {
            stories_dir: stories_dir.to_path_buf(),
        }
    }

    fn saves_dir(&self, story_id: &str) -> PathBuf {
        self.stories_dir.join(story_id).join("saves")
    }

    fn slot_path(&self, story_id: &str, slot_id: &str) -> PathBuf {
        self.saves_dir(story_id).join(format!("{slot_id}.json"))
    }

    pub fn save_slot(&self, story_id: &str, slot_id: &str, state: &SavedState) -> ReaderResult<()> {
        let saves_dir = self.saves_dir(story_id);
        fs::create_dir_all(&saves_dir)?;
        let json = serde_json::to_string_pretty(state)?;
        fs::write(self.slot_path(story_id, slot_id), json)?;
        Ok(())
    }

    pub fn load_slot(&self, story_id: &str, slot_id: &str) -> ReaderResult<Option<SavedState>> {
        let path = self.slot_path(story_id, slot_id);
        if !path.exists() {
            return Ok(None);
        }
        let json = fs::read_to_string(path)?;
        let state: SavedState = serde_json::from_str(&json)?;
        Ok(Some(state))
    }

    pub fn list_slots(&self, story_id: &str) -> ReaderResult<Vec<SlotInfo>> {
        let saves_dir = self.saves_dir(story_id);
        if !saves_dir.exists() {
            return Ok(vec![]);
        }

        let mut slots = Vec::new();
        for entry in fs::read_dir(&saves_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }

            let slot_id = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            match fs::read_to_string(&path) {
                Ok(json) => {
                    if let Ok(state) = serde_json::from_str::<SavedState>(&json) {
                        slots.push(SlotInfo {
                            slot_id,
                            name: state.name,
                            timestamp: state.timestamp,
                        });
                    }
                }
                Err(_) => continue,
            }
        }

        slots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Ok(slots)
    }

    pub fn delete_slot(&self, story_id: &str, slot_id: &str) -> ReaderResult<()> {
        let path = self.slot_path(story_id, slot_id);
        if path.exists() {
            fs::remove_file(path)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_saved_state(name: &str) -> SavedState {
        SavedState {
            game_state: GameStateData {
                current_page_id: "p1".into(),
                flags: std::collections::HashMap::from([("f1".into(), true)]),
            },
            name: name.into(),
            timestamp: 1000,
        }
    }

    #[test]
    fn save_and_load() {
        let tmp = TempDir::new().unwrap();
        let stories_dir = tmp.path().join("stories");
        fs::create_dir_all(stories_dir.join("s1")).unwrap();
        let storage = SaveStorage::new(&stories_dir);

        let state = make_saved_state("My Save");
        storage.save_slot("s1", "slot-1", &state).unwrap();

        let loaded = storage.load_slot("s1", "slot-1").unwrap().unwrap();
        assert_eq!(loaded.name, "My Save");
        assert_eq!(loaded.game_state.current_page_id, "p1");
        assert_eq!(loaded.game_state.flags.get("f1"), Some(&true));
    }

    #[test]
    fn load_nonexistent_returns_none() {
        let tmp = TempDir::new().unwrap();
        let storage = SaveStorage::new(tmp.path());
        let result = storage.load_slot("s1", "nope").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn list_slots() {
        let tmp = TempDir::new().unwrap();
        let stories_dir = tmp.path().join("stories");
        fs::create_dir_all(stories_dir.join("s1")).unwrap();
        let storage = SaveStorage::new(&stories_dir);

        storage.save_slot("s1", "slot-a", &SavedState {
            name: "Save A".into(),
            timestamp: 1000,
            ..make_saved_state("Save A")
        }).unwrap();

        storage.save_slot("s1", "slot-b", &SavedState {
            name: "Save B".into(),
            timestamp: 2000,
            ..make_saved_state("Save B")
        }).unwrap();

        let slots = storage.list_slots("s1").unwrap();
        assert_eq!(slots.len(), 2);
        assert_eq!(slots[0].name, "Save B"); // Newest first
        assert_eq!(slots[1].name, "Save A");
    }

    #[test]
    fn delete_slot() {
        let tmp = TempDir::new().unwrap();
        let stories_dir = tmp.path().join("stories");
        fs::create_dir_all(stories_dir.join("s1")).unwrap();
        let storage = SaveStorage::new(&stories_dir);

        storage.save_slot("s1", "slot-1", &make_saved_state("X")).unwrap();
        assert_eq!(storage.list_slots("s1").unwrap().len(), 1);

        storage.delete_slot("s1", "slot-1").unwrap();
        assert_eq!(storage.list_slots("s1").unwrap().len(), 0);
    }
}
```

- [ ] **Step 2: Add module to main.rs**

```rust
mod storage;
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p fabler-reader`

Expected: All library + storage tests pass.

- [ ] **Step 4: Commit**

```bash
git add reader/src-tauri/src/storage.rs reader/src-tauri/src/main.rs
git commit -m "feat: add save slot persistence for reader app"
```

---

## Task 4: Tauri Commands

**Files:**
- Create: `reader/src-tauri/src/commands.rs`
- Modify: `reader/src-tauri/src/main.rs`

- [ ] **Step 1: Create commands.rs**

Create `reader/src-tauri/src/commands.rs`:

```rust
use tauri::State;
use crate::library::{Library, InstalledStory};
use crate::storage::{SaveStorage, SavedState, SlotInfo};
use shared::bundle::Manifest;

// -- Library commands --

#[tauri::command]
pub async fn list_stories(library: State<'_, Library>) -> Result<Vec<InstalledStory>, String> {
    library.list_stories().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn install_bundle(bundle_data: Vec<u8>, library: State<'_, Library>) -> Result<InstalledStory, String> {
    library.install_bundle(&bundle_data).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_manifest(story_id: String, library: State<'_, Library>) -> Result<Manifest, String> {
    library.get_manifest(&story_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_story(story_id: String, library: State<'_, Library>) -> Result<(), String> {
    library.delete_story(&story_id).map_err(|e| e.to_string())
}

// -- Save commands --

#[tauri::command]
pub async fn save_slot(
    story_id: String,
    slot_id: String,
    state: SavedState,
    storage: State<'_, SaveStorage>,
) -> Result<(), String> {
    storage.save_slot(&story_id, &slot_id, &state).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_slot(
    story_id: String,
    slot_id: String,
    storage: State<'_, SaveStorage>,
) -> Result<Option<SavedState>, String> {
    storage.load_slot(&story_id, &slot_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_slots(
    story_id: String,
    storage: State<'_, SaveStorage>,
) -> Result<Vec<SlotInfo>, String> {
    storage.list_slots(&story_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_slot(
    story_id: String,
    slot_id: String,
    storage: State<'_, SaveStorage>,
) -> Result<(), String> {
    storage.delete_slot(&story_id, &slot_id).map_err(|e| e.to_string())
}
```

- [ ] **Step 2: Wire up main.rs with setup and commands**

Replace `reader/src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod error;
mod library;
mod storage;

use library::Library;
use storage::SaveStorage;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");

            std::fs::create_dir_all(&app_data_dir)?;

            let library = Library::new(&app_data_dir)?;
            let stories_dir = app_data_dir.join("stories");
            let save_storage = SaveStorage::new(&stories_dir);

            app.manage(library);
            app.manage(save_storage);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_stories,
            commands::install_bundle,
            commands::get_manifest,
            commands::delete_story,
            commands::save_slot,
            commands::load_slot,
            commands::list_slots,
            commands::delete_slot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/jnurminen/cyoa2 && cargo build -p fabler-reader`

- [ ] **Step 4: Commit**

```bash
git add reader/src-tauri/src/
git commit -m "feat: add Tauri commands for library and save management"
```

---

## Task 5: Reader Frontend — Package Setup

**Files:**
- Create: `reader/package.json`
- Create: `reader/tsconfig.json`
- Create: `reader/vite.config.ts`
- Create: `reader/postcss.config.js`
- Create: `reader/src/index.css`
- Modify: root `package.json` (add reader to workspaces)

- [ ] **Step 1: Add reader to yarn workspaces**

Update `/Users/jnurminen/cyoa2/package.json`:

```json
{
  "private": true,
  "workspaces": [
    "player",
    "creation-tool",
    "reader"
  ]
}
```

- [ ] **Step 2: Create reader/package.json**

```json
{
  "name": "@fabler/reader",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "tauri": "tauri"
  },
  "dependencies": {
    "@fabler/player": "workspace:*",
    "@tauri-apps/api": "^2.0.0-rc.5",
    "@tauri-apps/plugin-dialog": "^2.0.1",
    "@tauri-apps/plugin-fs": "^2.4.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0-rc.16",
    "@types/react": "^18.2.15",
    "@types/react-dom": "^18.2.7",
    "@vitejs/plugin-react": "^4.2.1",
    "tailwindcss": "^4.1.18",
    "@tailwindcss/postcss": "^4.1.18",
    "postcss": "^8.5.6",
    "typescript": "^5.2.2",
    "vite": "^5.3.1"
  }
}
```

- [ ] **Step 3: Create reader/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create reader/vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1421,
    strictPort: true,
  },
  clearScreen: false,
  envPrefix: ["VITE_", "TAURI_"],
});
```

- [ ] **Step 5: Create reader/postcss.config.js**

```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- [ ] **Step 6: Create reader/src/index.css**

```css
@import "tailwindcss";
@import "@fabler/player/ui/player.css";

html, body, #root {
  height: 100%;
  margin: 0;
}
```

- [ ] **Step 7: Install dependencies**

Run: `cd /Users/jnurminen/cyoa2 && yarn install`

- [ ] **Step 8: Commit**

```bash
git add package.json reader/package.json reader/tsconfig.json reader/vite.config.ts reader/postcss.config.js reader/src/index.css reader/yarn.lock
git commit -m "feat: scaffold reader frontend with Vite, React, Tailwind"
```

---

## Task 6: Tauri Adapters (TypeScript)

**Files:**
- Create: `reader/src/adapters/TauriStorageAdapter.ts`
- Create: `reader/src/adapters/TauriAssetResolver.ts`
- Create: `reader/src/types.ts`

- [ ] **Step 1: Create reader types**

Create `reader/src/types.ts`:

```typescript
export interface InstalledStory {
  id: string;
  title: string;
  path: string;
}
```

- [ ] **Step 2: Create TauriStorageAdapter**

Create `reader/src/adapters/TauriStorageAdapter.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";
import type { StorageAdapter, SavedState, SlotInfo } from "@fabler/player/engine/types";

export class TauriStorageAdapter implements StorageAdapter {
  async saveSlot(storyId: string, slotId: string, state: SavedState): Promise<void> {
    await invoke("save_slot", { storyId, slotId, state });
  }

  async loadSlot(storyId: string, slotId: string): Promise<SavedState | null> {
    return await invoke("load_slot", { storyId, slotId });
  }

  async listSlots(storyId: string): Promise<SlotInfo[]> {
    return await invoke("list_slots", { storyId });
  }

  async deleteSlot(storyId: string, slotId: string): Promise<void> {
    await invoke("delete_slot", { storyId, slotId });
  }
}
```

- [ ] **Step 3: Create TauriAssetResolver**

Create `reader/src/adapters/TauriAssetResolver.ts`:

```typescript
import { convertFileSrc } from "@tauri-apps/api/core";
import type { AssetResolver } from "@fabler/player/engine/types";

export class TauriAssetResolver implements AssetResolver {
  private storyPath: string;

  constructor(storyPath: string) {
    this.storyPath = storyPath;
  }

  getAssetUrl(assetPath: string): string {
    return convertFileSrc(`${this.storyPath}/assets/${assetPath}`);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add reader/src/types.ts reader/src/adapters/
git commit -m "feat: add Tauri-backed StorageAdapter and AssetResolver"
```

---

## Task 7: Library Screen

**Files:**
- Create: `reader/src/screens/LibraryScreen.tsx`

- [ ] **Step 1: Create LibraryScreen**

```tsx
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import type { InstalledStory } from "../types";

interface LibraryScreenProps {
  onPlay: (story: InstalledStory) => void;
}

export function LibraryScreen({ onPlay }: LibraryScreenProps) {
  const [stories, setStories] = useState<InstalledStory[]>([]);

  const refreshStories = useCallback(async () => {
    const list = await invoke<InstalledStory[]>("list_stories");
    setStories(list);
  }, []);

  useEffect(() => {
    refreshStories();
  }, [refreshStories]);

  const handleImport = async () => {
    const filePath = await open({
      filters: [{ name: "Fabler Story", extensions: ["fabler"] }],
    });
    if (!filePath) return;

    const data = await readFile(filePath);
    await invoke("install_bundle", { bundleData: Array.from(data) });
    refreshStories();
  };

  const handleDelete = async (storyId: string) => {
    await invoke("delete_story", { storyId });
    refreshStories();
  };

  return (
    <div
      className="h-full flex flex-col"
      data-theme="light"
      data-font-size="medium"
      style={{ backgroundColor: "var(--player-bg)" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{
          backgroundColor: "var(--player-surface)",
          borderBottom: "1px solid var(--player-border)",
        }}
      >
        <h1
          className="text-lg font-bold"
          style={{ color: "var(--player-text)" }}
        >
          Fabler Reader
        </h1>
        <button
          onClick={handleImport}
          className="px-4 py-2 rounded-lg font-medium min-h-[44px] cursor-pointer"
          style={{
            backgroundColor: "var(--player-accent)",
            color: "var(--player-accent-text)",
          }}
        >
          Open Story
        </button>
      </header>

      {/* Story grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {stories.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p
              className="text-center italic"
              style={{ color: "var(--player-text-muted)" }}
            >
              No stories installed. Tap "Open Story" to add one.
            </p>
          </div>
        ) : (
          <ul className="list-none p-0 m-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stories.map((story) => (
              <li key={story.id}>
                <button
                  onClick={() => onPlay(story)}
                  className="w-full text-left p-4 rounded-xl border min-h-[80px] cursor-pointer
                             transition-colors duration-150"
                  style={{
                    backgroundColor: "var(--player-choice-bg)",
                    borderColor: "var(--player-choice-border)",
                    color: "var(--player-choice-text)",
                  }}
                >
                  <div className="font-semibold text-lg">{story.title}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add reader/src/screens/LibraryScreen.tsx
git commit -m "feat: add library screen for browsing installed stories"
```

---

## Task 8: Player Screen

**Files:**
- Create: `reader/src/screens/PlayerScreen.tsx`

- [ ] **Step 1: Create PlayerScreen**

```tsx
import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { StoryPlayer } from "@fabler/player/ui";
import type { Manifest } from "@fabler/player/engine/types";
import { TauriStorageAdapter } from "../adapters/TauriStorageAdapter";
import { TauriAssetResolver } from "../adapters/TauriAssetResolver";
import type { InstalledStory } from "../types";

interface PlayerScreenProps {
  story: InstalledStory;
  onBack: () => void;
}

export function PlayerScreen({ story, onBack }: PlayerScreenProps) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const storageRef = useRef(new TauriStorageAdapter());
  const assetsRef = useRef(new TauriAssetResolver(story.path));

  useEffect(() => {
    async function load() {
      const m = await invoke<Manifest>("get_manifest", { storyId: story.id });
      setManifest(m);
    }
    load();
  }, [story.id]);

  if (!manifest) {
    return (
      <div className="h-full flex items-center justify-center"
        style={{ backgroundColor: "var(--player-bg)", color: "var(--player-text)" }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Back button bar */}
      <div
        className="flex items-center px-2 py-1 shrink-0"
        style={{
          backgroundColor: "var(--player-surface)",
          borderBottom: "1px solid var(--player-border)",
        }}
      >
        <button
          onClick={onBack}
          aria-label="Back to library"
          className="p-2 rounded min-w-[44px] min-h-[44px] cursor-pointer text-sm"
          style={{ color: "var(--player-text-muted)" }}
        >
          ← Library
        </button>
      </div>

      {/* Player */}
      <div className="flex-1 overflow-hidden">
        <StoryPlayer
          manifest={manifest}
          storage={storageRef.current}
          assets={assetsRef.current}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add reader/src/screens/PlayerScreen.tsx
git commit -m "feat: add player screen with Tauri-backed storage and assets"
```

---

## Task 9: App Shell and Entry Point

**Files:**
- Create: `reader/src/App.tsx`
- Create: `reader/src/main.tsx`
- Create: `reader/index.html`

- [ ] **Step 1: Create App.tsx**

```tsx
import { useState } from "react";
import { LibraryScreen } from "./screens/LibraryScreen";
import { PlayerScreen } from "./screens/PlayerScreen";
import type { InstalledStory } from "./types";

type Screen =
  | { type: "library" }
  | { type: "player"; story: InstalledStory };

export function App() {
  const [screen, setScreen] = useState<Screen>({ type: "library" });

  if (screen.type === "player") {
    return (
      <PlayerScreen
        story={screen.story}
        onBack={() => setScreen({ type: "library" })}
      />
    );
  }

  return (
    <LibraryScreen
      onPlay={(story) => setScreen({ type: "player", story })}
    />
  );
}
```

- [ ] **Step 2: Create main.tsx**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Fabler Reader</title>
    <style>
      body { margin: 0; overflow: hidden; }
    </style>
  </head>
  <body>
    <div id="root" style="height: 100vh"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Note: `viewport-fit=cover` ensures content extends behind the safe area on iOS, which we can then handle with CSS `env(safe-area-inset-*)`.

- [ ] **Step 4: Remove placeholder dist/index.html**

```bash
rm reader/dist/index.html && rmdir reader/dist
```

- [ ] **Step 5: Verify frontend compiles**

Run: `cd /Users/jnurminen/cyoa2/reader && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add reader/src/App.tsx reader/src/main.tsx reader/index.html
git commit -m "feat: add reader app shell with library → player navigation"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run all Rust tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p fabler-reader`

Expected: All library (6) + storage (4) tests pass.

- [ ] **Step 2: Run shared crate tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p shared`

Expected: All 14 tests pass.

- [ ] **Step 3: Verify reader Rust compiles**

Run: `cd /Users/jnurminen/cyoa2 && cargo build -p fabler-reader`

- [ ] **Step 4: Verify reader frontend compiles**

Run: `cd /Users/jnurminen/cyoa2/reader && npx tsc --noEmit`

- [ ] **Step 5: Verify creation tool still compiles**

Run: `cd /Users/jnurminen/cyoa2 && cargo build -p creation-tool`

- [ ] **Step 6: Run player tests (no regression)**

Run: `cd /Users/jnurminen/cyoa2/player && npx vitest run && npx playwright test`

Expected: 25 unit tests + 13 E2E tests all pass.
