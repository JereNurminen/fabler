# Frontend Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the creation tool frontend from the old SQLite-backed API (numeric IDs, Result wrappers, granular CRUD) to the new project-based API (string IDs, direct invoke, full-object saves).

**Architecture:** Atoms are rewritten for a single-project model. Components shift from granular patch operations to local mutation + full-object save. The start page becomes a project open/create dialog. Routing drops the story ID parameter.

**Tech Stack:** React 18, Jotai, Wouter, Tauri IPC via invoke()

---

## File Map

### Rewritten files

| File | Responsibility |
|---|---|
| `src/atoms/storyAtoms.ts` | Core atoms: project state, page list, page family, flags |
| `src/atoms/storyActions.ts` | Action atoms: open/create project, save page/story, create/delete page |
| `src/atoms/useStoryAtoms.ts` | Hook exposing atoms + actions to components |
| `src/pages/StartPage.tsx` | Open/create project dialog |
| `src/pages/StoryEditorPage.tsx` | Editor page (no storyId param) |
| `src/components/PageCard.tsx` | Page editor with full-object save pattern |
| `src/utilities/routing.ts` | Simplified routes |
| `src/main.tsx` | Updated routes and event listeners |

### Modified files (minor type/import fixes)

| File | Change |
|---|---|
| `src/components/ChoiceConditions.tsx` | Import from types.ts, string IDs |
| `src/components/FlagOperations.tsx` | Import from types.ts, string IDs |
| `src/components/FlagsDialog.tsx` | Import from types.ts, remove story_id, save via story object |
| `src/components/layout/DesktopSidebar.tsx` | String IDs in props, update handlers |
| `src/components/layout/TabletSidebar.tsx` | String IDs in props |
| `src/components/layout/MobileNav.tsx` | String IDs in props |
| `src/components/layout/MainLayout.tsx` | String IDs in props |
| `src/components/NewPageButton.tsx` | Updated create page call |
| `src/components/PageLink.tsx` | String IDs, new route links |

---

## Task 1: Routing and ID Utilities

**Files:**
- Rewrite: `src/utilities/routing.ts`
- Create: `src/utilities/id.ts`

- [ ] **Step 1: Rewrite routing.ts**

```typescript
// Routes for the editor — no story ID needed (single project model)
export const editorRoute = "/editor";
export const editorPageRoute = "/editor/page/:pageId";

export function getLinkToEditor(): string {
  return "/editor";
}

export function getLinkToPage(pageId: string): string {
  return `/editor/page/${pageId}`;
}
```

- [ ] **Step 2: Create id.ts**

Frontend needs to generate IDs for new choices, flags, and flag operations (the backend generates page IDs, but inline objects need client-side IDs).

```typescript
export function generateId(): string {
  const value = Math.floor(Math.random() * 0x100000);
  return value.toString(16).padStart(5, "0");
}
```

- [ ] **Step 3: Commit**

```bash
git add src/utilities/
git commit -m "feat: simplify routing for project model, add client-side ID generation"
```

---

## Task 2: Rewrite Atom System

**Files:**
- Rewrite: `src/atoms/storyAtoms.ts`
- Rewrite: `src/atoms/storyActions.ts`
- Rewrite: `src/atoms/useStoryAtoms.ts`

- [ ] **Step 1: Rewrite storyAtoms.ts**

```typescript
import { atom } from "jotai";
import { atomFamily } from "jotai-family";
import api from "../api";
import type { Story, PageListItem, Page } from "../types";

// Whether a project is currently open
export const projectOpenAtom = atom(false);

// Refresh counter — increment to refetch story/pages
export const refreshAtom = atom(0);

// Story metadata (including flags) — fetched from the open project
export const storyAtom = atom(async (get) => {
  if (!get(projectOpenAtom)) return null;
  get(refreshAtom);
  return api.getStory();
});

// Page list — lightweight (id + name only)
export const pageListAtom = atom(async (get) => {
  if (!get(projectOpenAtom)) return [];
  get(refreshAtom);
  return api.listPages();
});

// Individual page data — loaded on demand by ID
export const pageAtomFamily = atomFamily((pageId: string) =>
  atom(async () => {
    return api.getPage(pageId);
  }),
);

// Flags derived from story
export const storyFlagsAtom = atom(async (get) => {
  const story = await get(storyAtom);
  return story?.flags ?? [];
});
```

