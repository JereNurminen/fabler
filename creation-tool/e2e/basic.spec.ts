import { test, expect } from "@playwright/test";

const BUTTON_TEXT = {
  NEW_STORY: /new story/i,
  CREATE: /create/i,
  ADD_CHOICE: /add choice/i,
  MANAGE_FLAGS: /manage flags/i,
  ADD_FLAG: /add flag/i,
  ADD_CONDITION: /add condition/i,
  CLOSE: /close/i,
  SAVE_UPDATE: /save|update/i,
  DELETE: /delete/i,
  ADD: /add/i,
  FLAGS: /flags/i,
};

const INPUT_LABEL = {
  TITLE: /title/i,
  PAGE_TITLE: /page title/i,
  FLAG_NAME: /flag name/i,
  DEFAULT_VALUE: /default value/i,
};

const SELECTOR = {
  PAGE_BODY: "#page-body-input",
  TEXT_INPUT: 'input[type="text"]',
  SHOW_IF: "text=Show if",
  WHEN_SELECTED: "text=When selected",
  SIDEBAR_STORY_SETTINGS_SECTION: "div.sidebar div.story-settings-section",
  SIDEBAR_FLAGS_SECTION: "div.sidebar div.flags-section",
  SIDEBAR_PAGES_SECTION: "div.sidebar div.pages-section",
};

const TEXT = {
  HELLO: "Hello",
  START: /START/i,
  TEST_STORY: "Test Story",
  WELCOME_PAGE: "Welcome Page",
  WELCOME_CONTENT: "Welcome to the adventure!",
  GO_NORTH: "Go north",
  HAS_KEY: "has_key",
  HAS_GOLDEN_KEY: "has_golden_key",
  DOOR_UNLOCKED: "door_unlocked",
  ENTER_DOOR: "Enter the door",
  PICKED_UP_SWORD: "picked_up_sword",
  PICK_UP_SWORD: "Pick up the sword",
  FLAGS: /flags/i,
};

