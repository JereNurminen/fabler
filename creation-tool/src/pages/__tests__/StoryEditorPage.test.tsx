import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StoryEditorPage from "../StoryEditorPage";
import { useEditorChrome } from "../../components/layout/EditorChromeContext";
import { useTrashPage } from "../../components/TrashPageContext";

/**
 * This test exists to catch one specific regression: `TrashPageProvider`
 * moving back inside `MainLayout` (or otherwise no longer wrapping
 * `StoryGraphView`). That change would keep `tsc` and every other test
 * green and only break at runtime, the moment a user right-clicks a
 * story-map node and the map's context menu tries `useTrashPage()`.
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

vi.mock("../../atoms/useStoryAtoms", () => ({
  useStoryAtoms: () => ({ story: { id: "s1", title: "Test story" } }),
}));

vi.mock("../../components/layout/MainLayout", () => ({
  MainLayout: () => {
    const { onOpenGraph } = useEditorChrome();
    return <button onClick={onOpenGraph}>open-graph</button>;
  },
}));

vi.mock("../../graph/StoryGraphView", () => ({
  StoryGraphView: () => {
    // Throws if this component is not a descendant of TrashPageProvider.
    useTrashPage();
    return <div data-testid="graph-inside-provider" />;
  },
}));

describe("StoryEditorPage provider placement", () => {
  it("keeps the story map inside TrashPageProvider so useTrashPage resolves there", async () => {
    render(<StoryEditorPage />);

    await userEvent.click(screen.getByText("open-graph"));

    expect(screen.getByTestId("graph-inside-provider")).toBeTruthy();
  });
});
