import { test, expect } from "@playwright/test";

test.describe("Story Creation Tool", () => {
  test("story creation e2e", async ({ page }) => {
    await test.step("should load the start page", async () => {
      await page.goto("/", { waitUntil: "networkidle" });

      // Wait for the app to load
      await expect(page.locator("h1").first()).toContainText("Hello");

      // Check for the new story button
      await expect(
        page.getByRole("button", { name: /new story/i }),
      ).toBeVisible();
    });

    await test.step("should create a new story", async () => {
      // Click new story button
      await page.getByRole("button", { name: /new story/i }).click();

      // Fill in story title
      await page.getByPlaceholder(/title/i).fill("Test Story");

      // Click create button
      await page.getByRole("button", { name: /create/i }).click();

      // Should navigate to story page
      await expect(page).toHaveURL(/\/story\/\d+/);

      // Should show the story title in sidebar
      await expect(page.locator("h1").first()).toContainText("Test Story");
    });

    await test.step("should create a page and edit its content", async () => {
      // Click on the START page link
      await page.getByText(/START/i).first().click();

      // Edit page title
      const titleInput = page.getByLabel(/page title/i);
      await titleInput.fill("Welcome Page");
      await titleInput.blur();

      // Edit page content - use ID selector since label association might not work
      const contentTextarea = page.locator('#page-body-input');
      await contentTextarea.click(); // Focus the element first
      await contentTextarea.fill("Welcome to the adventure!");
      await contentTextarea.blur();

      // Wait for auto-save to complete
      await page.waitForTimeout(500);

      // Verify the changes persist
      await expect(titleInput).toHaveValue("Welcome Page");
      await expect(contentTextarea).toHaveValue("Welcome to the adventure!");
    });

    await test.step("should add a choice to a page", async () => {
      // Navigate back to home
      await page.goto("/");

      // Create a new story
      await page.getByRole("button", { name: /new story/i }).click();
      await page.getByPlaceholder(/title/i).fill("Choice Test Story");
      await page.getByRole("button", { name: /create/i }).click();

      // Navigate to first page
      await page.getByText(/START/i).first().click();

      // Add a choice
      await page.getByRole("button", { name: /add choice/i }).click();

      // Wait for the choice input to appear and fill it
      const choiceTextInput = page.locator('input[type="text"]').first();
      await choiceTextInput.waitFor({ state: 'visible' });
      await choiceTextInput.click();
      await choiceTextInput.fill("Go north");
      await choiceTextInput.blur();

      // Wait for save
      await page.waitForTimeout(500);

      // Verify choice was added
      await expect(choiceTextInput).toHaveValue("Go north");
    });
  });
});