test.describe("Story Creation Tool", () => {
  test("story creation e2e", async ({ page }) => {
    await test.step("should load the start page", async () => {
      await page.goto("/", { waitUntil: "networkidle" });
      await expect(page.locator("h1").first()).toContainText(TEXT.HELLO);
      await expect(
        page.getByRole("button", { name: BUTTON_TEXT.NEW_STORY }),
      ).toBeVisible();
    });

    await test.step("should create a new story", async () => {
      await page.getByRole("button", { name: BUTTON_TEXT.NEW_STORY }).click();
      await page.getByPlaceholder(INPUT_LABEL.TITLE).fill(TEXT.TEST_STORY);
      await page.getByRole("button", { name: BUTTON_TEXT.CREATE }).click();
      //await expect(page).toHaveURL(/\/story\/\d+/);
      await expect(page.locator("h1").first()).toContainText(TEXT.TEST_STORY);
    });

    await test.step("should create a page and edit its content", async () => {
      await page.getByText(TEXT.START).first().click();
      const titleInput = page.getByLabel(INPUT_LABEL.PAGE_TITLE);
      await titleInput.fill(TEXT.WELCOME_PAGE);
      await titleInput.blur();
      const contentTextarea = page.locator(SELECTOR.PAGE_BODY);
      await contentTextarea.click();
      await contentTextarea.fill(TEXT.WELCOME_CONTENT);
      await contentTextarea.blur();
      await page.waitForTimeout(500);
      await expect(titleInput).toHaveValue(TEXT.WELCOME_PAGE);
      await expect(contentTextarea).toHaveValue(TEXT.WELCOME_CONTENT);
    });

    await test.step("should add a choice to a page", async () => {
      await page.getByRole("button", { name: BUTTON_TEXT.ADD_CHOICE }).click();
      const choiceTextInput = page.locator(SELECTOR.TEXT_INPUT).first();
      await choiceTextInput.waitFor({ state: "visible" });
      await choiceTextInput.click();
      await choiceTextInput.fill(TEXT.GO_NORTH);
      await choiceTextInput.blur();
      await page.waitForTimeout(500);
      await expect(choiceTextInput).toHaveValue(TEXT.GO_NORTH);
    });

    await test.step("should create a flag", async () => {
      await page.getByRole("button", { name: BUTTON_TEXT.FLAGS }).click();
      await page
        .getByRole("button", { name: BUTTON_TEXT.MANAGE_FLAGS })
        .click();
      const flagDialog = page.locator("div.flag-creation-dialog");
      await expect(
        page.locator("h3").filter({ hasText: TEXT.FLAGS }),
      ).toBeVisible();
      const flagNameInput = flagDialog.getByPlaceholder(INPUT_LABEL.FLAG_NAME);
      await flagNameInput.fill(TEXT.HAS_KEY);
      const defaultValueCheckbox = flagDialog.getByLabel(
        INPUT_LABEL.DEFAULT_VALUE,
      );
      await expect(defaultValueCheckbox).toBeVisible();
      await flagDialog
        .getByRole("button", { name: BUTTON_TEXT.CREATE })
        .click();
      await page.waitForTimeout(500);
      await expect(
        page.locator(SELECTOR.SIDEBAR_FLAGS_SECTION).getByText(TEXT.HAS_KEY),
      ).toBeVisible();
    });

    await test.step("should edit a flag", async () => {
      const flagInput = page.locator(`input[value="${TEXT.HAS_KEY}"]`).first();
      await flagInput.click();
      await flagInput.fill(TEXT.HAS_GOLDEN_KEY);
      const saveButton = flagInput
        .locator("..")
        .locator("..")
        .getByRole("button", { name: BUTTON_TEXT.SAVE_UPDATE })
        .first();
      await saveButton.click();
      await page.waitForTimeout(500);
      await expect(
        page.locator(`input[value="${TEXT.HAS_GOLDEN_KEY}"]`),
      ).toBeVisible();
    });

    await test.step("should delete a flag", async () => {
      const deleteButton = page
        .locator(`input[value="${TEXT.HAS_GOLDEN_KEY}"]`)
        .locator("..")
        .locator("..")
        .getByRole("button", { name: BUTTON_TEXT.DELETE })
        .first();
      await deleteButton.click();
      await page.waitForTimeout(500);
      await expect(page.getByText(TEXT.HAS_GOLDEN_KEY)).not.toBeVisible();
      await page.getByRole("button", { name: BUTTON_TEXT.CLOSE }).click();
    });

    await test.step("should add a condition to a choice", async () => {
      await page
        .getByRole("button", { name: BUTTON_TEXT.MANAGE_FLAGS })
        .click();
      const flagNameInput = page.getByPlaceholder(INPUT_LABEL.FLAG_NAME);
      await flagNameInput.fill(TEXT.DOOR_UNLOCKED);
      await page.getByRole("button", { name: BUTTON_TEXT.ADD_FLAG }).click();
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: BUTTON_TEXT.CLOSE }).click();
      await page.getByRole("button", { name: BUTTON_TEXT.ADD_CHOICE }).click();
      const choiceTextInput = page.locator(SELECTOR.TEXT_INPUT).nth(1);
      await choiceTextInput.waitFor({ state: "visible" });
      await choiceTextInput.fill(TEXT.ENTER_DOOR);
      await choiceTextInput.blur();
      await page.waitForTimeout(500);
      const showIfSection = page.locator(SELECTOR.SHOW_IF).locator("..").last();
      const flagSelect = showIfSection.locator("select").first();
      await flagSelect.selectOption({ label: TEXT.DOOR_UNLOCKED });
      const valueSelect = showIfSection.locator("select").nth(1);
      await valueSelect.selectOption("true");
      const addConditionButton = showIfSection.getByRole("button", {
        name: BUTTON_TEXT.ADD_CONDITION,
      });
      await addConditionButton.click();
      await page.waitForTimeout(500);
      await expect(
        page.getByText(new RegExp(`${TEXT.DOOR_UNLOCKED}.*must be.*true`)),
      ).toBeVisible();
    });

    await test.step("should remove a condition from a choice", async () => {
      const removeButton = page
        .locator(`text=${TEXT.DOOR_UNLOCKED}`)
        .locator("..")
        .getByRole("button")
        .filter({ hasText: "×" });
      await removeButton.click();
      await page.waitForTimeout(500);
      await expect(
        page.getByText(new RegExp(`${TEXT.DOOR_UNLOCKED}.*must be.*true`)),
      ).not.toBeVisible();
    });

    await test.step("should add a flag operation to a choice", async () => {
      await page
        .getByRole("button", { name: BUTTON_TEXT.MANAGE_FLAGS })
        .click();
      const flagNameInput = page.getByPlaceholder(INPUT_LABEL.FLAG_NAME);
      await flagNameInput.fill(TEXT.PICKED_UP_SWORD);
      await page.getByRole("button", { name: BUTTON_TEXT.ADD_FLAG }).click();
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: BUTTON_TEXT.CLOSE }).click();
      await page.getByRole("button", { name: BUTTON_TEXT.ADD_CHOICE }).click();
      const choiceTextInput = page.locator(SELECTOR.TEXT_INPUT).nth(2);
      await choiceTextInput.waitFor({ state: "visible" });
      await choiceTextInput.fill(TEXT.PICK_UP_SWORD);
      await choiceTextInput.blur();
      await page.waitForTimeout(500);
      const whenSelectedSection = page
        .locator(SELECTOR.WHEN_SELECTED)
        .locator("..")
        .last();
      const flagSelect = whenSelectedSection.locator("select").first();
      await flagSelect.selectOption({ label: TEXT.PICKED_UP_SWORD });
      const operationSelect = whenSelectedSection.locator("select").nth(1);
      await operationSelect.selectOption("set_true");
      const addButton = whenSelectedSection.getByRole("button", {
        name: BUTTON_TEXT.ADD,
      });
      await addButton.click();
      await page.waitForTimeout(500);
      await expect(
        page.getByText(new RegExp(`${TEXT.PICKED_UP_SWORD}.*→.*set_true`)),
      ).toBeVisible();
    });

    await test.step("should remove a flag operation from a choice", async () => {
      const removeButton = page
        .locator(`text=${TEXT.PICKED_UP_SWORD}`)
        .locator("..")
        .getByRole("button")
        .filter({ hasText: "×" });
      await removeButton.click();
      await page.waitForTimeout(500);
      await expect(
        page.getByText(new RegExp(`${TEXT.PICKED_UP_SWORD}.*→.*set_true`)),
      ).not.toBeVisible();
    });
  });
});
