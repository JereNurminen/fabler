import { test, expect } from "@playwright/test";
import {
  resetProject,
  createPageViaApi,
  savePageViaApi,
  listPagesViaApi,
  navigateToEditor,
  getPageViaApi,
} from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetProject(request);
});

test.describe("Playtest", () => {
  test("opens playtest and shows start page content", async ({ page, request }) => {
    // Set up a page with some content
    const pages = await listPagesViaApi(request);
    const startPage = await getPageViaApi(request, pages[0].id);
    startPage.body = {
      content: [{ type: "markdown", source: "You are in a dark room." }],
    };
    await savePageViaApi(request, startPage);

    await navigateToEditor(page);

    // Click playtest button
    await page.getByRole("button", { name: /playtest/i }).click();

    // Verify playtest mode header
    await expect(page.getByText("Playtest Mode")).toBeVisible({ timeout: 10000 });

    // Verify page content is shown
    await expect(page.locator("article")).toContainText("dark room", { timeout: 10000 });
  });

  test("can navigate through choices in playtest", async ({ page, request }) => {
    // Create two pages with a choice linking them
    const pages = await listPagesViaApi(request);
    const secondPage = await createPageViaApi(request, "Second Room");

    // Update first page with a choice
    const startPage = await getPageViaApi(request, pages[0].id);
    startPage.body = {
      content: [{ type: "markdown", source: "You see a door." }],
    };
    startPage.choices = [
      {
        id: "c1111",
        text: "Open the door",
        target: secondPage.id,
        flag_operations: [],
        conditions: [],
      },
    ];
    await savePageViaApi(request, startPage);

    // Update second page
    const sp = await getPageViaApi(request, secondPage.id);
    sp.body = {
      content: [{ type: "markdown", source: "You entered the second room." }],
    };
    await savePageViaApi(request, sp);

    await navigateToEditor(page);
    await page.getByRole("button", { name: /playtest/i }).click();
    await expect(page.getByText("Playtest Mode")).toBeVisible({ timeout: 10000 });

    // Click the choice
    await page.getByRole("button", { name: "Open the door" }).click();

    // Verify navigation to second page
    await expect(page.locator("article")).toContainText("second room", { timeout: 10000 });
  });

  test("closes playtest and returns to editor", async ({ page }) => {
    await navigateToEditor(page);
    await page.getByRole("button", { name: /playtest/i }).click();
    await expect(page.getByText("Playtest Mode")).toBeVisible({ timeout: 10000 });

    // Close
    await page.getByRole("button", { name: /close playtest/i }).click();
    await expect(page.getByText("Playtest Mode")).not.toBeVisible();
  });
});
