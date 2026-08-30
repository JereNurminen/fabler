import { test, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import {
  resetProject,
  createPageViaApi,
  getPageViaApi,
  savePageViaApi,
  listPagesViaApi,
  navigateToEditor,
  exportBundleViaApi,
  getStory,
  saveStoryViaApi,
} from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetProject(request);
});

/** Point the start page's first choice at a page id that does not exist. */
async function addDanglingChoice(request: APIRequestContext) {
  const pages = await listPagesViaApi(request);
  const start = await getPageViaApi(request, pages[0].id);
  start.choices.push({
    id: "cdead",
    text: "Go deeper",
    target: "gone9",
    flag_operations: [],
    conditions: [],
  });
  await savePageViaApi(request, start);
  return start;
}

test.describe("Story problems", () => {
  test("a clean story reports no problems", async ({ page }) => {
    await navigateToEditor(page);
    await page.getByRole("button", { name: /problems/i }).click();
    await expect(page.getByTestId("problems-empty")).toBeVisible();
  });

  test("a dangling choice target is listed with its page", async ({ page, request }) => {
    await addDanglingChoice(request);
    await navigateToEditor(page);

    await page.getByRole("button", { name: /problems/i }).click();
    const problem = page.getByTestId("problem-dangling_choice_target");
    await expect(problem).toBeVisible();
    await expect(problem).toContainText("Go deeper");
    await expect(problem).toContainText("Start");
  });

  test("following a problem link opens the offending page", async ({ page, request }) => {
    const start = await addDanglingChoice(request);
    await navigateToEditor(page);

    await page.getByRole("button", { name: /problems/i }).click();
    await page
      .getByTestId("problem-dangling_choice_target")
      .getByRole("button", { name: /go to page/i })
      .click();

    await expect(page).toHaveURL(new RegExp(`/editor/page/${start.id}$`));
    await expect(page.locator("#page-title-input")).toHaveValue("Start");
  });

  test("a story-level problem is attributed to the story and has no navigation link", async ({
    page,
    request,
  }) => {
    const story = await getStory(request);
    story.start_page = "gone9";
    await saveStoryViaApi(request, story);
    await navigateToEditor(page);

    await page.getByRole("button", { name: /problems/i }).click();
    const problem = page.getByTestId("problem-start_page_missing");
    await expect(problem).toBeVisible();
    await expect(problem).toContainText("Story");

    // Story-level problems have no page to navigate to — the "go to page"
    // link must be absent from this entry specifically. Other problems on
    // the page (e.g. the unreachable-page warnings this fixture also
    // produces) legitimately have one, so this must be scoped to `problem`.
    await expect(problem.getByRole("button", { name: /go to page/i })).toHaveCount(0);
  });

  test("export is blocked and the dialog names the problem", async ({ page, request }) => {
    await addDanglingChoice(request);
    await navigateToEditor(page);

    // The Export button lives inside the "Story Settings" section, which is
    // not defaultOpen — Collapsible unmounts its panel while collapsed, so
    // the header must be clicked first to mount the button into the DOM.
    await page.getByRole("button", { name: /story settings/i }).click();
    await page.getByRole("button", { name: /export \.fabler/i }).click();

    const dialog = page.getByTestId("export-blocked-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Go deeper");
  });

  test("the backend refuses a blocked export even without the UI", async ({ request }) => {
    await addDanglingChoice(request);
    expect(await exportBundleViaApi(request)).toBe(false);
  });

  test("fixing the problem unblocks export", async ({ request }) => {
    const start = await addDanglingChoice(request);
    expect(await exportBundleViaApi(request)).toBe(false);

    start.choices = [];
    await savePageViaApi(request, start);

    expect(await exportBundleViaApi(request)).toBe(true);
  });

  test("a warning does not block export", async ({ request }) => {
    // A page nothing links to is unreachable — a warning, not an error.
    await createPageViaApi(request, "Orphan");
    expect(await exportBundleViaApi(request)).toBe(true);
  });
});
