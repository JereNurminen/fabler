import { test, expect } from "@playwright/test";
import { importStoryViaApi, navigateToStory, navigateToPage } from "./helpers";

const API_BASE = "http://127.0.0.1:3001/api";

/**
 * Normalize auto-generated IDs in TOML export so snapshots are stable
 * across test runs regardless of existing DB state.
 */
function normalizeTomlIds(toml: string): string {
  let nextId = 1;
  const idMap = new Map<number, number>();

  const getId = (actual: number): number => {
    if (!idMap.has(actual)) {
      idMap.set(actual, nextId++);
    }
    return idMap.get(actual)!;
  };

  return toml.replace(
    /((?:id|flag_id|target_page|start_page|page_id|story_id)\s*=\s*)(\d+)/g,
    (_match, prefix, numStr) => `${prefix}${getId(parseInt(numStr))}`,
  );
}

test.describe("Start page and story creation", () => {
  test("shows start page and creates a new story", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Hello",
    );
    await expect(
      page.getByRole("button", { name: /new story/i }),
    ).toBeVisible();

    // Create a new story
    await page.getByRole("button", { name: /new story/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/title/i).fill("Test Story");
    await dialog.getByRole("button", { name: /^create$/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Test Story",
    );
  });
});

test.describe("Import story", () => {
  test("imports a story via API and verifies it loaded", async ({
    page,
    request,
  }) => {
    const storyId = await importStoryViaApi(request);
    await navigateToStory(page, storyId);

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "The Dark Cave",
    );
    await expect(page.getByRole("link", { name: "Entrance" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Dark Tunnel" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Treasure Room" }),
    ).toBeVisible();
  });
});

test.describe("Page editing", () => {
  test("edits page name and content", async ({ page, request }) => {
    const storyId = await importStoryViaApi(request);
    await navigateToPage(page, storyId, "Entrance");

    const titleInput = page.getByLabel(/page title/i);
    await titleInput.fill("Cave Entrance");
    await titleInput.blur();

    const bodyInput = page.locator("#page-body-input");
    await bodyInput.click();
    await bodyInput.fill("A new description of the cave entrance.");
    await page.waitForTimeout(300);
    await bodyInput.blur();
    await page.waitForTimeout(500);

    await expect(titleInput).toHaveValue("Cave Entrance");
    await expect(bodyInput).toHaveValue(
      "A new description of the cave entrance.",
    );

    // Verify sidebar updated
    await expect(
      page.getByRole("link", { name: "Cave Entrance" }),
    ).toBeVisible();
  });
});

test.describe("Choice management", () => {
  test("adds, edits, and deletes choices", async ({ page, request }) => {
    const storyId = await importStoryViaApi(request);
    await navigateToPage(page, storyId, "Treasure Room");

    // Add a choice
    await page.getByRole("button", { name: /add choice/i }).click();
    await page.waitForTimeout(300);

    const choiceInput = page.getByLabel(/choice text/i).first();
    await choiceInput.fill("Take the treasure");
    await choiceInput.blur();
    await page.waitForTimeout(300);

    await expect(choiceInput).toHaveValue("Take the treasure");

    // Change target page
    const targetSelect = page.getByLabel(/leads to/i).first();
    await targetSelect.selectOption({ label: "Entrance" });
    await page.waitForTimeout(300);

    // Delete the choice
    await page.getByRole("button", { name: /^delete$/i }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText("Take the treasure")).not.toBeVisible();
  });
});

test.describe("Flag CRUD", () => {
  test("creates, edits, and deletes flags", async ({ page, request }) => {
    const storyId = await importStoryViaApi(request);
    await navigateToStory(page, storyId);

    // Open flags section and dialog
    await page.getByRole("button", { name: /flags/i }).first().click();
    await page.getByRole("button", { name: /manage flags/i }).click();

    // Verify imported flags are present
    await expect(page.locator('input[value="has_torch"]')).toBeVisible();
    await expect(page.locator('input[value="found_key"]')).toBeVisible();

    // Create a new flag (use last() — existing flags also have the same placeholder)
    const flagNameInput = page.getByPlaceholder(/flag name/i).last();
    await flagNameInput.fill("has_map");
    await page.getByRole("button", { name: /^create$/i }).click();
    await page.waitForTimeout(500);

    // Verify it appears in the sidebar flags section
    await page.getByRole("button", { name: /close/i }).click();
    const flagsSection = page.locator("div.flags-section");
    await expect(flagsSection.getByText("has_map")).toBeVisible();

    // Re-open and edit the flag name
    await page.getByRole("button", { name: /manage flags/i }).click();
    await page.waitForTimeout(300);

    // The last existing flag input should be has_map (3rd flag input, after found_key and has_torch)
    const mapInput = page.getByRole("textbox", { name: /flag name/i }).nth(2);
    await mapInput.clear();
    await mapInput.fill("has_treasure_map");
    await mapInput.blur();
    await page.waitForTimeout(500);

    // Delete the flag (3rd flag row)
    const deleteButtons = page.getByRole("button", { name: /^delete$/i });
    await deleteButtons.nth(2).click();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /close/i }).click();
    await expect(flagsSection.getByText("has_treasure_map")).not.toBeVisible();
  });
});

