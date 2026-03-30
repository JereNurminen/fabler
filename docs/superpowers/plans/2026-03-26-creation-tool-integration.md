# Creation Tool Player Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed the player into the creation tool for preview (current page as reader sees it) and playtest (full story navigation from start).

**Architecture:** A converter function transforms editor atom state (StoryOutline + full Pages + Flags) into a player Manifest. The player is rendered in a split-view panel or modal, using the existing `@fabler/player` package with an in-memory StorageAdapter and a no-op AssetResolver. The player package is consumed as a workspace dependency.

**Tech Stack:** React 18, Jotai, existing creation-tool infrastructure, `@fabler/player` engine + UI

---

## File Map

| File | Responsibility |
|---|---|
| `creation-tool/src/player/convertToManifest.ts` | Convert editor atoms (Story + Pages + Flags) → player Manifest |
| `creation-tool/src/player/MemoryStorage.ts` | In-memory StorageAdapter for playtest mode |
| `creation-tool/src/player/PlaytestView.tsx` | Full playtest modal — fetches all pages, builds manifest, renders StoryPlayer |
| `creation-tool/src/player/PreviewView.tsx` | Single-page preview — shows current page as reader would see it |
| `creation-tool/src/player/__tests__/convertToManifest.test.ts` | Unit tests for the conversion |
| `creation-tool/src/components/layout/MainLayout.tsx` | Add playtest button to layout |
| `creation-tool/src/components/layout/DesktopSidebar.tsx` | Add "Playtest" button to sidebar |
| `creation-tool/src/components/layout/TabletSidebar.tsx` | Add "Playtest" button |
| `creation-tool/src/components/layout/MobileNav.tsx` | Add "Playtest" button |
| `creation-tool/src/pages/StoryEditorPage.tsx` | Add preview panel alongside PageCard |
| `creation-tool/src/i18n/translations.ts` | Add translation keys for preview/playtest |
| `creation-tool/package.json` | Add `@fabler/player` workspace dependency |

---

## Task 1: Workspace Setup — Link Player Package

**Files:**
- Create: `package.json` (root — yarn workspaces config)
- Modify: `creation-tool/package.json`

- [ ] **Step 1: Create root package.json for yarn workspaces**

Create `/Users/jnurminen/cyoa2/package.json`:

```json
{
  "private": true,
  "workspaces": [
    "player",
    "creation-tool"
  ]
}
```

- [ ] **Step 2: Add player dependency to creation-tool**

In `creation-tool/package.json`, add to dependencies:

```json
"@fabler/player": "workspace:*"
```

- [ ] **Step 3: Install**

Run: `cd /Users/jnurminen/cyoa2 && yarn install`

Verify the player package is linked: `ls creation-tool/node_modules/@fabler/player`

- [ ] **Step 4: Commit**

```bash
git add package.json creation-tool/package.json yarn.lock
git commit -m "feat: set up yarn workspaces, link player package to creation tool"
```

---

## Task 2: Manifest Converter

**Files:**
- Create: `creation-tool/src/player/convertToManifest.ts`
- Create: `creation-tool/src/player/__tests__/convertToManifest.test.ts`

- [ ] **Step 1: Write failing tests**

