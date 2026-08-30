import { test, expect } from "@playwright/test";
import type { APIRequestContext, Locator } from "@playwright/test";
import {
  resetProject,
  createPageViaApi,
  getPageViaApi,
  savePageViaApi,
  listPagesViaApi,
  navigateToEditor,
} from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetProject(request);
});

/** Point the start page's first choice at a page id that does not exist. */
async function linkStartTo(request: APIRequestContext, target: string) {
  const pages = await listPagesViaApi(request);
  const start = await getPageViaApi(request, pages[0].id);
  start.choices.push({
    id: "clink",
    text: "Go",
    target,
    flag_operations: [],
    conditions: [],
  });
  await savePageViaApi(request, start);
  return start;
}

/**
 * React Flow's flow-space position for a node locator, read straight off its
 * inline `transform: translate(Xpx, Ypx)` style rather than its on-screen
 * bounding box — see the drag-persistence test below for why that
 * distinction matters.
 */
async function flowPosition(node: Locator): Promise<{ x: number; y: number }> {
  const style = await node.getAttribute("style");
  const match = style?.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
  if (!match) {
    throw new Error(`could not parse node transform from style: ${style ?? "(none)"}`);
  }
  return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
}

test.describe("Story map", () => {
  test("renders a node per page, labelled with its page name", async ({ page, request }) => {
    await createPageViaApi(request, "Second");
    await navigateToEditor(page);

    await page.getByRole("button", { name: /story map/i }).click();

    const map = page.getByTestId("story-graph");
    await expect(map).toBeVisible();
    await expect(map.locator(".story-node")).toHaveCount(2);
    // Assert the actual seeded page names appear, not just a count — a
    // count alone would still pass if every node were blank or mislabelled.
    await expect(map.getByText("Start")).toBeVisible();
    await expect(map.getByText("Second")).toBeVisible();
  });

  test("clicking a node opens that page and closes the map", async ({ page, request }) => {
    const second = await createPageViaApi(request, "Second");
    await navigateToEditor(page);

    await page.getByRole("button", { name: /story map/i }).click();
    await page.getByTestId("story-graph").getByText("Second").click();

    await expect(page).toHaveURL(new RegExp(`/editor/page/${second.id}$`));
    await expect(page.getByTestId("story-graph")).toHaveCount(0);
  });

  test("a choice leading nowhere renders as a dangling stub, not a real node", async ({
    page,
    request,
  }) => {
    // This is the whole point of the map: showing the author structure that
    // is wrong. A choice targeting "gone9" (no such page exists) must render
    // as a visually distinct stub, not silently vanish or look like a real page.
    await linkStartTo(request, "gone9");
    await navigateToEditor(page);

    await page.getByRole("button", { name: /story map/i }).click();

    const map = page.getByTestId("story-graph");
    await expect(map).toBeVisible();

    // Exactly one real page node ("Start") plus exactly one missing-target
    // stub — not two real-looking nodes, and not zero (the choice silently
    // dropped).
    await expect(map.locator(".story-node")).toHaveCount(2);
    const stub = map.locator(".story-node--missing");
    await expect(stub).toHaveCount(1);
    // The stub — not the Start node — is the one carrying the "leads
    // nowhere" label, proving the missing-target styling landed on the
    // right element rather than merely existing somewhere on the page.
    await expect(stub).toContainText("leads nowhere");
    await expect(map.locator(".story-node").filter({ hasText: "Start" })).not.toHaveClass(
      /story-node--missing/,
    );
  });

  test("closing the map returns to the editor", async ({ page }) => {
    await navigateToEditor(page);
    await page.getByRole("button", { name: /story map/i }).click();
    await expect(page.getByTestId("story-graph")).toBeVisible();

    await page.getByRole("button", { name: /close map/i }).click();
    await expect(page.getByTestId("story-graph")).toHaveCount(0);
  });

  test("dragging a node persists its position across closing and reopening the map", async ({
    page,
    request,
  }) => {
    await createPageViaApi(request, "Second");
    const pages = await listPagesViaApi(request);
    const startId = pages[0].id;

    await navigateToEditor(page);
    await page.getByRole("button", { name: /story map/i }).click();

    // React Flow stamps a `data-testid="rf__node-<id>"` on each node's own
    // DOM wrapper (confirmed by reading @xyflow/react's source rather than
    // guessing) and positions it via an inline `transform: translate(Xpx,
    // Ypx)`. Read that transform directly instead of `boundingBox()`:
    // `boundingBox()` reports the on-screen (zoomed/panned) rect, and
    // fitView is free to pick a different zoom on the reopened mount than it
    // did originally (the dragged node enlarges the graph's bounding box),
    // which makes screen-pixel comparisons flaky. The inline transform is
    // React Flow's internal flow-space coordinate — the same number that
    // gets written to `editor.position` — and is unaffected by zoom.
    const startNode = page.locator(`[data-testid="rf__node-${startId}"]`);
    await expect(startNode).toBeVisible();

    const before = await flowPosition(startNode);
    const beforeBox = await startNode.boundingBox();
    if (!beforeBox) throw new Error("story node has no bounding box before drag");

    await page.mouse.move(beforeBox.x + beforeBox.width / 2, beforeBox.y + beforeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      beforeBox.x + beforeBox.width / 2 + 260,
      beforeBox.y + beforeBox.height / 2 + 200,
      { steps: 12 },
    );
    await page.mouse.up();

    // usePositionPersistence debounces the write by 500ms.
    await page.waitForTimeout(900);

    const afterDrag = await flowPosition(startNode);
    // Confirm the drag actually moved the node before relying on it for the
    // persistence assertion below.
    expect(Math.abs(afterDrag.x - before.x) + Math.abs(afterDrag.y - before.y)).toBeGreaterThan(
      50,
    );

    const savedPage = await getPageViaApi(request, startId);
    expect(savedPage.editor?.position?.x).toBeCloseTo(afterDrag.x, 0);
    expect(savedPage.editor?.position?.y).toBeCloseTo(afterDrag.y, 0);

    // The map fetches fresh from the backend on every open — close it and
    // reopen rather than relying on any client-side cache.
    await page.getByRole("button", { name: /close map/i }).click();
    await page.getByRole("button", { name: /story map/i }).click();

    const reopenedNode = page.locator(`[data-testid="rf__node-${startId}"]`);
    await expect(reopenedNode).toBeVisible();
    const afterReopen = await flowPosition(reopenedNode);

    // The dragged node should land back exactly where the drag left it, not
    // back at its original pre-drag auto-layout position.
    expect(afterReopen.x).toBeCloseTo(afterDrag.x, 0);
    expect(afterReopen.y).toBeCloseTo(afterDrag.y, 0);
  });
});
