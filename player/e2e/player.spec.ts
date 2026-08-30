import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Player — branching story", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?fixture=branching");
    await page.waitForSelector("article");
  });

  test("renders the start page", async ({ page }) => {
    await expect(page.locator("article h1")).toHaveText("Entrance");
    await expect(page.locator("article")).toContainText("fork in the road");
  });

  test("displays available choices", async ({ page }) => {
    const choices = page.locator("nav[aria-label='Story choices'] button");
    await expect(choices).toHaveCount(2);
    await expect(choices.nth(0)).toHaveText("Take the left path");
    await expect(choices.nth(1)).toHaveText("Take the right path");
  });

  test("navigates to a new page on choice", async ({ page }) => {
    await page.click("text=Take the left path");
    await expect(page.locator("article h1")).toHaveText("Deep Forest");
  });

  test("can navigate back", async ({ page }) => {
    await page.click("text=Take the left path");
    await page.click("text=Turn back to the fork");
    await expect(page.locator("article h1")).toHaveText("Entrance");
  });

  test("shows The End on terminal pages", async ({ page }) => {
    await page.click("text=Take the left path");
    await page.click("text=Press deeper into the forest");
    await expect(page.locator("article h1")).toHaveText("Sunlit Clearing");
    await expect(page.locator("text=The End")).toBeVisible();
  });

  test("passes accessibility audit", async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("Player — flags story", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?fixture=flags");
    await page.waitForSelector("article");
  });

  test("shows conditional choices based on flags", async ({ page }) => {
    await expect(page.locator("text=Try the door")).toBeVisible();
    await expect(page.locator("text=Open the door")).not.toBeVisible();
  });

  test("flag operations change available choices", async ({ page }) => {
    await page.click("text=Search the table");
    await expect(page.locator("article h1")).toHaveText("The Table");
    await page.click("text=Go back to the room");
    await page.click("text=Try the door");
    await expect(page.locator("text=Use the key")).toBeVisible();
  });

  test("complete puzzle playthrough", async ({ page }) => {
    await page.click("text=Search the table");
    await page.click("text=Go back to the room");
    await page.click("text=Try the door");
    await page.click("text=Use the key");
    await expect(page.locator("text=Open the door")).toBeVisible();
    await page.click("text=Open the door");
    await expect(page.locator("article h1")).toHaveText("Freedom");
  });

  test("passes accessibility audit", async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("Player — save/load", () => {
  test("can save and load game state", async ({ page }) => {
    await page.goto("/?fixture=flags");
    await page.waitForSelector("article");

    await page.click("text=Search the table");
    await expect(page.locator("article h1")).toHaveText("The Table");

    await page.click("button[aria-label='Save and load']");
    await expect(page.locator("text=Save / Load")).toBeVisible();

    await page.fill("input[placeholder='Save name (optional)']", "My Save");
    await page.click("button:has-text('Save')");
    await expect(page.locator("text=My Save")).toBeVisible();

    await page.click("button[aria-label='Close save menu']");
    await page.click("text=Go back to the room");
    await expect(page.locator("article h1")).toHaveText("The Room");

    await page.click("button[aria-label='Save and load']");
    await page.click("button:has-text('Load')");
    await expect(page.locator("article h1")).toHaveText("The Table");
  });
});

test.describe("Player — settings", () => {
  test("can change font size", async ({ page }) => {
    await page.goto("/?fixture=minimal");
    await page.waitForSelector("article");

    await page.click("button[aria-label='Settings']");
    await page.click("button:has-text('Large')");
    await page.click("button[aria-label='Close settings']");

    const root = page.locator("[data-font-size='large']");
    await expect(root).toBeVisible();
  });

  test("can change theme", async ({ page }) => {
    await page.goto("/?fixture=minimal");
    await page.waitForSelector("article");

    await page.click("button[aria-label='Settings']");
    await page.click("button:has-text('Dark')");
    await page.click("button[aria-label='Close settings']");

    const root = page.locator("[data-theme='dark']");
    await expect(root).toBeVisible();
  });
});

test.describe("Player — dangling choice target", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?fixture=broken-target");
    await page.waitForSelector("article");
  });

  test("stays on the page and explains when a choice target is missing", async ({
    page,
  }) => {
    // Regression: the player used to navigate to the missing page id and
    // render a "page not found" screen with no choices, ending the story.
    await page.click("text=Take the broken path");

    await expect(page.locator("article h1")).toHaveText("The Fork");
    await expect(page.getByRole("alert")).toContainText("no longer exists");
    await expect(page.locator("body")).not.toContainText("Page not found");
  });

  test("the reader can still continue via another choice", async ({ page }) => {
    await page.click("text=Take the broken path");
    await expect(page.getByRole("alert")).toBeVisible();

    await page.click("text=Take the intact path");
    await expect(page.locator("article h1")).toHaveText("Safe Ground");
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("passes accessibility audit while showing the warning", async ({
    page,
  }) => {
    await page.click("text=Take the broken path");
    await expect(page.getByRole("alert")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