Create `creation-tool/src/player/__tests__/convertToManifest.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { convertToManifest, convertPageToManifestPage } from "../convertToManifest";
import type { Page, Flag, StoryOutline } from "../../bindings";

describe("convertPageToManifestPage", () => {
  it("converts a page with choices, flag operations, and conditions", () => {
    const page: Page = {
      id: 1,
      story_id: 10,
      name: "Test Page",
      body: "Hello world",
      options: [
        {
          id: 100,
          page_id: 1,
          text: "Go north",
          target_page: 2,
          flag_operations: [{ id: 500, flag_id: 50, operation: "set_true" }],
          conditions: [{ id: 600, flag_id: 51, required_value: true }],
        },
      ],
      flag_operations: [{ id: 501, flag_id: 52, operation: "toggle" }],
    };

    const result = convertPageToManifestPage(page);

    expect(result.id).toBe("1");
    expect(result.name).toBe("Test Page");
    expect(result.body).toBe("Hello world");
    expect(result.assets).toEqual([]);
    expect(result.choices).toHaveLength(1);
    expect(result.choices[0].id).toBe("100");
    expect(result.choices[0].text).toBe("Go north");
    expect(result.choices[0].target).toBe("2");
    expect(result.choices[0].flag_operations).toEqual([
      { flag_id: "50", operation: "set_true" },
    ]);
    expect(result.choices[0].conditions).toEqual([
      { flag_id: "51", required_value: true },
    ]);
    expect(result.flag_operations).toEqual([
      { flag_id: "52", operation: "toggle" },
    ]);
  });

  it("converts a page with no choices or operations", () => {
    const page: Page = {
      id: 5,
      story_id: 10,
      name: "End",
      body: "The end.",
      options: [],
      flag_operations: [],
    };

    const result = convertPageToManifestPage(page);

    expect(result.id).toBe("5");
    expect(result.choices).toEqual([]);
    expect(result.flag_operations).toEqual([]);
  });
});

describe("convertToManifest", () => {
  it("converts a full story to manifest", () => {
    const outline: StoryOutline = {
      id: 10,
      title: "My Story",
      pages: [
        { id: 1, name: "Start" },
        { id: 2, name: "End" },
      ],
      start_page: 1,
    };

    const fullPages: Page[] = [
      {
        id: 1,
        story_id: 10,
        name: "Start",
        body: "Beginning",
        options: [
          {
            id: 100,
            page_id: 1,
            text: "Continue",
            target_page: 2,
            flag_operations: [],
            conditions: [],
          },
        ],
        flag_operations: [],
      },
      {
        id: 2,
        story_id: 10,
        name: "End",
        body: "The end",
        options: [],
        flag_operations: [],
      },
    ];

    const flags: Flag[] = [
      { id: 50, story_id: 10, name: "has_key", default_value: false },
    ];

    const manifest = convertToManifest(outline, fullPages, flags);

    expect(manifest.format_version).toBe(1);
    expect(manifest.story.id).toBe("10");
    expect(manifest.story.title).toBe("My Story");
    expect(manifest.story.start_page).toBe("1");
    expect(manifest.flags).toEqual([
      { id: "50", name: "has_key", default_value: false },
    ]);
    expect(manifest.pages).toHaveLength(2);
    expect(manifest.pages[0].choices[0].target).toBe("2");
  });

  it("handles empty flags and single page", () => {
    const outline: StoryOutline = {
      id: 1,
      title: "Minimal",
      pages: [{ id: 1, name: "Only" }],
      start_page: 1,
    };

    const fullPages: Page[] = [
      {
        id: 1,
        story_id: 1,
        name: "Only",
        body: "Just this.",
        options: [],
        flag_operations: [],
      },
    ];

    const manifest = convertToManifest(outline, fullPages, []);

    expect(manifest.flags).toEqual([]);
    expect(manifest.pages).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

This requires vitest in the creation-tool. Check if vitest is available, if not, add it:

```bash
cd /Users/jnurminen/cyoa2/creation-tool
npx vitest run --config ../player/vitest.config.ts src/player/__tests__/convertToManifest.test.ts
```

If vitest isn't configured for the creation-tool, create a minimal vitest config or run via the player's vitest. Alternatively, add vitest to creation-tool devDependencies and create `creation-tool/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement converter**

Create `creation-tool/src/player/convertToManifest.ts`:

```typescript
import type { Manifest, ManifestPage, ManifestChoice, ManifestFlagOperation, ManifestCondition } from "@fabler/player/engine/types";
import type { Page, Flag, StoryOutline, Choice, FlagOperation, ChoiceCondition } from "../bindings";

function convertFlagOperation(op: FlagOperation): ManifestFlagOperation {
  return {
    flag_id: op.flag_id.toString(),
    operation: op.operation as ManifestFlagOperation["operation"],
  };
}

function convertCondition(cond: ChoiceCondition): ManifestCondition {
  return {
    flag_id: cond.flag_id.toString(),
    required_value: cond.required_value,
  };
}

function convertChoice(choice: Choice): ManifestChoice {
  return {
    id: choice.id.toString(),
    text: choice.text,
    target: choice.target_page.toString(),
    flag_operations: choice.flag_operations.map(convertFlagOperation),
    conditions: choice.conditions.map(convertCondition),
  };
}

export function convertPageToManifestPage(page: Page): ManifestPage {
  return {
    id: page.id.toString(),
    name: page.name,
    body: page.body,
    assets: [],
    flag_operations: page.flag_operations.map(convertFlagOperation),
    choices: page.options.map(convertChoice),
  };
}

export function convertToManifest(
  outline: StoryOutline,
  fullPages: Page[],
  flags: Flag[],
): Manifest {
  return {
    format_version: 1,
    story: {
      id: outline.id.toString(),
      title: outline.title,
      start_page: outline.start_page.toString(),
    },
    flags: flags.map((f) => ({
      id: f.id.toString(),
      name: f.name,
      default_value: f.default_value,
    })),
    pages: fullPages.map(convertPageToManifestPage),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/jnurminen/cyoa2/creation-tool && npx vitest run`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add creation-tool/src/player/ creation-tool/vitest.config.ts
