# Player Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the .fabler bundle format, player engine, and player UI — testable standalone in a browser with no Tauri dependency.

**Architecture:** Rust `shared` crate gets a `bundle` module for zip packing/unpacking with a JSON manifest. A new `player/` TypeScript package contains a pure-logic engine (no framework) and a React UI layer. The player reads manifests, evaluates game state, and renders pages with choices. Two adapter interfaces (StorageAdapter, AssetResolver) abstract persistence and asset loading for future host environments.

**Tech Stack:** Rust (zip crate, serde_json), TypeScript, React 18, Vitest, Playwright, @axe-core/playwright, Tailwind CSS 4

---

## File Map

### Rust — `shared/` crate additions

| File | Responsibility |
|---|---|
| `shared/src/bundle.rs` | Manifest types, zip packing/unpacking, JSON serialization |
| `shared/src/lib.rs` | Add `pub mod bundle` |

### TypeScript — new `player/` package

| File | Responsibility |
|---|---|
| `player/package.json` | Package config, dependencies |
| `player/tsconfig.json` | TypeScript config |
| `player/vitest.config.ts` | Vitest config |
| `player/engine/types.ts` | Manifest, GameState, SavedState, SlotInfo, adapter interfaces |
| `player/engine/runtime.ts` | Pure game logic: navigate, evaluateConditions, applyFlagOperations, getAvailableChoices |
| `player/engine/index.ts` | Re-exports |
| `player/engine/__tests__/runtime.test.ts` | Unit tests for all runtime functions |
| `player/ui/StoryPlayer.tsx` | Top-level player component |
| `player/ui/PageView.tsx` | Renders page body text + images |
| `player/ui/ChoiceList.tsx` | Accessible choice buttons |
| `player/ui/SaveLoadMenu.tsx` | Save slot management UI |
| `player/ui/Settings.tsx` | Font size + theme controls |
| `player/ui/PlayerChrome.tsx` | Top bar with settings gear + save icon |
| `player/ui/hooks.ts` | useGameState, usePreferences hooks |
| `player/ui/preferences.ts` | Preference types, defaults, CSS variable application |
| `player/ui/player.css` | CSS custom properties for theming, rem scaling |
| `player/ui/index.ts` | Re-exports StoryPlayer |

### Test infrastructure

| File | Responsibility |
|---|---|
| `player/e2e/player.spec.ts` | Playwright integration tests against test stories |
| `player/e2e/test-app/` | Minimal Vite app that loads a manifest and renders StoryPlayer |
| `player/playwright.config.ts` | Playwright config for player tests |
| `test-fixtures/minimal.json` | Single page, no choices, no flags |
| `test-fixtures/branching.json` | Multiple pages with branching choices |
| `test-fixtures/flags.json` | Flags, flag operations, and conditional choices |

### Rust tests

| File | Responsibility |
|---|---|
| `shared/src/bundle.rs` (inline `#[cfg(test)]`) | Round-trip pack/unpack tests |

### Modifications to existing files

| File | Change |
|---|---|
| `shared/Cargo.toml` | Add `zip` and `serde_json` dependencies |
| `shared/src/lib.rs` | Add `pub mod bundle` |
| `Cargo.toml` (root) | No change needed (shared is already a member) |

---

## Task 1: Manifest Types and Bundle Packing (Rust)

**Files:**
- Create: `shared/src/bundle.rs`
- Modify: `shared/src/lib.rs`
- Modify: `shared/Cargo.toml`

- [ ] **Step 1: Add dependencies to shared/Cargo.toml**

Add `zip` and `serde_json` to `shared/Cargo.toml`:

```toml
serde_json = "1"
zip = "2"
```

Add under `[dependencies]`, alongside existing entries.

- [ ] **Step 2: Add bundle module to lib.rs**

In `shared/src/lib.rs`, add:

```rust
pub mod bundle;
```

- [ ] **Step 3: Write manifest types in bundle.rs**

Create `shared/src/bundle.rs`:

```rust
use serde::{Deserialize, Serialize};

/// Version of the bundle manifest format.
const CURRENT_FORMAT_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Manifest {
    pub format_version: u32,
    pub story: ManifestStory,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub flags: Vec<ManifestFlag>,
    pub pages: Vec<ManifestPage>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ManifestStory {
    pub id: String,
    pub title: String,
    pub start_page: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ManifestFlag {
    pub id: String,
    pub name: String,
    pub default_value: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ManifestPage {
    pub id: String,
    pub name: String,
    pub body: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub assets: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub flag_operations: Vec<ManifestFlagOperation>,
    pub choices: Vec<ManifestChoice>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ManifestChoice {
    pub id: String,
    pub text: String,
    pub target: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub flag_operations: Vec<ManifestFlagOperation>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub conditions: Vec<ManifestCondition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ManifestFlagOperation {
    pub flag_id: String,
    pub operation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ManifestCondition {
    pub flag_id: String,
    pub required_value: bool,
}

impl Manifest {
    pub fn new(story: ManifestStory, flags: Vec<ManifestFlag>, pages: Vec<ManifestPage>) -> Self {
        Manifest {
            format_version: CURRENT_FORMAT_VERSION,
            story,
            flags,
            pages,
        }
    }
}
```

- [ ] **Step 4: Write conversion from ExportedStory to Manifest**

Append to `shared/src/bundle.rs`:

```rust
use crate::export::ExportedStory;

impl From<&ExportedStory> for Manifest {
    fn from(exported: &ExportedStory) -> Self {
        let flags: Vec<ManifestFlag> = exported
            .flags
            .iter()
            .map(|f| ManifestFlag {
                id: f.id.to_string(),
                name: f.name.clone(),
                default_value: f.default_value,
            })
            .collect();

        let pages: Vec<ManifestPage> = exported
            .pages
            .iter()
            .map(|p| ManifestPage {
                id: p.id.to_string(),
                name: p.name.clone(),
                body: p.body.clone(),
                assets: vec![],
                flag_operations: p
                    .flag_operations
                    .iter()
                    .map(|op| ManifestFlagOperation {
                        flag_id: op.flag_id.to_string(),
                        operation: op.operation.clone(),
                    })
                    .collect(),
                choices: p
                    .options
                    .iter()
                    .map(|c| ManifestChoice {
                        id: c.id.to_string(),
                        text: c.text.clone(),
                        target: c.target_page.to_string(),
                        flag_operations: c
                            .flag_operations
                            .iter()
                            .map(|op| ManifestFlagOperation {
                                flag_id: op.flag_id.to_string(),
                                operation: op.operation.clone(),
                            })
                            .collect(),
                        conditions: c
                            .conditions
                            .iter()
                            .map(|cond| ManifestCondition {
                                flag_id: cond.flag_id.to_string(),
                                required_value: cond.required_value,
                            })
                            .collect(),
                    })
                    .collect(),
            })
            .collect();

        Manifest::new(
            ManifestStory {
                id: exported.story.id.to_string(),
                title: exported.story.title.clone(),
                start_page: exported.story.start_page.to_string(),
            },
            flags,
            pages,
        )
    }
}
```

- [ ] **Step 5: Write pack/unpack functions**

Append to `shared/src/bundle.rs`:

```rust
use std::io::{Read, Write, Seek, Cursor};
use std::collections::HashMap;

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

        // Write manifest.json
        let manifest_json = serde_json::to_string_pretty(&contents.manifest)
            .map_err(|e| BundleError::Serialize(e.to_string()))?;
        zip.start_file("manifest.json", options)
            .map_err(|e| BundleError::Zip(e.to_string()))?;
        zip.write_all(manifest_json.as_bytes())
            .map_err(|e| BundleError::Io(e.to_string()))?;

        // Write assets
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

    // Read manifest.json
    let manifest: Manifest = {
        let mut file = archive
            .by_name("manifest.json")
            .map_err(|_| BundleError::MissingManifest)?;
        let mut json = String::new();
        file.read_to_string(&mut json)
            .map_err(|e| BundleError::Io(e.to_string()))?;
        serde_json::from_str(&json).map_err(|e| BundleError::Deserialize(e.to_string()))?
    };

    // Read assets
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
```