- [ ] **Step 2: Rewrite storyActions.ts**

```typescript
import { atom } from "jotai";
import api from "../api";
import type { Story, Page } from "../types";
import {
  projectOpenAtom,
  refreshAtom,
  pageAtomFamily,
} from "./storyAtoms";

export const openProjectAtom = atom(null, async (_get, set, path: string) => {
  const story = await api.openProject(path);
  set(projectOpenAtom, true);
  set(refreshAtom, (c) => c + 1);
  return story;
});

export const createProjectAtom = atom(
  null,
  async (_get, set, args: { path: string; title: string }) => {
    const story = await api.createProject(args.path, args.title);
    set(projectOpenAtom, true);
    set(refreshAtom, (c) => c + 1);
    return story;
  },
);

export const closeProjectAtom = atom(null, async (_get, set) => {
  await api.closeProject();
  set(projectOpenAtom, false);
});

export const saveStoryAtom = atom(null, async (_get, set, story: Story) => {
  await api.saveStory(story);
  set(refreshAtom, (c) => c + 1);
});

export const savePageAtom = atom(null, async (_get, set, page: Page) => {
  await api.savePage(page);
  // Invalidate the cached page
  pageAtomFamily.remove(page.id);
  // Refresh page list in case name changed
  set(refreshAtom, (c) => c + 1);
});

export const createPageAtom = atom(null, async (_get, set, name: string) => {
  const page = await api.createPage(name);
  set(refreshAtom, (c) => c + 1);
  return page;
});

export const deletePageAtom = atom(null, async (_get, set, id: string) => {
  await api.deletePage(id);
  pageAtomFamily.remove(id);
  set(refreshAtom, (c) => c + 1);
});
```

- [ ] **Step 3: Rewrite useStoryAtoms.ts**

```typescript
import { useAtomValue, useSetAtom } from "jotai";
import { storyAtom, pageListAtom, storyFlagsAtom } from "./storyAtoms";
import {
  openProjectAtom,
  createProjectAtom,
  closeProjectAtom,
  saveStoryAtom,
  savePageAtom,
  createPageAtom,
  deletePageAtom,
} from "./storyActions";

export const useStoryAtoms = () => {
  const story = useAtomValue(storyAtom);
  const pages = useAtomValue(pageListAtom);
  const flags = useAtomValue(storyFlagsAtom);

  const openProject = useSetAtom(openProjectAtom);
  const createProject = useSetAtom(createProjectAtom);
  const closeProject = useSetAtom(closeProjectAtom);
  const saveStory = useSetAtom(saveStoryAtom);
  const savePage = useSetAtom(savePageAtom);
  const createPage = useSetAtom(createPageAtom);
  const deletePage = useSetAtom(deletePageAtom);

  return {
    story,
    pages,
    flags,
    openProject,
    createProject,
    closeProject,
    saveStory,
    savePage,
    createPage,
    deletePage,
  };
};
```

- [ ] **Step 4: Commit**

```bash
git add src/atoms/
git commit -m "feat: rewrite atom system for project-based model"
```

---

## Task 3: Rewrite StartPage

**Files:**
- Rewrite: `src/pages/StartPage.tsx`

The start page becomes a project open/create dialog. No more story list.

- [ ] **Step 1: Rewrite StartPage.tsx**