git commit -m "feat: add manifest converter for editor-to-player data flow"
```

---

## Task 3: In-Memory StorageAdapter

**Files:**
- Create: `creation-tool/src/player/MemoryStorage.ts`

- [ ] **Step 1: Create MemoryStorage**

Create `creation-tool/src/player/MemoryStorage.ts`:

```typescript
import type { StorageAdapter, SavedState, SlotInfo } from "@fabler/player/engine/types";

export class MemoryStorage implements StorageAdapter {
  private store = new Map<string, Map<string, SavedState>>();

  private getStoryStore(storyId: string): Map<string, SavedState> {
    if (!this.store.has(storyId)) {
      this.store.set(storyId, new Map());
    }
    return this.store.get(storyId)!;
  }

  async saveSlot(storyId: string, slotId: string, state: SavedState): Promise<void> {
    this.getStoryStore(storyId).set(slotId, state);
  }

  async loadSlot(storyId: string, slotId: string): Promise<SavedState | null> {
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

- [ ] **Step 2: Commit**

```bash
git add creation-tool/src/player/MemoryStorage.ts
git commit -m "feat: add in-memory StorageAdapter for playtest mode"
```

---

## Task 4: Translation Keys

**Files:**
- Modify: `creation-tool/src/i18n/translations.ts`

- [ ] **Step 1: Read current translations file**

Read `creation-tool/src/i18n/translations.ts` to find where to add new keys.

- [ ] **Step 2: Add player-related translations**

Add to the appropriate sections:

```typescript
// In buttons section:
playtest: "Playtest",
preview: "Preview",
closePlaytest: "Close Playtest",
closePreview: "Close Preview",

// In labels section:
playtestMode: "Playtest Mode",
previewMode: "Preview",

// In status section:
loadingPlaytest: "Loading story for playtest...",
```

- [ ] **Step 3: Commit**

```bash
git add creation-tool/src/i18n/translations.ts
git commit -m "feat: add translation keys for preview and playtest"
```

---

## Task 5: PlaytestView Component

**Files:**
- Create: `creation-tool/src/player/PlaytestView.tsx`

- [ ] **Step 1: Create PlaytestView**

This component:
1. Fetches all full pages for the current story (the outline only has id+name)
2. Converts to a Manifest
3. Renders StoryPlayer in a full-screen modal overlay

```tsx
import { useState, useEffect, useMemo, useRef } from "react";
import { StoryPlayer } from "@fabler/player/ui";
import type { Manifest, AssetResolver } from "@fabler/player/engine/types";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { convertToManifest } from "./convertToManifest";
import { MemoryStorage } from "./MemoryStorage";
import { useTranslation } from "../i18n";
import type { Page } from "../bindings";
import "@fabler/player/ui/player.css";

const noopAssets: AssetResolver = {
  getAssetUrl: (path: string) => path,
};

interface PlaytestViewProps {
  onClose: () => void;
}

export function PlaytestView({ onClose }: PlaytestViewProps) {
  const { story, pages, flags, getPage } = useStoryAtoms();
  const { t } = useTranslation();
  const [fullPages, setFullPages] = useState<Page[] | null>(null);
  const storageRef = useRef(new MemoryStorage());

  useEffect(() => {
    if (!story || pages.length === 0) return;

    async function loadAllPages() {
      const loaded = await Promise.all(
        pages.map((p) => getPage(p.id)),
      );
      setFullPages(loaded.filter((p): p is Page => p !== null));
    }

    loadAllPages();
  }, [story, pages, getPage]);

  const manifest = useMemo<Manifest | null>(() => {
    if (!story || !fullPages) return null;
    return convertToManifest(story, fullPages, flags);
  }, [story, fullPages, flags]);

  if (!manifest) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <p className="text-white">{t.status.loadingPlaytest}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b shrink-0">
        <span className="text-sm font-medium text-gray-600">
          {t.labels.playtestMode}
        </span>
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
        >
          {t.buttons.closePlaytest}
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <StoryPlayer
          manifest={manifest}
          storage={storageRef.current}
          assets={noopAssets}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/jnurminen/cyoa2/creation-tool && npx tsc --noEmit`

Note: The import `@fabler/player/ui` and `@fabler/player/engine/types` must resolve correctly via the workspace link. If not, adjust the import paths. The player's package.json may need `"exports"` field or the creation-tool's tsconfig may need path mappings. Handle this during implementation.

- [ ] **Step 3: Commit**

```bash
git add creation-tool/src/player/PlaytestView.tsx
git commit -m "feat: add PlaytestView component for full story playtesting"
```

---

## Task 6: PreviewView Component

**Files:**
- Create: `creation-tool/src/player/PreviewView.tsx`

- [ ] **Step 1: Create PreviewView**

This is a simpler component that shows a read-only view of a single page as the reader would see it. No navigation, no save/load — just the page content and its choices (greyed out).

```tsx
import type { ManifestPage, ManifestChoice } from "@fabler/player/engine/types";
import { convertPageToManifestPage } from "./convertToManifest";
import type { Page } from "../bindings";

interface PreviewViewProps {
  page: Page;
}

export function PreviewView({ page }: PreviewViewProps) {
  const manifestPage = convertPageToManifestPage(page);

  return (
    <div
      className="h-full overflow-y-auto p-6"
      data-theme="light"
      data-font-size="medium"
    >
      <article className="max-w-prose mx-auto">
        <h1 className="text-xl font-bold mb-4 text-gray-900">
          {manifestPage.name}
        </h1>
        <div className="leading-relaxed whitespace-pre-wrap text-gray-900">
          {manifestPage.body}
        </div>
        {manifestPage.choices.length > 0 && (
          <nav className="mt-8 pt-4 border-t border-gray-200">
            <ul className="list-none p-0 m-0 flex flex-col gap-3">
              {manifestPage.choices.map((choice) => (
                <li key={choice.id}>
                  <div className="w-full text-left p-4 rounded-lg border border-gray-200 bg-gray-50 text-gray-500">
                    {choice.text}
                  </div>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {manifestPage.choices.length === 0 && (
          <div className="mt-8 pt-4 border-t border-gray-200">
            <p className="text-center italic text-gray-400">The End</p>
          </div>
        )}
      </article>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add creation-tool/src/player/PreviewView.tsx
git commit -m "feat: add PreviewView component for single-page preview"
```

---

## Task 7: Wire Playtest Into Layout

**Files:**
- Modify: `creation-tool/src/pages/StoryEditorPage.tsx`
- Modify: `creation-tool/src/components/layout/MainLayout.tsx`
- Modify: `creation-tool/src/components/layout/DesktopSidebar.tsx`
- Modify: `creation-tool/src/components/layout/TabletSidebar.tsx`
- Modify: `creation-tool/src/components/layout/MobileNav.tsx`

- [ ] **Step 1: Add playtest state to StoryEditorPage**

Read `StoryEditorPage.tsx`. Add state for playtest mode and pass it to MainLayout:

```tsx
const [playtestOpen, setPlaytestOpen] = useState(false);
```

Add PlaytestView rendering when `playtestOpen` is true:

```tsx
{playtestOpen && (
  <Suspense fallback={<LoadingSpinner />}>
    <PlaytestView onClose={() => setPlaytestOpen(false)} />
  </Suspense>
)}
```

Pass `onPlaytest={() => setPlaytestOpen(true)}` to MainLayout.

- [ ] **Step 2: Add onPlaytest prop to MainLayout**

Read `MainLayout.tsx`. Add `onPlaytest: () => void` to MainLayoutProps and pass it down to all three sidebar components.

- [ ] **Step 3: Add Playtest button to DesktopSidebar**

Read `DesktopSidebar.tsx`. Add a "Playtest" button in the story settings section or as a prominent action button. Use the translation key `t.buttons.playtest`. Call `onPlaytest()` on click.

- [ ] **Step 4: Add Playtest button to TabletSidebar and MobileNav**

Same pattern — add a playtest button that calls `onPlaytest()`.

- [ ] **Step 5: Verify it compiles**

Run: `cd /Users/jnurminen/cyoa2/creation-tool && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add creation-tool/src/pages/StoryEditorPage.tsx creation-tool/src/components/layout/
git commit -m "feat: wire playtest button into all sidebar layouts"
```

---

## Task 8: Wire Preview Into Page Editor

**Files:**
- Modify: `creation-tool/src/pages/StoryEditorPage.tsx`
- Modify: `creation-tool/src/components/PageCard.tsx`

- [ ] **Step 1: Add preview toggle to StoryEditorPage**

Add a `showPreview` state. When true, render the main content area as a split view: PageCard on the left, PreviewView on the right.

```tsx
const [showPreview, setShowPreview] = useState(false);
```

Modify the content rendering:

```tsx
{pageId ? (
  <Suspense fallback={<LoadingSpinner />}>
    <div className={showPreview ? "flex h-full" : "h-full"}>
      <div className={showPreview ? "flex-1 overflow-auto" : "h-full"}>
        <PageCard
          pageId={pageId}
          onTogglePreview={() => setShowPreview((p) => !p)}
          showPreview={showPreview}
        />
      </div>
      {showPreview && (
        <div className="w-96 border-l border-gray-200 hidden lg:block">
          <PreviewView page={/* need full page data */} />
        </div>
      )}
    </div>
  </Suspense>
) : (/* ... */)}
```

Note: Getting the full Page data for PreviewView requires using `pageAtomFamily`. The implementer should use `useAtomValue(pageAtomFamily(pageId))` inside a wrapper or pass the page data from PageCard.

- [ ] **Step 2: Add preview toggle button to PageCard**

Read `PageCard.tsx`. Add a small toggle button (e.g. an eye icon) in the page header that calls `onTogglePreview`.

- [ ] **Step 3: Verify it compiles and test manually**

Run: `cd /Users/jnurminen/cyoa2/creation-tool && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add creation-tool/src/pages/StoryEditorPage.tsx creation-tool/src/components/PageCard.tsx
git commit -m "feat: add preview panel toggle alongside page editor"
```

---

## Task 9: E2E Tests for Playtest Integration

**Files:**
- Create: `creation-tool/e2e/playtest.spec.ts`

- [ ] **Step 1: Write Playwright tests**

Create E2E tests that:
1. Create a story with multiple pages and choices using the existing test helpers
2. Click the Playtest button
3. Verify the player opens with the correct start page
4. Navigate through choices
5. Close playtest and verify return to editor

```typescript
import { test, expect } from "@playwright/test";

test.describe("Playtest integration", () => {
  // Use existing test helper patterns from creation-tool/e2e/
  // to set up a story with pages and choices

  test("opens playtest from sidebar", async ({ page }) => {
    // Set up story...
    // Click Playtest button
    // Verify player is visible with story title
    // Verify start page content shows
  });

  test("can navigate through story in playtest", async ({ page }) => {
    // Set up story with multiple pages...
    // Open playtest
    // Click a choice
    // Verify navigation to next page
  });

  test("closes playtest and returns to editor", async ({ page }) => {
    // Open playtest
    // Click close button
    // Verify editor is visible again
  });
});
```

The implementer should read existing E2E test patterns from `creation-tool/e2e/` to match the project's test style and helper usage.

- [ ] **Step 2: Run tests**

Run: `cd /Users/jnurminen/cyoa2/creation-tool && yarn test:e2e`

- [ ] **Step 3: Commit**

```bash
git add creation-tool/e2e/playtest.spec.ts
git commit -m "feat: add E2E tests for playtest integration"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run all player unit tests**

Run: `cd /Users/jnurminen/cyoa2/player && npx vitest run`

Expected: All 25 engine tests pass.

- [ ] **Step 2: Run converter unit tests**

Run: `cd /Users/jnurminen/cyoa2/creation-tool && npx vitest run`

Expected: All converter tests pass.

- [ ] **Step 3: Run creation tool E2E tests**

Run: `cd /Users/jnurminen/cyoa2/creation-tool && yarn test:e2e`

Expected: All tests pass including playtest tests.

- [ ] **Step 4: Run player E2E tests**

Run: `cd /Users/jnurminen/cyoa2/player && npx playwright test`

Expected: All 13 tests still pass.

- [ ] **Step 5: Verify creation tool compiles**

Run: `cd /Users/jnurminen/cyoa2 && cargo build -p creation-tool`

Expected: Compiles.