- [ ] **Step 6: Add thiserror to shared/Cargo.toml**

`BundleError` uses `thiserror`. Add to `shared/Cargo.toml`:

```toml
thiserror = "2"
```

- [ ] **Step 7: Write round-trip tests**

Append to `shared/src/bundle.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn sample_manifest() -> Manifest {
        Manifest::new(
            ManifestStory {
                id: "story-1".into(),
                title: "Test Story".into(),
                start_page: "page-1".into(),
            },
            vec![ManifestFlag {
                id: "flag-1".into(),
                name: "has_key".into(),
                default_value: false,
            }],
            vec![
                ManifestPage {
                    id: "page-1".into(),
                    name: "Start".into(),
                    body: "You are in a room.".into(),
                    assets: vec![],
                    flag_operations: vec![],
                    choices: vec![ManifestChoice {
                        id: "choice-1".into(),
                        text: "Open the door".into(),
                        target: "page-2".into(),
                        flag_operations: vec![ManifestFlagOperation {
                            flag_id: "flag-1".into(),
                            operation: "set_true".into(),
                        }],
                        conditions: vec![],
                    }],
                },
                ManifestPage {
                    id: "page-2".into(),
                    name: "Hallway".into(),
                    body: "A dark hallway.".into(),
                    assets: vec![],
                    flag_operations: vec![],
                    choices: vec![ManifestChoice {
                        id: "choice-2".into(),
                        text: "Go back".into(),
                        target: "page-1".into(),
                        flag_operations: vec![],
                        conditions: vec![ManifestCondition {
                            flag_id: "flag-1".into(),
                            required_value: true,
                        }],
                    }],
                },
            ],
        )
    }

    #[test]
    fn manifest_round_trip_json() {
        let manifest = sample_manifest();
        let json = serde_json::to_string(&manifest).unwrap();
        let parsed: Manifest = serde_json::from_str(&json).unwrap();
        assert_eq!(manifest, parsed);
    }

    #[test]
    fn bundle_round_trip_no_assets() {
        let contents = BundleContents {
            manifest: sample_manifest(),
            assets: HashMap::new(),
        };
        let packed = pack_bundle(&contents).unwrap();
        let unpacked = unpack_bundle(&packed).unwrap();
        assert_eq!(contents.manifest, unpacked.manifest);
        assert!(unpacked.assets.is_empty());
    }

    #[test]
    fn bundle_round_trip_with_assets() {
        let mut assets = HashMap::new();
        assets.insert("hero.png".into(), vec![0x89, 0x50, 0x4E, 0x47]);
        assets.insert("bg.jpg".into(), vec![0xFF, 0xD8, 0xFF, 0xE0]);

        let contents = BundleContents {
            manifest: sample_manifest(),
            assets,
        };
        let packed = pack_bundle(&contents).unwrap();
        let unpacked = unpack_bundle(&packed).unwrap();
        assert_eq!(contents.manifest, unpacked.manifest);
        assert_eq!(
            contents.assets.get("hero.png"),
            unpacked.assets.get("hero.png")
        );
        assert_eq!(
            contents.assets.get("bg.jpg"),
            unpacked.assets.get("bg.jpg")
        );
    }

    #[test]
    fn unpack_missing_manifest_fails() {
        // Create a zip with no manifest.json
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

    #[test]
    fn conversion_from_exported_story() {
        use crate::export::{ExportedStory, StoryMetadata};
        use crate::models::*;

        let exported = ExportedStory {
            story: StoryMetadata {
                id: 42,
                title: "Exported".into(),
                start_page: 1,
            },
            flags: vec![Flag {
                id: 10,
                story_id: 42,
                name: "found_gem".into(),
                default_value: true,
            }],
            pages: vec![Page {
                id: 1,
                story_id: 42,
                name: "Intro".into(),
                body: "Welcome.".into(),
                options: vec![Choice {
                    id: 100,
                    page_id: 1,
                    text: "Continue".into(),
                    target_page: 1,
                    flag_operations: vec![],
                    conditions: vec![ChoiceCondition {
                        id: 200,
                        flag_id: 10,
                        required_value: true,
                    }],
                }],
                flag_operations: vec![FlagOperation {
                    id: 300,
                    flag_id: 10,
                    operation: "toggle".into(),
                }],
            }],
        };

        let manifest = Manifest::from(&exported);
        assert_eq!(manifest.format_version, 1);
        assert_eq!(manifest.story.id, "42");
        assert_eq!(manifest.story.title, "Exported");
        assert_eq!(manifest.story.start_page, "1");
        assert_eq!(manifest.flags.len(), 1);
        assert_eq!(manifest.flags[0].id, "10");
        assert_eq!(manifest.flags[0].name, "found_gem");
        assert!(manifest.flags[0].default_value);
        assert_eq!(manifest.pages.len(), 1);
        assert_eq!(manifest.pages[0].choices[0].conditions[0].flag_id, "10");
        assert_eq!(manifest.pages[0].flag_operations[0].operation, "toggle");
    }
}
```

- [ ] **Step 8: Run tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p shared`

Expected: All 5 tests pass.

- [ ] **Step 9: Commit**

```bash
git add shared/src/bundle.rs shared/src/lib.rs shared/Cargo.toml
git commit -m "feat: add .fabler bundle format with manifest types and zip packing"
```

---

## Task 2: Export .fabler Bundle from Creation Tool

**Files:**
- Modify: `creation-tool/src-tauri/src/main.rs` (add new command)
- Modify: `creation-tool/src-tauri/src/db/stories.rs` (add bundle export method)

- [ ] **Step 1: Add export_story_bundle method to Database**

In `creation-tool/src-tauri/src/db/stories.rs`, add this method to the `impl Database` block:

```rust
use shared::bundle::{BundleContents, Manifest};

pub async fn export_story_bundle(&self, story_id: StoryId) -> AppResult<Vec<u8>> {
    let exported = self.export_story(story_id).await?;
    let manifest = Manifest::from(&exported);
    let contents = BundleContents {
        manifest,
        assets: std::collections::HashMap::new(),
    };
    shared::bundle::pack_bundle(&contents)
        .map_err(|e| AppError::Custom(format!("Failed to pack bundle: {e}")))
}
```

- [ ] **Step 2: Add Tauri command for bundle export**

In `creation-tool/src-tauri/src/main.rs`, add a new command:

```rust
#[tauri::command]
#[specta::specta]
async fn export_story_bundle(
    story_id: i64,
    db: tauri::State<'_, Database>,
) -> Result<Vec<u8>, String> {
    db.export_story_bundle(story_id)
        .await
        .map_err(|e| e.to_string())
}
```

Register it in both `collect_commands![]` and `tauri::generate_handler![]`.

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/jnurminen/cyoa2/creation-tool && cargo build -p creation-tool`

Expected: Compiles without errors.

- [ ] **Step 4: Commit**

```bash
git add creation-tool/src-tauri/src/db/stories.rs creation-tool/src-tauri/src/main.rs
git commit -m "feat: add .fabler bundle export command"
```

---

## Task 3: Player Package Setup

**Files:**
- Create: `player/package.json`
- Create: `player/tsconfig.json`
- Create: `player/vitest.config.ts`

- [ ] **Step 1: Create player/package.json**

```json
{
  "name": "@fabler/player",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.2.1",
    "typescript": "^5.2.2"
  }
}
```