```tsx
import { useState } from "react";
import { useLocation } from "wouter";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { useTranslation } from "../i18n";
import { getLinkToEditor } from "../utilities/routing";

export const StartPage = () => {
  const [_, setLocation] = useLocation();
  const { openProject, createProject } = useStoryAtoms();
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    try {
      const filePath = await openDialog({
        filters: [{ name: "Fabler Story", extensions: ["story.json"] }],
      });
      if (!filePath) return;

      await openProject(filePath);
      setLocation(getLinkToEditor());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open project");
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      // Ask for directory
      const dirPath = await openDialog({
        directory: true,
        title: "Choose project location",
      });
      if (!dirPath) return;

      await createProject({ path: dirPath, title: newTitle.trim() });
      setLocation(getLinkToEditor());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="max-w-md w-full p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Fabler
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleOpen}
            className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            {t.buttons.openProject || "Open Project"}
          </button>

          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              {t.buttons.newProject || "New Project"}
            </button>
          ) : (
            <div className="p-4 border border-gray-200 rounded-lg space-y-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t.placeholders.storyTitle || "Story title"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  className="flex-1 py-2 px-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  {t.buttons.create || "Create"}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="py-2 px-3 text-gray-600 hover:text-gray-800"
                >
                  {t.buttons.cancel || "Cancel"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Add translation keys**

In `src/i18n/translations.ts`, add to the buttons section:
```typescript
openProject: "Open Project",
newProject: "New Project",
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/StartPage.tsx src/i18n/translations.ts
git commit -m "feat: rewrite start page for project open/create workflow"
```

---

## Task 4: Update Main App Routes

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Read and update main.tsx**

Update the routes to use the new routing pattern. Key changes:
- Import new route constants from routing.ts
- Route `/` → StartPage
- Route `/editor` → StoryEditorPage (no storyId param)
- Route `/editor/page/:pageId` → StoryEditorPage with pageId
- Remove the old `storyRoute` and `pageRoute`
- Update the export-story event listener (already done in previous task)
- Remove the database-reset listener (no database)
- Clean up unused imports (readTextFile, writeTextFile, getLinkToStoryPage)

The implementer should read the current main.tsx, understand the structure, and make minimal changes.

- [ ] **Step 2: Commit**

```bash
git add src/main.tsx
git commit -m "feat: update app routes for project-based model"
```

---

## Task 5: Update StoryEditorPage

**Files:**
- Modify: `src/pages/StoryEditorPage.tsx`

- [ ] **Step 1: Read and rewrite StoryEditorPage**

Key changes:
- Remove `storyIdParam` prop — no story ID in the URL
- `pageIdParam` is now optional string (not parsed from number)
- No `loadStory()` call — the project is already open from StartPage
- Use `useStoryAtoms()` to get `story`, `pages`
- Use new routing functions for links
- The split-view preview and playtest features stay the same

```tsx
import { Suspense, useState } from "react";
import { useAtomValue } from "jotai";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { pageAtomFamily } from "../atoms/storyAtoms";
import LoadingSpinner from "../components/LoadingSpinner";
import PageCard from "../components/PageCard";
import { MainLayout } from "../components/layout/MainLayout";
import { PlaytestView } from "../player/PlaytestView";
import { PreviewView } from "../player/PreviewView";
import type { Page } from "../types";

interface StoryEditorPageProps {
  pageIdParam?: string;
}

function PreviewPanel({ pageId }: { pageId: string }) {
  const page = useAtomValue(pageAtomFamily(pageId));
  if (!page) return null;
  return (
    <div className="w-96 border-l border-gray-200 hidden lg:block">
      <PreviewView page={page} />
    </div>
  );
}

