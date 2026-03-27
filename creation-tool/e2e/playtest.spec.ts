import { test, expect } from "@playwright/test";
import { importStoryViaApi, navigateToStory } from "./helpers";

test.describe("Playtest", () => {
  let storyId: number;

  test.beforeEach(async ({ request }) => {
    storyId = await importStoryViaApi(request);
  });

  test("opens playtest from sidebar and shows start page", async ({ page }) => {
    await navigateToStory(page, storyId);

    // Click playtest button
    await page.getByRole("button", { name: /playtest/i }).click();

    // Verify playtest mode header is visible
    await expect(page.getByText("Playtest Mode")).toBeVisible();

    // Verify the story content is rendered (the start page)
    // The player renders page names as h1
    await expect(page.locator("article h1")).toBeVisible({ timeout: 10000 });
  });

  test("can navigate through story in playtest", async ({ page }) => {
    await navigateToStory(page, storyId);
    await page.getByRole("button", { name: /playtest/i }).click();

    // Wait for player to load
    await expect(page.locator("article")).toBeVisible({ timeout: 10000 });

    // Should see choices as buttons in the nav
    const choices = page.locator("nav[aria-label='Story choices'] button");
    await expect(choices.first()).toBeVisible({ timeout: 5000 });

    // Click a choice and verify navigation
    await choices.first().click();

    // Should now be on a different page (article content changed)
    await expect(page.locator("article")).toBeVisible();
  });

  test("closes playtest and returns to editor", async ({ page }) => {
    await navigateToStory(page, storyId);
    await page.getByRole("button", { name: /playtest/i }).click();

    // Verify playtest is open
    await expect(page.getByText("Playtest Mode")).toBeVisible({ timeout: 10000 });

    // Close it
    await page.getByRole("button", { name: /close playtest/i }).click();

    // Verify editor is visible again (sidebar with story title)
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "The Dark Cave",
    );
  });
});