- [ ] **Step 2: Create player/tsconfig.json**

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
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": ".",
    "jsx": "react-jsx"
  },
  "include": ["engine/**/*.ts", "ui/**/*.ts", "ui/**/*.tsx"],
  "exclude": ["node_modules", "dist", "**/__tests__/**", "e2e/**"]
}
```

- [ ] **Step 3: Create player/vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["engine/__tests__/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Install dependencies**

Run: `cd /Users/jnurminen/cyoa2/player && yarn install`

- [ ] **Step 5: Commit**

```bash
git add player/package.json player/tsconfig.json player/vitest.config.ts player/yarn.lock
git commit -m "feat: scaffold player package with vitest"
```

---

## Task 4: Player Engine — Types

**Files:**
- Create: `player/engine/types.ts`
- Create: `player/engine/index.ts`

- [ ] **Step 1: Create engine types**

Create `player/engine/types.ts`:

```typescript
// -- Manifest types (matches Rust Manifest struct from shared/src/bundle.rs) --

export interface Manifest {
  format_version: number;
  story: ManifestStory;
  flags: ManifestFlag[];
  pages: ManifestPage[];
}

export interface ManifestStory {
  id: string;
  title: string;
  start_page: string;
}

export interface ManifestFlag {
  id: string;
  name: string;
  default_value: boolean;
}

export interface ManifestPage {
  id: string;
  name: string;
  body: string;
  assets: string[];
  flag_operations: ManifestFlagOperation[];
  choices: ManifestChoice[];
}

export interface ManifestChoice {
  id: string;
  text: string;
  target: string;
  flag_operations: ManifestFlagOperation[];
  conditions: ManifestCondition[];
}

export interface ManifestFlagOperation {
  flag_id: string;
  operation: "set_true" | "set_false" | "toggle";
}

export interface ManifestCondition {
  flag_id: string;
  required_value: boolean;
}

// -- Game state --

export type FlagState = Record<string, boolean>;

export interface GameState {
  currentPageId: string;
  flags: FlagState;
}

// -- Save/load --

export interface SavedState {
  gameState: GameState;
  name: string;
  timestamp: number;
}

export interface SlotInfo {
  slotId: string;
  name: string;
  timestamp: number;
}

// -- Adapter interfaces --

export interface StorageAdapter {
  saveSlot(
    storyId: string,
    slotId: string,
    state: SavedState,
  ): Promise<void>;
  loadSlot(
    storyId: string,
    slotId: string,
  ): Promise<SavedState | null>;
  listSlots(storyId: string): Promise<SlotInfo[]>;
  deleteSlot(storyId: string, slotId: string): Promise<void>;
}

export interface AssetResolver {
  getAssetUrl(assetPath: string): string | Promise<string>;
}

// -- User preferences --

export type FontSize = "small" | "medium" | "large" | "extra-large";
export type Theme = "light" | "dark" | "system";

export interface UserPreferences {
  fontSize: FontSize;
  theme: Theme;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  fontSize: "medium",
  theme: "system",
};
```

- [ ] **Step 2: Create engine index**

Create `player/engine/index.ts`:

```typescript
export * from "./types";
export * from "./runtime";
```

- [ ] **Step 3: Commit**

```bash
git add player/engine/types.ts player/engine/index.ts
git commit -m "feat: add player engine types and adapter interfaces"
```

---

## Task 5: Player Engine — Runtime (TDD)

**Files:**
- Create: `player/engine/runtime.ts`
- Create: `player/engine/__tests__/runtime.test.ts`

- [ ] **Step 1: Write failing tests for evaluateConditions**

Create `player/engine/__tests__/runtime.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  evaluateConditions,
  applyFlagOperations,
  getAvailableChoices,
  navigate,
  initGameState,
} from "../runtime";
import type {
  ManifestCondition,
  ManifestFlagOperation,
  ManifestPage,
  Manifest,
  FlagState,
} from "../types";