export default ({ pageIdParam }: StoryEditorPageProps) => {
  const { story, pages } = useStoryAtoms();
  const [playtestOpen, setPlaytestOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  if (!story) return <LoadingSpinner />;

  return (
    <>
      <MainLayout
        storyTitle={story.title}
        pages={pages}
        startPage={story.start_page}
        onPlaytest={() => setPlaytestOpen(true)}
        onTogglePreview={() => setShowPreview((p) => !p)}
        showPreview={showPreview}
        hasPageSelected={!!pageIdParam}
      >
        {pageIdParam ? (
          <Suspense fallback={<LoadingSpinner />}>
            <div className={showPreview ? "flex h-full" : "h-full"}>
              <div className={showPreview ? "flex-1 overflow-auto" : "h-full"}>
                <PageCard pageId={pageIdParam} />
              </div>
              {showPreview && (
                <Suspense fallback={<LoadingSpinner />}>
                  <PreviewPanel pageId={pageIdParam} />
                </Suspense>
              )}
            </div>
          </Suspense>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Select a page to edit</p>
          </div>
        )}
      </MainLayout>

      {playtestOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <PlaytestView onClose={() => setPlaytestOpen(false)} />
        </Suspense>
      )}
    </>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/StoryEditorPage.tsx
git commit -m "feat: update editor page for project model — no story ID param"
```

---

## Task 6: Update Layout Components

**Files:**
- Modify: `src/components/layout/MainLayout.tsx`
- Modify: `src/components/layout/DesktopSidebar.tsx`
- Modify: `src/components/layout/TabletSidebar.tsx`
- Modify: `src/components/layout/MobileNav.tsx`
- Modify: `src/components/NewPageButton.tsx`
- Modify: `src/components/PageLink.tsx`

All layout components currently receive `storyId: number` in their props and pass it to sub-components. Since there's only one project open, `storyId` is no longer needed.

- [ ] **Step 1: Read all layout components**

Read each file to understand current props and usage.

- [ ] **Step 2: Update MainLayout**

Remove `storyId` from MainLayoutProps. Remove it from all child component passes. Page IDs in the `pages` prop are now strings.

Update MainLayoutProps:
```typescript
interface MainLayoutProps {
  storyTitle: string;
  pages: Array<{ id: string; name: string }>;
  startPage: string | null;
  onPlaytest?: () => void;
  onTogglePreview?: () => void;
  showPreview?: boolean;
  hasPageSelected?: boolean;
  children: ReactNode;
}
```

- [ ] **Step 3: Update DesktopSidebar**

Remove `storyId` from props. Update `pages` type to use string IDs. Update the start page change handler — it now needs to save the full story object:

```typescript
const handleStartPageChange = async (newStartPage: string) => {
  try {
    const currentStory = await api.getStory();
    await api.saveStory({ ...currentStory, start_page: newStartPage });
  } catch (error) {
    console.error("Failed to update start page:", error);
  }
};
```

Remove the `patchStory` call from `useStoryAtoms()` (it no longer exists). Use `api` directly for the start page change.

Update PageLink and NewPageButton passes to not include storyId.

Use `getLinkToPage(pageId)` from the new routing utilities for page links.

- [ ] **Step 4: Update TabletSidebar and MobileNav**

Same pattern: remove `storyId` from props, update ID types to string, update handlers.

- [ ] **Step 5: Update NewPageButton**

Read the current component. It likely calls `createPage(storyId)`. Update to call `createPage(name)` — the new API doesn't need a story ID.

- [ ] **Step 6: Update PageLink**

Read the current component. It likely generates links using `getLinkToPagePage(storyId, pageId)`. Update to `getLinkToPage(pageId)`.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/ src/components/NewPageButton.tsx src/components/PageLink.tsx
git commit -m "feat: update layout components for project model — string IDs, no storyId"
```

---

## Task 7: Rewrite PageCard (Major Refactor)

**Files:**
- Rewrite: `src/components/PageCard.tsx`

This is the biggest component change. The old PageCard uses granular operations (createChoice, deleteChoice, patchChoice, setFlagOperation, etc.). The new model: read the full Page, mutate locally, save the whole object.

- [ ] **Step 1: Read the current PageCard**

Read `src/components/PageCard.tsx` thoroughly to understand all functionality:
- Page title/body editing with autosave on blur
- Choice management (add, edit, delete, reorder target)
- Flag operations on choices and pages
- Choice conditions

- [ ] **Step 2: Rewrite PageCard**

Key changes:
- `pageId: string` instead of `number`
- Import types from `"../types"` not `"../bindings"`
- Use `useAtomValue(pageAtomFamily(pageId))` to load page
- Use `useSetAtom(savePageAtom)` for saves
- All mutations work on a local copy of the Page, then save:

Pattern for choice operations:
```typescript
const handleAddChoice = async () => {
  const updatedPage = {
    ...page,
    choices: [
      ...page.choices,
      {
        id: generateId(),
        text: "New choice",
        target: pages[0]?.id ?? "",
        flag_operations: [],
        conditions: [],
      },
    ],
  };
  await savePage(updatedPage);
};

const handleDeleteChoice = async (choiceId: string) => {
  const updatedPage = {
    ...page,
    choices: page.choices.filter((c) => c.id !== choiceId),
  };
  await savePage(updatedPage);
};
```

Pattern for saving page name/body (on blur):
```typescript
const handleSave = async () => {
  if (name !== page.name || body !== page.body) {
    await savePage({ ...page, name, body });
  }
};
```

The implementer should preserve the existing UI layout and just update the data flow.

- [ ] **Step 3: Commit**

```bash
git add src/components/PageCard.tsx
git commit -m "feat: rewrite PageCard for full-object save model"
```

---

## Task 8: Update Flag and Condition Components

**Files:**
- Modify: `src/components/ChoiceConditions.tsx`
- Modify: `src/components/FlagOperations.tsx`
- Modify: `src/components/FlagsDialog.tsx`

- [ ] **Step 1: Read and update ChoiceConditions.tsx**

Read the file. Change:
- Import from `"../types"` instead of `"../bindings"`
- All ID params/props from `number` to `string`
- Update the `Condition` type name (was `ChoiceCondition`)
- The component likely calls `setChoiceCondition`/`removeChoiceCondition` — these need to be replaced with callbacks from PageCard that mutate the page object

- [ ] **Step 2: Read and update FlagOperations.tsx**

Same pattern: update imports, string IDs, callback-based mutations.

- [ ] **Step 3: Read and update FlagsDialog.tsx**

Read the file. Changes:
- Import from `"../types"` instead of `"../bindings"`
- Remove `story_id` from flag creation (it's part of Story, not individual flags)
- Flag CRUD now works by:
  1. Get current story: `api.getStory()`
  2. Modify `story.flags` array
  3. Save: `api.saveStory(updatedStory)`
- Remove granular `createFlag`, `patchFlag`, `deleteFlag` calls
- Use `useStoryAtoms()` to get `saveStory` and `flags`

- [ ] **Step 4: Commit**

```bash
git add src/components/ChoiceConditions.tsx src/components/FlagOperations.tsx src/components/FlagsDialog.tsx
git commit -m "feat: update flag/condition components for full-object model"
```

---

## Task 9: Final Cleanup and Verification

- [ ] **Step 1: Search for remaining bindings.ts references**

```bash
grep -r "from.*bindings" creation-tool/src/ --include="*.ts" --include="*.tsx"
```

Fix any remaining imports.

- [ ] **Step 2: Search for remaining numeric ID patterns**

```bash
grep -rn "number.*id\|parseInt.*param\|: number" creation-tool/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test."
```

Fix any remaining numeric ID references.

- [ ] **Step 3: Run creation tool unit tests**

Run: `cd /Users/jnurminen/cyoa2/creation-tool && npx vitest run`

- [ ] **Step 4: Run player tests (no regression)**

Run: `cd /Users/jnurminen/cyoa2/player && npx vitest run && npx playwright test`

- [ ] **Step 5: Run Rust tests**

Run: `cd /Users/jnurminen/cyoa2 && cargo test`

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd /Users/jnurminen/cyoa2/creation-tool && npx tsc --noEmit`

Note: some pre-existing warnings from node_modules are expected.

- [ ] **Step 7: Commit any remaining fixes**

```bash
git add -A creation-tool/src/
git commit -m "fix: final cleanup for frontend migration"
```