test.describe("Choice conditions", () => {
  test("adds and removes a condition on a choice", async ({
    page,
    request,
  }) => {
    const storyId = await importStoryViaApi(request);
    await navigateToPage(page, storyId, "Dark Tunnel");

    // Scope to the conditions section within the first choice
    // The h4 "Show this choice only if:" is inside a div.p-3 container
    const conditionSection = page
      .locator("h4", { hasText: /show this choice only if/i })
      .first()
      .locator("..");

    // Select flag and value
    await conditionSection.getByLabel("Flag").selectOption({ label: "has_torch" });
    await conditionSection
      .getByLabel("Required value")
      .selectOption("true");
    await conditionSection
      .getByRole("button", { name: /add condition/i })
      .click();
    await page.waitForTimeout(500);

    // Verify condition appears
    await expect(page.getByText(/has_torch.*must be.*true/).first()).toBeVisible();

    // Remove the condition
    await page.getByRole("button", { name: /remove has_torch/i }).click();
    await page.waitForTimeout(500);
    await expect(
      page.getByText("has_torch must be true"),
    ).not.toBeVisible();
  });
});

test.describe("Choice flag operations", () => {
  test("adds and removes a flag operation on a choice", async ({
    page,
    request,
  }) => {
    const storyId = await importStoryViaApi(request);
    await navigateToPage(page, storyId, "Entrance");

    // Find the second choice card
    const secondChoice = page.locator("div.border.rounded-lg.p-4.bg-gray-50").nth(1);

    // Within that choice, find the flag operations section
    const operationSection = secondChoice.locator("div.p-3.bg-white", {
      hasText: /when selected/i,
    });

    await operationSection.getByLabel("Flag").selectOption({ label: "has_torch" });
    await operationSection.getByLabel("Operation").selectOption("set_true");
    await operationSection
      .getByRole("button", { name: /add operation/i })
      .click();
    await page.waitForTimeout(500);

    await expect(page.getByText(/has_torch.*→.*set_true/)).toBeVisible();

    // Remove the operation (scoped to the second choice)
    await secondChoice
      .getByRole("button", { name: /remove has_torch/i })
      .click();
    await page.waitForTimeout(500);
    await expect(
      secondChoice.getByText(/has_torch.*→.*set_true/),
    ).not.toBeVisible();
  });
});

test.describe("Page flag operations", () => {
  test("adds and removes a page-level flag operation", async ({
    page,
    request,
  }) => {
    const storyId = await importStoryViaApi(request);
    await navigateToPage(page, storyId, "Dark Tunnel");

    // The page-level flag operations section has a data-testid
    const pageFlagOpsContainer = page.getByTestId("page-flag-operations");
    await expect(pageFlagOpsContainer).toBeVisible();

    // Add a page-level flag operation via the HTTP API directly,
    // then verify it appears in the UI after refresh
    const storyResponse = await request.get(`${API_BASE}/stories/${storyId}/export`);
    const storyJson = await storyResponse.json();
    const darkTunnelPage = storyJson.data.match(/\[\[pages\]\]\nid = (\d+)[^[]*name = "Dark Tunnel"/);
    const pageIdForApi = darkTunnelPage ? parseInt(darkTunnelPage[1]) : 0;

    const flagsResponse = await request.get(`${API_BASE}/stories/${storyId}/flags`);
    const flagsJson = await flagsResponse.json();
    const foundKeyFlag = flagsJson.data.find((f: any) => f.name === "found_key");

    // Set the flag operation via API
    await request.post(`${API_BASE}/flags/operation`, {
      data: {
        choice_id: null,
        page_id: pageIdForApi,
        flag_id: foundKeyFlag.id,
        operation: "set_true",
      },
      headers: { "Content-Type": "application/json" },
    });

    // Reload the page to see the change
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Dark Tunnel" }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText(/found_key.*→.*set_true/).first()).toBeVisible();

    // Remove it via the API and verify UI updates after reload
    await request.post(`${API_BASE}/flags/operation/remove`, {
      data: {
        choice_id: null,
        page_id: pageIdForApi,
        flag_id: foundKeyFlag.id,
      },
      headers: { "Content-Type": "application/json" },
    });

    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Dark Tunnel" }).click();
    await page.waitForTimeout(500);

    await expect(
      page.getByTestId("page-flag-operations").getByText(/found_key.*→.*set_true/),
    ).not.toBeVisible();
  });
});

test.describe("Start page setting", () => {
  test("changes the start page", async ({ page, request }) => {
    const storyId = await importStoryViaApi(request);
    await navigateToStory(page, storyId);

    // Open Story Settings
    await page.getByText("Story Settings").click();
    await page.waitForTimeout(300);

    // Change start page
    await page.getByLabel(/start page/i).selectOption({ label: "Dark Tunnel" });
    await page.waitForTimeout(500);

    // Verify the START badge moved
    const darkTunnelLink = page.getByRole("link", { name: /Dark Tunnel/i });
    await expect(
      darkTunnelLink.getByText(/start/i),
    ).toBeVisible();
  });
});

test.describe("Export", () => {
  test("exports story to TOML and matches snapshot", async ({
    page,
    request,
  }) => {
    const storyId = await importStoryViaApi(request);
    await navigateToStory(page, storyId);

    const response = await request.get(
      `${API_BASE}/stories/${storyId}/export`,
    );
    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    expect(json.status).toBe("ok");

    const toml = normalizeTomlIds(json.data);
    expect(toml).toMatchSnapshot("story-export.toml");
  });

  test("schema export snapshot", async ({ request }) => {
    const response = await request.get(`${API_BASE}/schema`);
    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    expect(json.status).toBe("ok");
    expect(json.data).toMatchSnapshot("schema-export.toml");
  });
});