describe("evaluateConditions", () => {
  it("returns true for empty conditions", () => {
    expect(evaluateConditions([], {})).toBe(true);
  });

  it("returns true when all conditions met", () => {
    const conditions: ManifestCondition[] = [
      { flag_id: "f1", required_value: true },
      { flag_id: "f2", required_value: false },
    ];
    const flags: FlagState = { f1: true, f2: false };
    expect(evaluateConditions(conditions, flags)).toBe(true);
  });

  it("returns false when any condition not met", () => {
    const conditions: ManifestCondition[] = [
      { flag_id: "f1", required_value: true },
      { flag_id: "f2", required_value: true },
    ];
    const flags: FlagState = { f1: true, f2: false };
    expect(evaluateConditions(conditions, flags)).toBe(false);
  });

  it("treats missing flags as false", () => {
    const conditions: ManifestCondition[] = [
      { flag_id: "f1", required_value: false },
    ];
    expect(evaluateConditions(conditions, {})).toBe(true);
  });

  it("returns false when missing flag required to be true", () => {
    const conditions: ManifestCondition[] = [
      { flag_id: "f1", required_value: true },
    ];
    expect(evaluateConditions(conditions, {})).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/jnurminen/cyoa2/player && npx vitest run`

Expected: FAIL — module `../runtime` not found.

- [ ] **Step 3: Write evaluateConditions**

Create `player/engine/runtime.ts`:

```typescript
import type {
  FlagState,
  GameState,
  Manifest,
  ManifestChoice,
  ManifestCondition,
  ManifestFlagOperation,
  ManifestPage,
} from "./types";

export function evaluateConditions(
  conditions: ManifestCondition[],
  flags: FlagState,
): boolean {
  return conditions.every(
    (c) => (flags[c.flag_id] ?? false) === c.required_value,
  );
}
```

- [ ] **Step 4: Run tests to verify evaluateConditions passes**

Run: `cd /Users/jnurminen/cyoa2/player && npx vitest run`

Expected: All evaluateConditions tests PASS.

- [ ] **Step 5: Write failing tests for applyFlagOperations**

Append to `runtime.test.ts`:

```typescript
describe("applyFlagOperations", () => {
  it("returns same state for empty operations", () => {
    const flags: FlagState = { f1: true };
    const result = applyFlagOperations([], flags);
    expect(result).toEqual({ f1: true });
  });

  it("does not mutate input", () => {
    const flags: FlagState = { f1: false };
    const ops: ManifestFlagOperation[] = [
      { flag_id: "f1", operation: "set_true" },
    ];
    applyFlagOperations(ops, flags);
    expect(flags.f1).toBe(false);
  });

  it("applies set_true", () => {
    const result = applyFlagOperations(
      [{ flag_id: "f1", operation: "set_true" }],
      { f1: false },
    );
    expect(result.f1).toBe(true);
  });

  it("applies set_false", () => {
    const result = applyFlagOperations(
      [{ flag_id: "f1", operation: "set_false" }],
      { f1: true },
    );
    expect(result.f1).toBe(false);
  });

  it("applies toggle", () => {
    const result = applyFlagOperations(
      [{ flag_id: "f1", operation: "toggle" }],
      { f1: false },
    );
    expect(result.f1).toBe(true);
  });

  it("applies multiple operations in order", () => {
    const ops: ManifestFlagOperation[] = [
      { flag_id: "f1", operation: "set_true" },
      { flag_id: "f1", operation: "toggle" },
    ];
    const result = applyFlagOperations(ops, {});
    expect(result.f1).toBe(false);
  });

  it("creates flag entries for previously unset flags", () => {
    const result = applyFlagOperations(
      [{ flag_id: "f1", operation: "set_true" }],
      {},
    );
    expect(result.f1).toBe(true);
  });
});
```

- [ ] **Step 6: Run tests to verify applyFlagOperations fails**

Run: `cd /Users/jnurminen/cyoa2/player && npx vitest run`

Expected: applyFlagOperations tests FAIL.

- [ ] **Step 7: Implement applyFlagOperations**

Append to `player/engine/runtime.ts`:

```typescript
export function applyFlagOperations(
  operations: ManifestFlagOperation[],
  flags: FlagState,
): FlagState {
  const result = { ...flags };
  for (const op of operations) {
    const current = result[op.flag_id] ?? false;
    switch (op.operation) {
      case "set_true":
        result[op.flag_id] = true;
        break;
      case "set_false":
        result[op.flag_id] = false;
        break;
      case "toggle":
        result[op.flag_id] = !current;
        break;
    }
  }
  return result;
}
```

- [ ] **Step 8: Run tests to verify applyFlagOperations passes**

Run: `cd /Users/jnurminen/cyoa2/player && npx vitest run`

Expected: All tests PASS.

- [ ] **Step 9: Write failing tests for getAvailableChoices and navigate**

Append to `runtime.test.ts`:

```typescript
const testPage: ManifestPage = {
  id: "p1",
  name: "Test",
  body: "Test body",
  assets: [],
  flag_operations: [],
  choices: [
    {
      id: "c1",
      text: "Always visible",
      target: "p2",
      flag_operations: [],
      conditions: [],
    },
    {
      id: "c2",
      text: "Needs key",
      target: "p3",
      flag_operations: [],
      conditions: [{ flag_id: "has_key", required_value: true }],
    },
    {
      id: "c3",
      text: "Needs no key",
      target: "p4",
      flag_operations: [],
      conditions: [{ flag_id: "has_key", required_value: false }],
    },
  ],
};

describe("getAvailableChoices", () => {
  it("returns all choices when no conditions", () => {
    const page: ManifestPage = {
      ...testPage,
      choices: [testPage.choices[0]],
    };
    const result = getAvailableChoices(page, {});
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c1");
  });

  it("filters by flag conditions", () => {
    const result = getAvailableChoices(testPage, { has_key: true });
    expect(result.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("shows different choices when flags differ", () => {
    const result = getAvailableChoices(testPage, { has_key: false });
    expect(result.map((c) => c.id)).toEqual(["c1", "c3"]);
  });

  it("returns empty array when all choices filtered", () => {
    const page: ManifestPage = {
      ...testPage,
      choices: [testPage.choices[1]], // only "needs key"
    };
    const result = getAvailableChoices(page, {});
    expect(result).toHaveLength(0);
  });
});

describe("initGameState", () => {
  it("initializes from manifest", () => {
    const manifest: Manifest = {
      format_version: 1,
      story: { id: "s1", title: "Test", start_page: "p1" },
      flags: [
        { id: "f1", name: "flag1", default_value: false },
        { id: "f2", name: "flag2", default_value: true },
      ],
      pages: [],
    };
    const state = initGameState(manifest);
    expect(state.currentPageId).toBe("p1");
    expect(state.flags).toEqual({ f1: false, f2: true });
  });
});

describe("navigate", () => {
  const manifest: Manifest = {
    format_version: 1,
    story: { id: "s1", title: "Test", start_page: "p1" },
    flags: [],
    pages: [
      {
        id: "p1",
        name: "Start",
        body: "",
        assets: [],
        flag_operations: [],
        choices: [
          {
            id: "c1",
            text: "Go",
            target: "p2",
            flag_operations: [{ flag_id: "f1", operation: "set_true" }],
            conditions: [],
          },
        ],
      },
      {
        id: "p2",
        name: "End",
        body: "",
        assets: [],
        flag_operations: [{ flag_id: "f2", operation: "set_true" }],
        choices: [],
      },
    ],
  };

  it("moves to target page", () => {
    const state: GameState = { currentPageId: "p1", flags: {} };
    const choice = manifest.pages[0].choices[0];
    const next = navigate(manifest, state, choice);
    expect(next.currentPageId).toBe("p2");
  });

  it("applies choice flag operations", () => {
    const state: GameState = { currentPageId: "p1", flags: {} };
    const choice = manifest.pages[0].choices[0];
    const next = navigate(manifest, state, choice);
    expect(next.flags.f1).toBe(true);
  });

  it("applies target page flag operations", () => {
    const state: GameState = { currentPageId: "p1", flags: {} };
    const choice = manifest.pages[0].choices[0];
    const next = navigate(manifest, state, choice);
    expect(next.flags.f2).toBe(true);
  });

  it("does not mutate input state", () => {
    const state: GameState = { currentPageId: "p1", flags: {} };
    const choice = manifest.pages[0].choices[0];
    navigate(manifest, state, choice);
    expect(state.currentPageId).toBe("p1");
    expect(state.flags).toEqual({});
  });
});
```

- [ ] **Step 10: Run tests to verify they fail**

Run: `cd /Users/jnurminen/cyoa2/player && npx vitest run`

Expected: getAvailableChoices, initGameState, and navigate tests FAIL.

- [ ] **Step 11: Implement remaining runtime functions**

Append to `player/engine/runtime.ts`:

```typescript
export function getAvailableChoices(
  page: ManifestPage,
  flags: FlagState,
): ManifestChoice[] {
  return page.choices.filter((c) => evaluateConditions(c.conditions, flags));
}

export function initGameState(manifest: Manifest): GameState {
  const flags: FlagState = {};
  for (const flag of manifest.flags) {
    flags[flag.id] = flag.default_value;
  }
  return {
    currentPageId: manifest.story.start_page,
    flags,
  };
}

export function navigate(
  manifest: Manifest,
  state: GameState,
  choice: ManifestChoice,
): GameState {
  // Apply choice flag operations first
  let flags = applyFlagOperations(choice.flag_operations, state.flags);

  // Find target page and apply its flag operations
  const targetPage = manifest.pages.find((p) => p.id === choice.target);
  if (targetPage) {
    flags = applyFlagOperations(targetPage.flag_operations, flags);
  }

  return {
    currentPageId: choice.target,
    flags,
  };
}
```

- [ ] **Step 12: Run all tests**

Run: `cd /Users/jnurminen/cyoa2/player && npx vitest run`

Expected: All tests PASS.

- [ ] **Step 13: Commit**

```bash
git add player/engine/runtime.ts player/engine/__tests__/runtime.test.ts
git commit -m "feat: implement player engine runtime with full test coverage"
```

---

## Task 6: Test Fixtures

**Files:**
- Create: `test-fixtures/minimal.json`
- Create: `test-fixtures/branching.json`
- Create: `test-fixtures/flags.json`

- [ ] **Step 1: Create minimal fixture**

Create `test-fixtures/minimal.json`:

```json
{
  "format_version": 1,
  "story": {
    "id": "minimal-1",
    "title": "Minimal Story",
    "start_page": "page-1"
  },
  "flags": [],
  "pages": [
    {
      "id": "page-1",
      "name": "The Only Page",
      "body": "This is a story with just one page. There is nothing else to do.",
      "assets": [],
      "flag_operations": [],
      "choices": []
    }
  ]
}
```

- [ ] **Step 2: Create branching fixture**

Create `test-fixtures/branching.json`:

```json
{
  "format_version": 1,
  "story": {
    "id": "branching-1",
    "title": "The Forking Path",
    "start_page": "entrance"
  },
  "flags": [],
  "pages": [
    {
      "id": "entrance",
      "name": "Entrance",
      "body": "You stand at a fork in the road. Two paths stretch out before you.",
      "assets": [],
      "flag_operations": [],
      "choices": [
        {
          "id": "go-left",
          "text": "Take the left path",
          "target": "forest",
          "flag_operations": [],
          "conditions": []
        },
        {
          "id": "go-right",
          "text": "Take the right path",
          "target": "mountain",
          "flag_operations": [],
          "conditions": []
        }
      ]
    },
    {
      "id": "forest",
      "name": "Deep Forest",
      "body": "The trees close in around you. Sunlight filters through the canopy.",
      "assets": [],
      "flag_operations": [],
      "choices": [
        {
          "id": "forest-continue",
          "text": "Press deeper into the forest",
          "target": "clearing",
          "flag_operations": [],
          "conditions": []
        },
        {
          "id": "forest-back",
          "text": "Turn back to the fork",
          "target": "entrance",
          "flag_operations": [],
          "conditions": []
        }
      ]
    },
    {
      "id": "mountain",
      "name": "Mountain Trail",
      "body": "The path winds upward. Rocks crunch beneath your feet.",
      "assets": [],
      "flag_operations": [],
      "choices": [
        {
          "id": "mountain-summit",
          "text": "Climb to the summit",
          "target": "summit",
          "flag_operations": [],
          "conditions": []
        },
        {
          "id": "mountain-back",
          "text": "Turn back to the fork",
          "target": "entrance",
          "flag_operations": [],
          "conditions": []
        }
      ]
    },
    {
      "id": "clearing",
      "name": "Sunlit Clearing",
      "body": "You emerge into a beautiful clearing. Wildflowers sway in the breeze. Your journey ends here, at peace.",
      "assets": [],
      "flag_operations": [],
      "choices": []
    },
    {
      "id": "summit",
      "name": "The Summit",
      "body": "You reach the top. The world stretches out below you in every direction. Your journey ends here, triumphant.",
      "assets": [],
      "flag_operations": [],
      "choices": []
    }
  ]
}
```

- [ ] **Step 3: Create flags fixture**

Create `test-fixtures/flags.json`:

```json
{
  "format_version": 1,
  "story": {
    "id": "flags-1",
    "title": "The Key and the Door",
    "start_page": "room"
  },
  "flags": [
    { "id": "has_key", "name": "Has the key", "default_value": false },
    { "id": "door_unlocked", "name": "Door is unlocked", "default_value": false }
  ],
  "pages": [
    {
      "id": "room",
      "name": "The Room",
      "body": "You are in a small room. There is a locked door on the north wall and a table in the corner.",
      "assets": [],
      "flag_operations": [],
      "choices": [
        {
          "id": "search-table",
          "text": "Search the table",
          "target": "table",
          "flag_operations": [],
          "conditions": []
        },
        {
          "id": "try-door-locked",
          "text": "Try the door",
          "target": "door-locked",
          "flag_operations": [],
          "conditions": [
            { "flag_id": "door_unlocked", "required_value": false }
          ]
        },
        {
          "id": "open-door",
          "text": "Open the door",
          "target": "freedom",
          "flag_operations": [],
          "conditions": [
            { "flag_id": "door_unlocked", "required_value": true }
          ]
        }
      ]
    },
    {
      "id": "table",
      "name": "The Table",
      "body": "You find a rusty key under some papers.",
      "assets": [],
      "flag_operations": [
        { "flag_id": "has_key", "operation": "set_true" }
      ],
      "choices": [
        {
          "id": "back-from-table",
          "text": "Go back to the room",
          "target": "room",
          "flag_operations": [],
          "conditions": []
        }
      ]
    },
    {
      "id": "door-locked",
      "name": "Locked Door",
      "body": "The door is locked tight.",
      "assets": [],
      "flag_operations": [],
      "choices": [
        {
          "id": "use-key",
          "text": "Use the key",
          "target": "room",
          "flag_operations": [
            { "flag_id": "door_unlocked", "operation": "set_true" }
          ],
          "conditions": [
            { "flag_id": "has_key", "required_value": true }
          ]
        },
        {
          "id": "back-from-door",
          "text": "Go back",
          "target": "room",
          "flag_operations": [],
          "conditions": []
        }
      ]
    },
    {
      "id": "freedom",
      "name": "Freedom",
      "body": "You step through the door into the sunlight. You are free!",
      "assets": [],
      "flag_operations": [],
      "choices": []
    }
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add test-fixtures/
git commit -m "feat: add test story fixtures for player testing"
```

---

## Task 7: Player UI — Package Setup and Theming Foundation

**Files:**
- Modify: `player/package.json` (add React + Tailwind deps)
- Create: `player/ui/player.css`
- Create: `player/ui/preferences.ts`
- Create: `player/postcss.config.js`

- [ ] **Step 1: Add React and Tailwind dependencies**

Update `player/package.json` dependencies:

```json
{
  "name": "@fabler/player",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.15",
    "@types/react-dom": "^18.2.7",
    "vitest": "^3.2.1",
    "typescript": "^5.2.2",
    "tailwindcss": "^4.1.18",
    "@tailwindcss/postcss": "^4.1.18",
    "postcss": "^8.5.6"
  }
}
```

Run: `cd /Users/jnurminen/cyoa2/player && yarn install`

- [ ] **Step 2: Create PostCSS config**

Create `player/postcss.config.js`:

```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- [ ] **Step 3: Create player.css with theme custom properties**

Create `player/ui/player.css`:

```css
@import "tailwindcss";

/* Font size scale — applied to player root via data-font-size attribute */
[data-font-size="small"] {
  font-size: 14px;
}
[data-font-size="medium"] {
  font-size: 18px;
}
[data-font-size="large"] {
  font-size: 22px;
}
[data-font-size="extra-large"] {
  font-size: 28px;
}

/* Theme: light */
[data-theme="light"] {
  --player-bg: #ffffff;
  --player-text: #1a1a1a;
  --player-text-muted: #6b7280;
  --player-surface: #f3f4f6;
  --player-border: #d1d5db;
  --player-choice-bg: #f9fafb;
  --player-choice-bg-hover: #e5e7eb;
  --player-choice-border: #d1d5db;
  --player-choice-text: #111827;
  --player-accent: #2563eb;
  --player-accent-text: #ffffff;
}

/* Theme: dark */
[data-theme="dark"] {
  --player-bg: #111827;
  --player-text: #f3f4f6;
  --player-text-muted: #9ca3af;
  --player-surface: #1f2937;
  --player-border: #374151;
  --player-choice-bg: #1f2937;
  --player-choice-bg-hover: #374151;
  --player-choice-border: #4b5563;
  --player-choice-text: #f9fafb;
  --player-accent: #3b82f6;
  --player-accent-text: #ffffff;
}
```

- [ ] **Step 4: Create preferences utilities**

Create `player/ui/preferences.ts`:

```typescript
import type { FontSize, Theme, UserPreferences } from "../engine/types";
import { DEFAULT_PREFERENCES } from "../engine/types";

export function getEffectiveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

export function applyPreferences(
  element: HTMLElement,
  preferences: UserPreferences,
): void {
  element.setAttribute("data-font-size", preferences.fontSize);
  element.setAttribute("data-theme", getEffectiveTheme(preferences.theme));
}
```

- [ ] **Step 5: Commit**

```bash
git add player/package.json player/yarn.lock player/postcss.config.js player/ui/player.css player/ui/preferences.ts
git commit -m "feat: add player UI foundation with theming and font scaling"
```

---

## Task 8: Player UI — Core Components

**Files:**
- Create: `player/ui/hooks.ts`
- Create: `player/ui/PageView.tsx`
- Create: `player/ui/ChoiceList.tsx`
- Create: `player/ui/PlayerChrome.tsx`
- Create: `player/ui/StoryPlayer.tsx`
- Create: `player/ui/index.ts`

- [ ] **Step 1: Create game state hook**

Create `player/ui/hooks.ts`:

```typescript
import { useState, useCallback, useEffect, useRef } from "react";
import type {
  Manifest,
  ManifestChoice,
  ManifestPage,
  GameState,
  UserPreferences,
  StorageAdapter,
  SavedState,
  SlotInfo,
} from "../engine/types";
import { DEFAULT_PREFERENCES } from "../engine/types";
import {
  initGameState,
  navigate,
  getAvailableChoices,
} from "../engine/runtime";
import { applyPreferences } from "./preferences";

export function useGameState(manifest: Manifest) {
  const [gameState, setGameState] = useState<GameState>(() =>
    initGameState(manifest),
  );

  const currentPage = manifest.pages.find(
    (p) => p.id === gameState.currentPageId,
  );

  const availableChoices = currentPage
    ? getAvailableChoices(currentPage, gameState.flags)
    : [];

  const handleChoice = useCallback(
    (choice: ManifestChoice) => {
      setGameState((prev) => navigate(manifest, prev, choice));
    },
    [manifest],
  );

  const restoreState = useCallback((saved: GameState) => {
    setGameState(saved);
  }, []);

  return {
    gameState,
    currentPage,
    availableChoices,
    handleChoice,
    restoreState,
  };
}

export function usePreferences(rootRef: React.RefObject<HTMLElement | null>) {
  const [preferences, setPreferences] = useState<UserPreferences>(
    DEFAULT_PREFERENCES,
  );

  useEffect(() => {
    if (rootRef.current) {
      applyPreferences(rootRef.current, preferences);
    }
  }, [preferences, rootRef]);

  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return { preferences, updatePreference };
}
```

- [ ] **Step 2: Create PageView component**

Create `player/ui/PageView.tsx`:

```tsx
import type { AssetResolver, ManifestPage } from "../engine/types";

interface PageViewProps {
  page: ManifestPage;
  assets: AssetResolver;
}

export function PageView({ page, assets }: PageViewProps) {
  return (
    <article
      className="max-w-prose mx-auto"
      aria-label={page.name}
    >
      <h1
        className="text-[1.5em] font-bold mb-[1em]"
        style={{ color: "var(--player-text)" }}
      >
        {page.name}
      </h1>
      <div
        className="leading-relaxed whitespace-pre-wrap"
        style={{ color: "var(--player-text)" }}
      >
        {page.body}
      </div>
    </article>
  );
}
```

- [ ] **Step 3: Create ChoiceList component**

Create `player/ui/ChoiceList.tsx`:

```tsx
import { useRef, useEffect } from "react";
import type { ManifestChoice } from "../engine/types";

interface ChoiceListProps {
  choices: ManifestChoice[];
  onChoose: (choice: ManifestChoice) => void;
}

export function ChoiceList({ choices, onChoose }: ChoiceListProps) {
  const listRef = useRef<HTMLElement>(null);

  if (choices.length === 0) {
    return (
      <footer
        className="max-w-prose mx-auto mt-[2em] pt-[1em]"
        style={{ borderTop: "1px solid var(--player-border)" }}
      >
        <p
          className="text-center italic"
          style={{ color: "var(--player-text-muted)" }}
        >
          The End
        </p>
      </footer>
    );
  }

  return (
    <nav
      ref={listRef}
      aria-label="Story choices"
      className="max-w-prose mx-auto mt-[2em] pt-[1em]"
      style={{ borderTop: "1px solid var(--player-border)" }}
    >
      <ul className="list-none p-0 m-0 flex flex-col gap-[0.75em]">
        {choices.map((choice) => (
          <li key={choice.id}>
            <button
              onClick={() => onChoose(choice)}
              className="w-full text-left p-[1em] rounded-lg cursor-pointer
                         transition-colors duration-150 border
                         min-h-[44px]"
              style={{
                backgroundColor: "var(--player-choice-bg)",
                borderColor: "var(--player-choice-border)",
                color: "var(--player-choice-text)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--player-choice-bg-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--player-choice-bg)")
              }
            >
              {choice.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: Create PlayerChrome component**

Create `player/ui/PlayerChrome.tsx`:

```tsx
import type { ReactNode } from "react";

interface PlayerChromeProps {
  title: string;
  onSettingsOpen: () => void;
  onSaveOpen: () => void;
  children: ReactNode;
}

export function PlayerChrome({
  title,
  onSettingsOpen,
  onSaveOpen,
  children,
}: PlayerChromeProps) {
  return (
    <div className="flex flex-col h-full">
      <header
        className="flex items-center justify-between px-[1em] py-[0.5em] shrink-0"
        style={{
          backgroundColor: "var(--player-surface)",
          borderBottom: "1px solid var(--player-border)",
        }}
      >
        <h2
          className="text-[0.875em] font-medium truncate"
          style={{ color: "var(--player-text-muted)" }}
        >
          {title}
        </h2>
        <div className="flex gap-[0.5em]">
          <button
            onClick={onSaveOpen}
            aria-label="Save and load"
            className="p-[0.5em] rounded min-w-[44px] min-h-[44px]
                       flex items-center justify-center cursor-pointer"
            style={{ color: "var(--player-text-muted)" }}
          >
            💾
          </button>
          <button
            onClick={onSettingsOpen}
            aria-label="Settings"
            className="p-[0.5em] rounded min-w-[44px] min-h-[44px]
                       flex items-center justify-center cursor-pointer"
            style={{ color: "var(--player-text-muted)" }}
          >
            ⚙️
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-[1.5em]">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Create StoryPlayer component**

Create `player/ui/StoryPlayer.tsx`:

```tsx
import { useRef, useEffect, useState } from "react";
import type {
  Manifest,
  StorageAdapter,
  AssetResolver,
} from "../engine/types";
import { useGameState, usePreferences } from "./hooks";
import { PageView } from "./PageView";
import { ChoiceList } from "./ChoiceList";
import { PlayerChrome } from "./PlayerChrome";
import { Settings } from "./Settings";
import { SaveLoadMenu } from "./SaveLoadMenu";

interface StoryPlayerProps {
  manifest: Manifest;
  storage?: StorageAdapter;
  assets: AssetResolver;
}

export function StoryPlayer({ manifest, storage, assets }: StoryPlayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { preferences, updatePreference } = usePreferences(rootRef);
  const { gameState, currentPage, availableChoices, handleChoice, restoreState } =
    useGameState(manifest);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  // Scroll to top and focus content on page change
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
    // Focus the article for screen reader announcement
    const article = contentRef.current?.querySelector("article");
    if (article instanceof HTMLElement) {
      article.focus();
    }
  }, [gameState.currentPageId]);

  if (!currentPage) {
    return (
      <div
        ref={rootRef}
        role="alert"
        style={{ color: "var(--player-text)", padding: "1em" }}
      >
        Page not found: {gameState.currentPageId}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="h-full"
      style={{ backgroundColor: "var(--player-bg)" }}
      /* data-font-size and data-theme are set by usePreferences hook */
    >
      <PlayerChrome
        title={manifest.story.title}
        onSettingsOpen={() => setSettingsOpen(true)}
        onSaveOpen={() => setSaveOpen(true)}
      >
        <div ref={contentRef}>
          <div aria-live="polite">
            <PageView page={currentPage} assets={assets} />
          </div>
          <ChoiceList choices={availableChoices} onChoose={handleChoice} />
        </div>
      </PlayerChrome>

      {settingsOpen && (
        <Settings
          preferences={preferences}
          onUpdate={updatePreference}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {saveOpen && storage && (
        <SaveLoadMenu
          storyId={manifest.story.id}
          storage={storage}
          gameState={gameState}
          onRestore={restoreState}
          onClose={() => setSaveOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create index re-export**

Create `player/ui/index.ts`:

```typescript
export { StoryPlayer } from "./StoryPlayer";
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd /Users/jnurminen/cyoa2/player && npx tsc --noEmit`

Expected: No errors (Settings and SaveLoadMenu don't exist yet — create stubs first if needed, or proceed to next steps).

- [ ] **Step 8: Commit**

```bash
git add player/ui/
git commit -m "feat: add core player UI components — PageView, ChoiceList, PlayerChrome, StoryPlayer"
```

---

## Task 9: Player UI — Settings and SaveLoadMenu

**Files:**
- Create: `player/ui/Settings.tsx`
- Create: `player/ui/SaveLoadMenu.tsx`

- [ ] **Step 1: Create Settings component**

Create `player/ui/Settings.tsx`:

```tsx
import type { FontSize, Theme, UserPreferences } from "../engine/types";

interface SettingsProps {
  preferences: UserPreferences;
  onUpdate: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void;
  onClose: () => void;
}

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "extra-large", label: "Extra Large" },
];

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function Settings({ preferences, onUpdate, onClose }: SettingsProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-label="Settings"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl p-[1.5em]"
        style={{
          backgroundColor: "var(--player-surface)",
          color: "var(--player-text)",
        }}
      >
        <div className="flex items-center justify-between mb-[1.5em]">
          <h2 className="text-[1.25em] font-bold">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="p-[0.5em] min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Font size */}
        <fieldset className="mb-[1.5em]">
          <legend className="text-[0.875em] font-medium mb-[0.5em]"
            style={{ color: "var(--player-text-muted)" }}
          >
            Font Size
          </legend>
          <div className="flex gap-[0.5em] flex-wrap">
            {FONT_SIZES.map((size) => (
              <button
                key={size.value}
                onClick={() => onUpdate("fontSize", size.value)}
                className="px-[1em] py-[0.5em] rounded-lg border min-h-[44px] cursor-pointer"
                style={{
                  backgroundColor:
                    preferences.fontSize === size.value
                      ? "var(--player-accent)"
                      : "var(--player-choice-bg)",
                  color:
                    preferences.fontSize === size.value
                      ? "var(--player-accent-text)"
                      : "var(--player-choice-text)",
                  borderColor:
                    preferences.fontSize === size.value
                      ? "var(--player-accent)"
                      : "var(--player-choice-border)",
                }}
                aria-pressed={preferences.fontSize === size.value}
              >
                {size.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Theme */}
        <fieldset>
          <legend className="text-[0.875em] font-medium mb-[0.5em]"
            style={{ color: "var(--player-text-muted)" }}
          >
            Theme
          </legend>
          <div className="flex gap-[0.5em]">
            {THEMES.map((theme) => (
              <button
                key={theme.value}
                onClick={() => onUpdate("theme", theme.value)}
                className="px-[1em] py-[0.5em] rounded-lg border min-h-[44px] cursor-pointer"
                style={{
                  backgroundColor:
                    preferences.theme === theme.value
                      ? "var(--player-accent)"
                      : "var(--player-choice-bg)",
                  color:
                    preferences.theme === theme.value
                      ? "var(--player-accent-text)"
                      : "var(--player-choice-text)",
                  borderColor:
                    preferences.theme === theme.value
                      ? "var(--player-accent)"
                      : "var(--player-choice-border)",
                }}
                aria-pressed={preferences.theme === theme.value}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create SaveLoadMenu component**

Create `player/ui/SaveLoadMenu.tsx`:

```tsx
import { useState, useEffect, useCallback } from "react";
import type {
  StorageAdapter,
  GameState,
  SavedState,
  SlotInfo,
} from "../engine/types";

interface SaveLoadMenuProps {
  storyId: string;
  storage: StorageAdapter;
  gameState: GameState;
  onRestore: (state: GameState) => void;
  onClose: () => void;
}

export function SaveLoadMenu({
  storyId,
  storage,
  gameState,
  onRestore,
  onClose,
}: SaveLoadMenuProps) {
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [saveName, setSaveName] = useState("");

  const refreshSlots = useCallback(async () => {
    const list = await storage.listSlots(storyId);
    list.sort((a, b) => b.timestamp - a.timestamp);
    setSlots(list);
  }, [storage, storyId]);

  useEffect(() => {
    refreshSlots();
  }, [refreshSlots]);

  const handleSave = async () => {
    const name = saveName.trim() || `Save ${new Date().toLocaleString()}`;
    const slotId = `slot-${Date.now()}`;
    const saved: SavedState = {
      gameState,
      name,
      timestamp: Date.now(),
    };
    await storage.saveSlot(storyId, slotId, saved);
    setSaveName("");
    refreshSlots();
  };

  const handleLoad = async (slotId: string) => {
    const saved = await storage.loadSlot(storyId, slotId);
    if (saved) {
      onRestore(saved.gameState);
      onClose();
    }
  };

  const handleDelete = async (slotId: string) => {
    await storage.deleteSlot(storyId, slotId);
    refreshSlots();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-label="Save and Load"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-md max-h-[80vh] rounded-t-2xl sm:rounded-2xl p-[1.5em]
                    flex flex-col"
        style={{
          backgroundColor: "var(--player-surface)",
          color: "var(--player-text)",
        }}
      >
        <div className="flex items-center justify-between mb-[1em]">
          <h2 className="text-[1.25em] font-bold">Save / Load</h2>
          <button
            onClick={onClose}
            aria-label="Close save menu"
            className="p-[0.5em] min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* New save */}
        <div className="flex gap-[0.5em] mb-[1.5em]">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Save name (optional)"
            className="flex-1 px-[0.75em] py-[0.5em] rounded-lg border min-h-[44px]"
            style={{
              backgroundColor: "var(--player-bg)",
              borderColor: "var(--player-border)",
              color: "var(--player-text)",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
          <button
            onClick={handleSave}
            className="px-[1em] py-[0.5em] rounded-lg min-h-[44px] font-medium cursor-pointer"
            style={{
              backgroundColor: "var(--player-accent)",
              color: "var(--player-accent-text)",
            }}
          >
            Save
          </button>
        </div>

        {/* Slot list */}
        <div className="flex-1 overflow-y-auto">
          {slots.length === 0 ? (
            <p
              className="text-center italic py-[2em]"
              style={{ color: "var(--player-text-muted)" }}
            >
              No saves yet
            </p>
          ) : (
            <ul className="list-none p-0 m-0 flex flex-col gap-[0.5em]">
              {slots.map((slot) => (
                <li
                  key={slot.slotId}
                  className="flex items-center justify-between p-[0.75em] rounded-lg border"
                  style={{
                    backgroundColor: "var(--player-choice-bg)",
                    borderColor: "var(--player-choice-border)",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{slot.name}</div>
                    <div
                      className="text-[0.75em]"
                      style={{ color: "var(--player-text-muted)" }}
                    >
                      {new Date(slot.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-[0.25em] ml-[0.5em]">
                    <button
                      onClick={() => handleLoad(slot.slotId)}
                      aria-label={`Load ${slot.name}`}
                      className="px-[0.75em] py-[0.25em] rounded min-h-[44px] cursor-pointer"
                      style={{
                        backgroundColor: "var(--player-accent)",
                        color: "var(--player-accent-text)",
                      }}
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDelete(slot.slotId)}
                      aria-label={`Delete ${slot.name}`}
                      className="px-[0.75em] py-[0.25em] rounded min-h-[44px] cursor-pointer"
                      style={{ color: "var(--player-text-muted)" }}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/jnurminen/cyoa2/player && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add player/ui/Settings.tsx player/ui/SaveLoadMenu.tsx
git commit -m "feat: add Settings and SaveLoadMenu player components"
```

---

## Task 10: Player E2E Test App and Playwright Tests

**Files:**
- Create: `player/e2e/test-app/index.html`
- Create: `player/e2e/test-app/main.tsx`
- Create: `player/e2e/test-app/memory-storage.ts`
- Create: `player/e2e/test-app/vite.config.ts`
- Create: `player/e2e/player.spec.ts`
- Create: `player/playwright.config.ts`
- Modify: `player/package.json` (add playwright scripts + deps)

- [ ] **Step 1: Update player/package.json with Playwright and Vite deps**

Add to devDependencies:

```json
"@playwright/test": "^1.57.0",
"@axe-core/playwright": "^4.10.0",
"@vitejs/plugin-react": "^4.2.1",
"vite": "^5.3.1"
```

Add scripts:

```json
"test:e2e": "playwright test",
"test:e2e:headed": "playwright test --headed",
"dev:test-app": "vite serve e2e/test-app --config e2e/test-app/vite.config.ts"
```

Run: `cd /Users/jnurminen/cyoa2/player && yarn install && npx playwright install chromium`

- [ ] **Step 2: Create test app Vite config**

Create `player/e2e/test-app/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  css: {
    postcss: {
      plugins: [],
    },
  },
});
```

- [ ] **Step 3: Create in-memory StorageAdapter for tests**

Create `player/e2e/test-app/memory-storage.ts`:

```typescript
import type { StorageAdapter, SavedState, SlotInfo } from "../../engine/types";

export class MemoryStorage implements StorageAdapter {
  private store = new Map<string, Map<string, SavedState>>();

  private getStoryStore(storyId: string): Map<string, SavedState> {
    if (!this.store.has(storyId)) {
      this.store.set(storyId, new Map());
    }
    return this.store.get(storyId)!;
  }

  async saveSlot(
    storyId: string,
    slotId: string,
    state: SavedState,
  ): Promise<void> {
    this.getStoryStore(storyId).set(slotId, state);
  }

  async loadSlot(
    storyId: string,
    slotId: string,
  ): Promise<SavedState | null> {
    return this.getStoryStore(storyId).get(slotId) ?? null;
  }

  async listSlots(storyId: string): Promise<SlotInfo[]> {
    const store = this.getStoryStore(storyId);
    return Array.from(store.entries()).map(([slotId, saved]) => ({
      slotId,
      name: saved.name,
      timestamp: saved.timestamp,
    }));
  }

  async deleteSlot(storyId: string, slotId: string): Promise<void> {
    this.getStoryStore(storyId).delete(slotId);
  }
}
```

- [ ] **Step 4: Create test app HTML and entry point**

Create `player/e2e/test-app/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fabler Player Test</title>
  </head>
  <body>
    <div id="root" style="height: 100vh"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

Create `player/e2e/test-app/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { StoryPlayer } from "../../ui/StoryPlayer";
import { MemoryStorage } from "./memory-storage";
import type { Manifest, AssetResolver } from "../../engine/types";
import "../../ui/player.css";

const noopAssets: AssetResolver = {
  getAssetUrl: (path: string) => path,
};

const storage = new MemoryStorage();

// Load fixture from URL param: ?fixture=branching
const params = new URLSearchParams(window.location.search);
const fixtureName = params.get("fixture") || "branching";

async function loadAndRender() {
  const response = await fetch(`/fixtures/${fixtureName}.json`);
  const manifest: Manifest = await response.json();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <StoryPlayer manifest={manifest} storage={storage} assets={noopAssets} />
    </React.StrictMode>,
  );
}

loadAndRender();
```

- [ ] **Step 5: Update test app Vite config to serve fixtures**

Update `player/e2e/test-app/vite.config.ts` to add a public dir for fixtures:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  publicDir: path.resolve(__dirname, "../../../test-fixtures"),
  server: {
    port: 5199,
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
});
```

Note: The fixtures from `test-fixtures/` will be served at `/fixtures/` — but Vite serves publicDir at root. We need the fixtures accessible. Rename approach: serve them at root and fetch as `/${fixtureName}.json`. Update `main.tsx` fetch to:

```typescript
const response = await fetch(`/${fixtureName}.json`);
```

Actually, simpler: set `publicDir` to point to `test-fixtures` and access files at root:

Update `main.tsx` line:
```typescript
const response = await fetch(`/${fixtureName}.json`);
```

- [ ] **Step 6: Create Playwright config**

Create `player/playwright.config.ts`:

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "html",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:5199",
  },
  webServer: {
    command: "npx vite serve e2e/test-app --config e2e/test-app/vite.config.ts",
    port: 5199,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 7: Write Playwright tests**

Create `player/e2e/player.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Player — branching story", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?fixture=branching");
    await page.waitForSelector("article");
  });

  test("renders the start page", async ({ page }) => {
    await expect(page.locator("article h1")).toHaveText("Entrance");
    await expect(page.locator("article")).toContainText("fork in the road");
  });

  test("displays available choices", async ({ page }) => {
    const choices = page.locator("nav[aria-label='Story choices'] button");
    await expect(choices).toHaveCount(2);
    await expect(choices.nth(0)).toHaveText("Take the left path");
    await expect(choices.nth(1)).toHaveText("Take the right path");
  });

  test("navigates to a new page on choice", async ({ page }) => {
    await page.click("text=Take the left path");
    await expect(page.locator("article h1")).toHaveText("Deep Forest");
  });

  test("can navigate back", async ({ page }) => {
    await page.click("text=Take the left path");
    await page.click("text=Turn back to the fork");
    await expect(page.locator("article h1")).toHaveText("Entrance");
  });

  test("shows The End on terminal pages", async ({ page }) => {
    await page.click("text=Take the left path");
    await page.click("text=Press deeper into the forest");
    await expect(page.locator("article h1")).toHaveText("Sunlit Clearing");
    await expect(page.locator("text=The End")).toBeVisible();
  });

  test("passes accessibility audit", async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("Player — flags story", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?fixture=flags");
    await page.waitForSelector("article");
  });

  test("shows conditional choices based on flags", async ({ page }) => {
    // Initially: "Try the door" visible (door_unlocked=false), "Open the door" hidden
    await expect(page.locator("text=Try the door")).toBeVisible();
    await expect(page.locator("text=Open the door")).not.toBeVisible();
  });

  test("flag operations change available choices", async ({ page }) => {
    // Search table → sets has_key
    await page.click("text=Search the table");
    await expect(page.locator("article h1")).toHaveText("The Table");

    await page.click("text=Go back to the room");

    // Try door → shows "Use the key" because has_key=true
    await page.click("text=Try the door");
    await expect(page.locator("text=Use the key")).toBeVisible();
  });

  test("complete puzzle playthrough", async ({ page }) => {
    // Get key
    await page.click("text=Search the table");
    await page.click("text=Go back to the room");

    // Unlock door
    await page.click("text=Try the door");
    await page.click("text=Use the key");

    // Now "Open the door" should be visible (door_unlocked=true)
    await expect(page.locator("text=Open the door")).toBeVisible();
    await page.click("text=Open the door");
    await expect(page.locator("article h1")).toHaveText("Freedom");
  });

  test("passes accessibility audit", async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("Player — save/load", () => {
  test("can save and load game state", async ({ page }) => {
    await page.goto("/?fixture=flags");
    await page.waitForSelector("article");

    // Navigate somewhere
    await page.click("text=Search the table");
    await expect(page.locator("article h1")).toHaveText("The Table");

    // Open save menu
    await page.click("button[aria-label='Save and load']");
    await expect(page.locator("text=Save / Load")).toBeVisible();

    // Save
    await page.fill("input[placeholder='Save name (optional)']", "My Save");
    await page.click("text=Save");
    await expect(page.locator("text=My Save")).toBeVisible();

    // Close save menu, navigate away
    await page.click("button[aria-label='Close save menu']");
    await page.click("text=Go back to the room");
    await expect(page.locator("article h1")).toHaveText("The Room");

    // Load the save
    await page.click("button[aria-label='Save and load']");
    await page.click("text=Load");
    await expect(page.locator("article h1")).toHaveText("The Table");
  });
});

test.describe("Player — settings", () => {
  test("can change font size", async ({ page }) => {
    await page.goto("/?fixture=minimal");
    await page.waitForSelector("article");

    await page.click("button[aria-label='Settings']");
    await page.click("text=Large");
    await page.click("button[aria-label='Close settings']");

    const root = page.locator("[data-font-size='large']");
    await expect(root).toBeVisible();
  });

  test("can change theme", async ({ page }) => {
    await page.goto("/?fixture=minimal");
    await page.waitForSelector("article");

    await page.click("button[aria-label='Settings']");
    await page.click("text=Dark");
    await page.click("button[aria-label='Close settings']");

    const root = page.locator("[data-theme='dark']");
    await expect(root).toBeVisible();
  });
});
```

- [ ] **Step 8: Run Playwright tests**

Run: `cd /Users/jnurminen/cyoa2/player && npx playwright test`

Expected: All tests pass. If there are failures, fix them iteratively.

- [ ] **Step 9: Commit**

```bash
git add player/e2e/ player/playwright.config.ts player/package.json player/yarn.lock
git commit -m "feat: add player E2E tests with Playwright and accessibility audits"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run all Rust tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test -p shared`

Expected: All bundle tests pass.

- [ ] **Step 2: Run all player unit tests**

Run: `cd /Users/jnurminen/cyoa2/player && npx vitest run`

Expected: All runtime tests pass.

- [ ] **Step 3: Run all player E2E tests**

Run: `cd /Users/jnurminen/cyoa2/player && npx playwright test`

Expected: All E2E tests pass, including accessibility audits.

- [ ] **Step 4: Verify creation tool still compiles**

Run: `cd /Users/jnurminen/cyoa2 && cargo build -p creation-tool`

Expected: Compiles without errors.

- [ ] **Step 5: Commit any final fixes**

If any test required fixes, commit them:

```bash
git add -A
git commit -m "fix: address issues found in final verification"
```
