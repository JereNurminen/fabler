import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { atom, Provider } from "jotai";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { PageListItem, Story } from "@fabler/types";
import StoryEditorPage from "../StoryEditorPage";
import { useEditorChrome } from "../../components/layout/EditorChromeContext";
import { useTrashPage } from "../../components/TrashPageContext";

/**
 * This file covers two things about `StoryEditorPage`, both of which are
 * about wiring rather than rendering.
 *
 * 1. `TrashPageProvider` moving back inside `MainLayout` (or otherwise no
 *    longer wrapping `StoryGraphView`). That change would keep `tsc` and
 *    every other test green and only break at runtime, the moment a user
 *    right-clicks a story-map node and the map's context menu tries
 *    `useTrashPage()`.
 * 2. The guard that keeps a routed id which no longer exists — the page was
 *    purged from the trash — from ever reaching `PageCard`.
 *
 * `useStoryAtoms` is mocked to skip the app's real (Suspense-driven) data
 * loading, and `MainLayout`/`StoryGraphView` are replaced with minimal
 * stand-ins -- neither the real sidebar chrome nor xyflow/dagre are what
 * this test is about. What is real and unmocked: `StoryEditorPage`'s own
 * JSX nesting, `TrashPageProvider`, and `useTrashPage`. The stand-in for
 * `StoryGraphView` calls the real `useTrashPage()` when it mounts, which
 * only succeeds if it is actually rendered inside `TrashPageProvider` in
 * the live React tree -- context lookup follows the real component tree,
 * not the module graph, so this is not fooled by the mocking.
 */

const testStory = (): Story => ({
  id: "s1",
  format_version: 1,
  title: "Test story",
  start_page: "a1b2c",
  flags: [],
});

let story: Story | null = testStory();
let livePages: PageListItem[] = [];
let trashedPages: PageListItem[] = [];

vi.mock("../../atoms/useStoryAtoms", () => ({
  useStoryAtoms: () => ({ story }),
}));

// `StoryEditorPage` reads `pageListAtom`/`trashedPageListAtom` directly to
// decide whether the routed page is live, in the trash, or gone entirely.
// Both are async in production and would suspend with no boundary here;
// synchronous stand-ins reading module-level `let`s let each test set up its
// own story shape. `pageAtomFamily` is only reached by `PreviewPanel`, which
// never mounts in these tests.
vi.mock("../../atoms/storyAtoms", () => ({
  pageListAtom: atom(() => livePages),
  trashedPageListAtom: atom(() => trashedPages),
  pageAtomFamily: () => atom(() => null),
}));

vi.mock("../../components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children?: React.ReactNode }) => {
    const { onOpenGraph } = useEditorChrome();
    return (
      <>
        <button onClick={onOpenGraph}>open-graph</button>
        {children}
      </>
    );
  },
}));

vi.mock("../../graph/StoryGraphView", () => ({
  StoryGraphView: () => {
    // Throws if this component is not a descendant of TrashPageProvider.
    useTrashPage();
    return <div data-testid="graph-inside-provider" />;
  },
}));

// Stand-ins: these tests are about WHICH view the route mounts, not about
// what either one renders. Both real components read page data from atoms
// this file does not provide.
vi.mock("../../components/PageCard", () => ({
  default: ({ pageId }: { pageId: string }) => (
    <div data-testid="page-card">{pageId}</div>
  ),
}));

vi.mock("../../components/TrashedPageView", () => ({
  TrashedPageView: ({ pageId }: { pageId: string }) => (
    <div data-testid="trashed-page-view">{pageId}</div>
  ),
}));

beforeEach(() => {
  story = testStory();
  livePages = [];
  trashedPages = [];
});

describe("StoryEditorPage provider placement", () => {
  it("keeps the story map inside TrashPageProvider so useTrashPage resolves there", async () => {
    render(<StoryEditorPage />);

    await userEvent.click(screen.getByText("open-graph"));

    expect(screen.getByTestId("graph-inside-provider")).toBeTruthy();
  });
});

/**
 * Renders at a route, with a recording in-memory location so the redirect is
 * observable without touching jsdom's history, and its own jotai store —
 * the mocked list atoms close over module-level `let`s that change between
 * tests, and the shared default store would cache the first test's value.
 */
function renderAt(pageId: string) {
  const { hook, history } = memoryLocation({
    path: `/editor/page/${pageId}`,
    record: true,
  });
  const result = render(
    <Provider>
      <Router hook={hook}>
        <StoryEditorPage pageIdParam={pageId} />
      </Router>
    </Provider>,
  );
  return { ...result, history };
}

describe("StoryEditorPage routing guard", () => {
  it("mounts PageCard for a page that is live", () => {
    livePages = [{ id: "a1b2c", name: "Entrance" }];
    renderAt("a1b2c");

    expect(screen.getByTestId("page-card").textContent).toBe("a1b2c");
  });

  it("mounts the read-only view for a page that is in the trash", () => {
    livePages = [{ id: "a1b2c", name: "Entrance" }];
    trashedPages = [{ id: "b7c1d", name: "Dark Tunnel" }];
    renderAt("b7c1d");

    expect(screen.getByTestId("trashed-page-view").textContent).toBe("b7c1d");
    expect(screen.queryByTestId("page-card")).toBeNull();
  });

  /**
   * The regression this exists for: purging the page currently being routed
   * to. `PageCard` would call `get_page`, the backend would answer
   * `PageNotFound`, the async atom would reject, `useAtomValue` would throw,
   * and the app-level `ErrorBoundary` -- which wraps the entire router and
   * never clears `hasError` -- would replace the whole editor with an error
   * screen until restart. So the routed page must never be mounted at all
   * once it exists in neither list.
   */
  it("never mounts PageCard for a purged page, and redirects to the start page", async () => {
    livePages = [{ id: "a1b2c", name: "Entrance" }];
    trashedPages = [];
    const { history } = renderAt("b7c1d");

    expect(screen.queryByTestId("page-card")).toBeNull();
    expect(screen.queryByTestId("trashed-page-view")).toBeNull();
    await waitFor(() =>
      expect(history[history.length - 1]).toBe("/editor/page/a1b2c"),
    );
  });

  it("redirects to the editor root when the start page was purged too", async () => {
    // Deleting the start page is a supported flow, so the redirect target
    // can itself be gone -- the bug this replaces sent the author straight
    // back to the page they had just destroyed.
    livePages = [];
    trashedPages = [];
    const { history } = renderAt("a1b2c");

    expect(screen.queryByTestId("page-card")).toBeNull();
    await waitFor(() => expect(history[history.length - 1]).toBe("/editor"));
  });

  it("redirects to the editor root when the start page is itself only in the trash", async () => {
    livePages = [];
    trashedPages = [{ id: "a1b2c", name: "Entrance" }];
    const { history } = renderAt("b7c1d");

    await waitFor(() => expect(history[history.length - 1]).toBe("/editor"));
  });

  it("does not redirect while a live page is being viewed", async () => {
    livePages = [{ id: "a1b2c", name: "Entrance" }];
    const { history } = renderAt("a1b2c");

    await waitFor(() => expect(screen.getByTestId("page-card")).toBeTruthy());
    expect(history).toEqual(["/editor/page/a1b2c"]);
  });
});
