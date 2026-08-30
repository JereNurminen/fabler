import { test, expect } from "@playwright/test";
import {
  resetProject,
  createPageViaApi,
  listPagesViaApi,
  navigateToEditor,
  navigateToPage,
} from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetProject(request);
});

test.describe("Editor navigation", () => {
  test("shows editor with page list", async ({ page }) => {
    await navigateToEditor(page);
    // The test project has a default "Start" page
    await expect(page.getByText("Start")).toBeVisible({ timeout: 10000 });
  });

  test("can navigate to a page", async ({ page, request }) => {
    const pages = await listPagesViaApi(request);
    const firstPage = pages[0];
    await navigateToPage(page, firstPage.id);
    await expect(page.locator("#page-title-input")).toHaveValue("Start", { timeout: 10000 });
  });
});

test.describe("Page editing", () => {
  test("can edit page title", async ({ page, request }) => {
    const pages = await listPagesViaApi(request);
    await navigateToPage(page, pages[0].id);

    const titleInput = page.locator("#page-title-input");
    await titleInput.fill("Entrance Hall");
    await titleInput.blur();
    // Wait for save
    await page.waitForTimeout(500);

    // Verify it saved by reloading
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("#page-title-input")).toHaveValue("Entrance Hall", { timeout: 10000 });
  });

  test("can edit page body (markdown)", async ({ page, request }) => {
    const pages = await listPagesViaApi(request);
    await navigateToPage(page, pages[0].id);

    const editor = page.locator("textarea");
    await editor.fill("# Hello World\n\nThis is **bold** text.");
    await editor.blur();
    await page.waitForTimeout(500);

    // Verify markdown preview shows rendered content
    await expect(page.locator(".prose")).toContainText("Hello World");
  });
});

test.describe("Page management", () => {
  test("can create a new page", async ({ page, request }) => {
    await navigateToEditor(page);

    // Find and click the new page button in the sidebar
    const newPageButton = page.getByRole("button", { name: /new page|create page/i });
    await newPageButton.click();
    await page.waitForTimeout(500);

    // Should have navigated to the new page
    // Verify page list now has 2 pages
    const pages = await listPagesViaApi(request);
    expect(pages.length).toBe(2);
  });
});

test.describe("Choice management", () => {
  test("can add a choice", async ({ page, request }) => {
    // Create a second page to link to
    await createPageViaApi(request, "Second Page");
    const pages = await listPagesViaApi(request);
    const firstPage = pages.find((p) => p.name === "Start");
    // Narrowing here also turns a missing fixture page into a legible failure
    // rather than "cannot read property 'id' of undefined".
    if (!firstPage) {
      throw new Error(
        `expected a "Start" page, got: ${pages.map((p) => p.name).join(", ")}`,
      );
    }

    await navigateToPage(page, firstPage.id);

    // Click add choice button
    const addChoiceButton = page.getByRole("button", { name: /add choice/i });
    await addChoiceButton.click();
    await page.waitForTimeout(500);

    // Verify a choice appeared (has a target page select)
    await expect(page.locator("[id^='choice-target-']")).toBeVisible();
  });

  test("can create page from choice target dropdown", async ({ page, request }) => {
    const pages = await listPagesViaApi(request);
    await navigateToPage(page, pages[0].id);

    // Add a choice first
    await page.getByRole("button", { name: /add choice/i }).click();
    await page.waitForTimeout(500);

    // Find the target select and pick "Create Page"
    const targetSelect = page.locator("select").last();
    await targetSelect.selectOption("__create_new__");

    // Should show inline create form
    const nameInput = page.locator("input[placeholder]").last();
    await nameInput.fill("New Destination");

    // Click create button
    const createBtn = page.getByRole("button", { name: /^create$/i }).last();
    await createBtn.click();
    await page.waitForTimeout(500);

    // Verify the page was created
    const updatedPages = await listPagesViaApi(request);
    expect(updatedPages.length).toBe(2);
    expect(updatedPages.some((p) => p.name === "New Destination")).toBe(true);
  });
});
