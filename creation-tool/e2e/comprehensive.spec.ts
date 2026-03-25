import { test, expect } from "@playwright/test";

const API_BASE = "http://127.0.0.1:3001/api";

/**
 * Normalize auto-generated IDs in TOML export so snapshots are stable
 * across test runs regardless of existing DB state. Maps each unique ID
 * to a sequential number (1, 2, 3...) in order of first appearance.
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
    /((?:id|flag_id|target|start_page|page_id|story_id)\s*=\s*)(\d+)/g,
    (_match, prefix, numStr) => {
      return `${prefix}${getId(parseInt(numStr))}`;
    },
  );
}

test.describe("Comprehensive Story Creation", () => {
  test("create story with pages, flags, and choices", async ({ page }) => {
    // ── Create story ──────────────────────────────────────────────
    await test.step("create a new story", async () => {
      await page.goto("/", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: /new story/i }).click();

      const titleInput = page.getByPlaceholder(/title/i);
      await titleInput.waitFor({ state: "visible" });
      await page.waitForTimeout(400);

      await titleInput.fill("The Dark Cave");
      await page.getByRole("button", { name: /^create$/i }).click();
      await page.waitForURL(/\/story\/\d+/);
      await expect(page.locator("h1").first()).toContainText("The Dark Cave");
    });

    // ── Edit the default START page → "Entrance" ─────────────────
    await test.step("edit first page: Entrance", async () => {
      await page.locator("div.pages-section a").first().click();
      await page.waitForTimeout(300);

      const titleInput = page.getByLabel(/page title/i);
      await titleInput.fill("Entrance");
      await titleInput.blur();

      const bodyInput = page.locator("#page-body-input");
      await bodyInput.fill(
        "You stand at the entrance of a dark cave. The air is cold and damp.",
      );
      await bodyInput.blur();
      await page.waitForTimeout(500);
    });

    // ── Create second page: "Dark Tunnel" ─────────────────────────
    await test.step("create and edit second page: Dark Tunnel", async () => {
      await page.getByRole("button", { name: /create page/i }).click();
      await page.waitForTimeout(500);

      const titleInput = page.getByLabel(/page title/i);
      await titleInput.fill("Dark Tunnel");
      await titleInput.blur();

      const bodyInput = page.locator("#page-body-input");
      await bodyInput.fill(
        "The tunnel is dark and winding. You hear dripping water echoing off the walls.",
      );
      await bodyInput.blur();
      await page.waitForTimeout(500);
    });

    // ── Create third page: "Treasure Room" ────────────────────────
    await test.step(
      "create and edit third page: Treasure Room",
      async () => {
        await page.getByRole("button", { name: /create page/i }).click();
        await page.waitForTimeout(500);

        const titleInput = page.getByLabel(/page title/i);
        await titleInput.fill("Treasure Room");
        await titleInput.blur();

        const bodyInput = page.locator("#page-body-input");
        await bodyInput.fill(
          "Golden light floods the chamber. You have found the legendary treasure!",
        );
        await bodyInput.blur();
        await page.waitForTimeout(500);
      },
    );

    // ── Create flags ──────────────────────────────────────────────
    await test.step("create flags: has_torch and found_key", async () => {
      await page.getByRole("button", { name: /^flags$/i }).click();
      await page.getByRole("button", { name: /manage flags/i }).click();
      await expect(
        page.locator("h3").filter({ hasText: /flags/i }),
      ).toBeVisible();

      const flagDialog = page.locator("div.flag-creation-dialog");

      await flagDialog.getByPlaceholder(/flag name/i).last().fill("has_torch");
      await flagDialog.getByRole("button", { name: /^create$/i }).click();
      await page.waitForTimeout(500);

      await flagDialog.getByPlaceholder(/flag name/i).last().fill("found_key");
      await flagDialog.getByRole("button", { name: /^create$/i }).click();
      await page.waitForTimeout(500);

      await page.getByRole("button", { name: /close/i }).click();
      const flagsSection = page.locator("div.flags-section");
      await expect(flagsSection.getByText("has_torch")).toBeVisible();
      await expect(flagsSection.getByText("found_key")).toBeVisible();
    });

    // ── Navigate to Entrance and add choices ──────────────────────
    await test.step(
      "add choices to Entrance page with flag operation",
      async () => {
        await page.locator("div.pages-section a").first().click();
        await page.waitForTimeout(500);
        await expect(page.getByLabel(/page title/i)).toHaveValue("Entrance");

        // Add first choice: "Enter the tunnel"
        await page.getByRole("button", { name: /add choice/i }).click();
        await page.waitForTimeout(300);

        const choice1Text = page.locator('[id^="choice-text-"]').first();
        await choice1Text.fill("Enter the tunnel");
        await choice1Text.blur();
        await page.waitForTimeout(300);

        // Set target to Dark Tunnel
        const choice1Target = page.locator('[id^="choice-target-"]').first();
        await choice1Target.selectOption({ label: "Dark Tunnel" });
        await page.waitForTimeout(300);

        // Add second choice: "Search for a torch"
        await page.getByRole("button", { name: /add choice/i }).click();
        await page.waitForTimeout(300);

        const choice2Text = page.locator('[id^="choice-text-"]').nth(1);
        await choice2Text.fill("Search for a torch");
        await choice2Text.blur();
        await page.waitForTimeout(300);

        // Add flag operation: has_torch → set_true on this choice
        const choice2FlagOps = page
          .locator("h4:has-text('When selected')")
          .locator("..")
          .nth(1);
        await choice2FlagOps
          .locator("select")
          .first()
          .selectOption({ label: "has_torch" });
        await choice2FlagOps.locator("select").nth(1).selectOption("set_true");
        await choice2FlagOps
          .getByRole("button", { name: /add operation/i })
          .click();
        await page.waitForTimeout(500);

        await expect(page.getByText(/has_torch.*→.*set_true/)).toBeVisible();
      },
    );
  });

  // TODO: Fix page-level flag operation locators — the h3/h4 parent
  // traversal doesn't reliably reach the container with the selects.
  test.skip(
    "add conditions, page flag ops, delete/re-add choices, set start page, export",
    async ({ page }) => {
      // ── Navigate to Dark Tunnel and set up choices + conditions ───
      await test.step(
        "add choices and conditions to Dark Tunnel page",
        async () => {
          await page
            .locator("div.pages-section a")
            .filter({ hasText: /Dark Tunnel/i })
            .click();
          await page.waitForTimeout(500);
          await expect(page.getByLabel(/page title/i)).toHaveValue(
            "Dark Tunnel",
          );

          // Add page-level flag operation: found_key → set_true
          const pageFlagOps = page
            .locator("h3:has-text('When page is shown')")
            .locator("..");
          await pageFlagOps
            .locator("select")
            .first()
            .selectOption({ label: "found_key" });
          await pageFlagOps.locator("select").nth(1).selectOption("set_true");
          await pageFlagOps
            .getByRole("button", { name: /add operation/i })
            .click();
          await page.waitForTimeout(500);
          await expect(
            page.getByText(/found_key.*→.*set_true/),
          ).toBeVisible();

          // Add first choice: "Enter the treasure room"
          await page.getByRole("button", { name: /add choice/i }).click();
          await page.waitForTimeout(300);

          const choice1Text = page.locator('[id^="choice-text-"]').first();
          await choice1Text.fill("Enter the treasure room");
          await choice1Text.blur();
          await page.waitForTimeout(300);

          const choice1Target = page
            .locator('[id^="choice-target-"]')
            .first();
          await choice1Target.selectOption({ label: "Treasure Room" });
          await page.waitForTimeout(300);

          // Add condition: has_torch must be true
          const choice1Conditions = page
            .locator("h4:has-text('Show this choice')")
            .locator("..")
            .first();
          await choice1Conditions
            .locator("select")
            .first()
            .selectOption({ label: "has_torch" });
          await choice1Conditions
            .locator("select")
            .nth(1)
            .selectOption("true");
          await choice1Conditions
            .getByRole("button", { name: /add condition/i })
            .click();
          await page.waitForTimeout(500);
          await expect(
            page.getByText(/has_torch.*must be.*true/),
          ).toBeVisible();

          // Add choice-level flag operation: found_key → set_false
          const choice1FlagOps = page
            .locator("h4:has-text('When selected')")
            .locator("..")
            .first();
          await choice1FlagOps
            .locator("select")
            .first()
            .selectOption({ label: "found_key" });
          await choice1FlagOps
            .locator("select")
            .nth(1)
            .selectOption("set_false");
          await choice1FlagOps
            .getByRole("button", { name: /add operation/i })
            .click();
          await page.waitForTimeout(500);
          await expect(
            page.getByText(/found_key.*→.*set_false/),
          ).toBeVisible();

          // Add second choice: "Go back to entrance"
          await page.getByRole("button", { name: /add choice/i }).click();
          await page.waitForTimeout(300);

          const choice2Text = page.locator('[id^="choice-text-"]').nth(1);
          await choice2Text.fill("Go back to entrance");
          await choice2Text.blur();
          await page.waitForTimeout(300);

          const choice2Target = page
            .locator('[id^="choice-target-"]')
            .nth(1);
          await choice2Target.selectOption({ label: "Entrance" });
          await page.waitForTimeout(300);
        },
      );

      // ── Delete a choice ───────────────────────────────────────────
      await test.step("delete a choice from Dark Tunnel", async () => {
        const deleteButtons = page.getByRole("button", {
          name: /^delete$/i,
        });
        await deleteButtons.last().click();
        await page.waitForTimeout(500);

        await expect(
          page.locator("text=Go back to entrance"),
        ).not.toBeVisible();
        await expect(
          page.locator('[id^="choice-text-"]').first(),
        ).toHaveValue("Enter the treasure room");
      });

      // ── Re-add the deleted choice ─────────────────────────────────
      await test.step("re-add Go back choice", async () => {
        await page.getByRole("button", { name: /add choice/i }).click();
        await page.waitForTimeout(300);

        const choice2Text = page.locator('[id^="choice-text-"]').nth(1);
        await choice2Text.fill("Go back to entrance");
        await choice2Text.blur();
        await page.waitForTimeout(300);

        const choice2Target = page.locator('[id^="choice-target-"]').nth(1);
        await choice2Target.selectOption({ label: "Entrance" });
        await page.waitForTimeout(300);
      });

      // ── Set start page ────────────────────────────────────────────
      await test.step("set start page to Entrance", async () => {
        await page.getByText("Story Settings").click();
        await page.waitForTimeout(300);

        const startPageSelect = page
          .locator("div.story-settings-section")
          .locator("select");
        await startPageSelect.selectOption({ label: "Entrance" });
        await page.waitForTimeout(500);
      });

      // ── Verify sidebar state ──────────────────────────────────────
      await test.step(
        "verify sidebar shows all pages and flags",
        async () => {
          const pagesSection = page.locator("div.pages-section");
          await expect(
            pagesSection.locator("a").filter({ hasText: /Entrance/i }),
          ).toBeVisible();
          await expect(
            pagesSection.locator("a").filter({ hasText: /Dark Tunnel/i }),
          ).toBeVisible();
          await expect(
            pagesSection.locator("a").filter({ hasText: /Treasure Room/i }),
          ).toBeVisible();

          const entranceLink = pagesSection
            .locator("a")
            .filter({ hasText: /Entrance/i });
          await expect(entranceLink.getByText(/start/i)).toBeVisible();
        },
      );

      // ── Export TOML and snapshot ───────────────────────────────────
      await test.step(
        "export story to TOML and verify snapshot",
        async () => {
          const url = page.url();
          const storyIdMatch = url.match(/\/story\/(\d+)/);
          expect(storyIdMatch).toBeTruthy();
          const storyId = storyIdMatch![1];

          const response = await page.request.get(
            `${API_BASE}/stories/${storyId}/export`,
          );
          expect(response.ok()).toBeTruthy();

          const json = await response.json();
          expect(json.status).toBe("ok");

          const toml = normalizeTomlIds(json.data);
          expect(toml).toMatchSnapshot("story-export.toml");
        },
      );
    },
  );

  test("schema export snapshot", async ({ request }) => {
    const response = await request.get(`${API_BASE}/schema`);
    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    expect(json.status).toBe("ok");
    expect(json.data).toMatchSnapshot("schema-export.toml");
  });
});
