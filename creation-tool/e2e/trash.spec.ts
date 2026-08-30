import { test, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import {
  resetProject,
  createPageViaApi,
  getPageViaApi,
  savePageViaApi,
  listPagesViaApi,
  listTrashedPagesViaApi,
  trashPageViaApi,
  navigateToEditor,
  navigateToPage,
} from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetProject(request);
});

/** A page the start page leads to, so deleting it strands a real choice. */
async function seedLinkedPage(request: APIRequestContext) {
  const target = await createPageViaApi(request, "Dark Tunnel");
  const pages = await listPagesViaApi(request);
  const startId = pages.find((p) => p.id !== target.id)!.id;
  const start = await getPageViaApi(request, startId);
  start.choices.push({
    id: "c1a2b",
    text: "Go north",
    target: target.id,
    flag_operations: [],
    conditions: [],
  });
  await savePageViaApi(request, start);
  return { target, startId };
}

test.describe("Deleting a page", () => {
  test("right-clicking a sidebar page warns about the choices it would strand", async ({
    page,
    request,
  }) => {
    await seedLinkedPage(request);
    await navigateToEditor(page);

    await page.getByRole("link", { name: /Dark Tunnel/ }).click({ button: "right" });
    await page.getByRole("menuitem", { name: /delete page/i }).click();

    const dialog = page.getByTestId("confirm-trash-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("trash-stranded-choice")).toHaveText(/Go north/);
  });

  test("confirming moves the page to the trash and reports the broken choice", async ({
    page,
    request,
  }) => {
    const { target } = await seedLinkedPage(request);
    await navigateToEditor(page);

    await page.getByRole("link", { name: /Dark Tunnel/ }).click({ button: "right" });
    await page.getByRole("menuitem", { name: /delete page/i }).click();
    await page.getByRole("button", { name: /move to trash/i }).click();

    await expect(page.getByTestId("trash-section")).toContainText("Dark Tunnel");
    await expect
      .poll(async () => (await listTrashedPagesViaApi(request)).map((p) => p.id))
      .toEqual([target.id]);

    await page.getByRole("button", { name: /problems/i }).click();
    await expect(page.getByText(/which is in the trash/i)).toBeVisible();
  });

  test("deleting the start page warns that the story loses its entry point", async ({
    page,
    request,
  }) => {
    const { startId } = await seedLinkedPage(request);
    await navigateToPage(page, startId);

    await page.getByTestId("delete-page-button").click();

    await expect(page.getByTestId("trash-start-page-warning")).toBeVisible();
  });

  test("a trashed page opens read-only", async ({ page, request }) => {
    const { target } = await seedLinkedPage(request);
    await trashPageViaApi(request, target.id);
    await navigateToPage(page, target.id);

    await expect(page.getByTestId("trashed-page-banner")).toBeVisible();
    await expect(page.locator("main textarea")).toHaveCount(0);
    await expect(page.locator("main input")).toHaveCount(0);
  });

  test("restoring brings the page back and clears the problem", async ({ page, request }) => {
    const { target } = await seedLinkedPage(request);
    await trashPageViaApi(request, target.id);
    await navigateToEditor(page);

    await page.getByTestId("trash-entry").click({ button: "right" });
    await page.getByRole("menuitem", { name: /restore/i }).click();

    await expect(page.getByTestId("trash-section")).toHaveCount(0);
    await expect
      .poll(async () => (await listTrashedPagesViaApi(request)).length)
      .toBe(0);

    await page.getByRole("button", { name: /problems/i }).click();
    await expect(page.getByTestId("problems-empty")).toBeVisible();
  });

  test("permanent deletion warns that restoring will no longer fix the choice", async ({
    page,
    request,
  }) => {
    const { target } = await seedLinkedPage(request);
    await trashPageViaApi(request, target.id);
    await navigateToEditor(page);

    await page.getByTestId("trash-entry").click({ button: "right" });
    await page.getByRole("menuitem", { name: /delete permanently/i }).click();

    await expect(page.getByTestId("purge-downgrade-warning")).toBeVisible();

    await page.getByRole("button", { name: /delete permanently/i }).last().click();
    await expect
      .poll(async () => (await listTrashedPagesViaApi(request)).length)
      .toBe(0);
  });

  /**
   * Purging the page currently on screen used to leave the editor on a dead
   * route: `PageCard` mounted for an id the backend no longer had, the async
   * atom rejected, and the app-level `ErrorBoundary` -- which wraps the whole
   * router and never resets -- replaced the editor with an error screen until
   * restart.
   */
  test("purging the page being viewed lands somewhere usable instead of an error screen", async ({
    page,
    request,
  }) => {
    const { target, startId } = await seedLinkedPage(request);
    await trashPageViaApi(request, target.id);
    await navigateToPage(page, target.id);

    await expect(page.getByTestId("trashed-page-banner")).toBeVisible();
    await page.getByRole("button", { name: /delete permanently/i }).first().click();
    await page.getByTestId("confirm-purge-dialog").waitFor();
    await page.getByRole("button", { name: /^delete permanently$/i }).last().click();

    await expect(page).toHaveURL(new RegExp(`/editor/page/${startId}$`));
    await expect(page.getByTestId("delete-page-button")).toBeVisible();
    await expect(page.getByText(/^Error:/)).toHaveCount(0);
  });

  test("emptying the trash while viewing a trashed page leaves the editor usable", async ({
    page,
    request,
  }) => {
    const { target, startId } = await seedLinkedPage(request);
    await trashPageViaApi(request, target.id);
    await navigateToPage(page, target.id);

    await expect(page.getByTestId("trashed-page-banner")).toBeVisible();
    await page.getByRole("button", { name: /empty trash/i }).click();
    await page.getByTestId("confirm-purge-dialog").waitFor();
    await page.getByRole("button", { name: /^delete permanently$/i }).last().click();

    await expect(page).toHaveURL(new RegExp(`/editor/page/${startId}$`));
    await expect(page.getByText(/^Error:/)).toHaveCount(0);
  });

  test("trashing a node from the story map removes it from the canvas", async ({
    page,
    request,
  }) => {
    await seedLinkedPage(request);
    await navigateToEditor(page);
    await page.getByRole("button", { name: /story map/i }).click();
    await expect(page.getByTestId("story-graph")).toBeVisible();

    const node = page.locator(".story-node", { hasText: "Dark Tunnel" });
    await node.click({ button: "right" });
    await page.getByRole("menuitem", { name: /delete page/i }).click();
    await page.getByRole("button", { name: /move to trash/i }).click();

    // The map used to keep showing the deleted node: right-clicking it again
    // opened a confirmation with an empty page name, and confirming failed
    // with PageNotFound.
    await expect(node).toHaveCount(0);
  });

  test("right-clicking a node in the story map offers the same confirmation", async ({
    page,
    request,
  }) => {
    await seedLinkedPage(request);
    await navigateToEditor(page);
    await page.getByRole("button", { name: /story map/i }).click();
    await expect(page.getByTestId("story-graph")).toBeVisible();

    await page.locator(".story-node", { hasText: "Dark Tunnel" }).click({ button: "right" });
    await page.getByRole("menuitem", { name: /delete page/i }).click();

    await expect(page.getByTestId("confirm-trash-dialog")).toBeVisible();
  });
});
