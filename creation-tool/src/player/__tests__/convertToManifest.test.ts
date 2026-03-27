import { describe, it, expect } from "vitest";
import type {
  Page,
  Choice,
  FlagOperation,
  ChoiceCondition,
  Flag,
  StoryOutline,
} from "../../../bindings";
import {
  convertPageToManifestPage,
  convertToManifest,
} from "../convertToManifest";

// --- helpers ---

function makeFlag(overrides?: Partial<Flag>): Flag {
  return {
    id: 1,
    story_id: 10,
    name: "visited_cave",
    default_value: false,
    ...overrides,
  };
}

function makeFlagOperation(overrides?: Partial<FlagOperation>): FlagOperation {
  return { id: 1, flag_id: 3, operation: "set_true", ...overrides };
}

function makeCondition(overrides?: Partial<ChoiceCondition>): ChoiceCondition {
  return { id: 1, flag_id: 3, required_value: true, ...overrides };
}

function makeChoice(overrides?: Partial<Choice>): Choice {
  return {
    id: 5,
    page_id: 1,
    text: "Go north",
    target_page: 2,
    flag_operations: [],
    conditions: [],
    ...overrides,
  };
}

function makePage(overrides?: Partial<Page>): Page {
  return {
    id: 1,
    story_id: 10,
    name: "Start",
    body: "You are at the start.",
    options: [],
    flag_operations: [],
    ...overrides,
  };
}

function makeOutline(overrides?: Partial<StoryOutline>): StoryOutline {
  return {
    id: 10,
    title: "My Story",
    pages: [{ id: 1, name: "Start" }],
    start_page: 1,
    ...overrides,
  };
}

// --- tests ---

describe("convertPageToManifestPage", () => {
  it("converts a page with choices, flag operations, and conditions", () => {
    const flagOp = makeFlagOperation({ id: 10, flag_id: 3, operation: "toggle" });
    const condition = makeCondition({ id: 20, flag_id: 7, required_value: false });
    const choice = makeChoice({
      id: 5,
      target_page: 2,
      flag_operations: [flagOp],
      conditions: [condition],
    });
    const pageFlagOp = makeFlagOperation({ id: 11, flag_id: 4, operation: "set_false" });
    const page = makePage({
      id: 1,
      options: [choice],
      flag_operations: [pageFlagOp],
    });

    const result = convertPageToManifestPage(page);

    expect(result.id).toBe("1");
    expect(result.name).toBe("Start");
    expect(result.body).toBe("You are at the start.");
    expect(result.assets).toEqual([]);

    // flag_operations on page
    expect(result.flag_operations).toHaveLength(1);
    expect(result.flag_operations[0].flag_id).toBe("4");
    expect(result.flag_operations[0].operation).toBe("set_false");

    // choices
    expect(result.choices).toHaveLength(1);
    const mChoice = result.choices[0];
    expect(mChoice.id).toBe("5");
    expect(mChoice.text).toBe("Go north");
    expect(mChoice.target).toBe("2");

    // choice flag_operations
    expect(mChoice.flag_operations).toHaveLength(1);
    expect(mChoice.flag_operations[0].flag_id).toBe("3");
    expect(mChoice.flag_operations[0].operation).toBe("toggle");

    // choice conditions
    expect(mChoice.conditions).toHaveLength(1);
    expect(mChoice.conditions[0].flag_id).toBe("7");
    expect(mChoice.conditions[0].required_value).toBe(false);
  });

  it("converts a page with no choices", () => {
    const page = makePage({ id: 99, options: [], flag_operations: [] });
    const result = convertPageToManifestPage(page);

    expect(result.id).toBe("99");
    expect(result.choices).toEqual([]);
    expect(result.flag_operations).toEqual([]);
    expect(result.assets).toEqual([]);
  });
});

describe("convertToManifest", () => {
  it("converts a full story (outline + full pages + flags) to Manifest", () => {
    const flag1 = makeFlag({ id: 3, story_id: 10, name: "visited_cave", default_value: false });
    const flag2 = makeFlag({ id: 7, story_id: 10, name: "has_sword", default_value: true });

    const page1 = makePage({ id: 1, story_id: 10, name: "Start", body: "Start page." });
    const page2 = makePage({
      id: 2,
      story_id: 10,
      name: "Cave",
      body: "Dark cave.",
      flag_operations: [makeFlagOperation({ flag_id: 3, operation: "set_true" })],
    });

    const outline = makeOutline({
      id: 10,
      title: "My Story",
      start_page: 1,
      pages: [
        { id: 1, name: "Start" },
        { id: 2, name: "Cave" },
      ],
    });

    const manifest = convertToManifest(outline, [page1, page2], [flag1, flag2]);

    expect(manifest.format_version).toBe(1);

    expect(manifest.story.id).toBe("10");
    expect(manifest.story.title).toBe("My Story");
    expect(manifest.story.start_page).toBe("1");

    expect(manifest.flags).toHaveLength(2);
    expect(manifest.flags[0]).toEqual({ id: "3", name: "visited_cave", default_value: false });
    expect(manifest.flags[1]).toEqual({ id: "7", name: "has_sword", default_value: true });

    expect(manifest.pages).toHaveLength(2);
    expect(manifest.pages[0].id).toBe("1");
    expect(manifest.pages[1].id).toBe("2");
    expect(manifest.pages[1].flag_operations[0].flag_id).toBe("3");
  });

  it("handles empty flags and a single page", () => {
    const page = makePage({ id: 5, story_id: 20, name: "Only Page", body: "The end." });
    const outline = makeOutline({
      id: 20,
      title: "Short Story",
      start_page: 5,
      pages: [{ id: 5, name: "Only Page" }],
    });

    const manifest = convertToManifest(outline, [page], []);

    expect(manifest.flags).toEqual([]);
    expect(manifest.pages).toHaveLength(1);
    expect(manifest.story.start_page).toBe("5");
    expect(manifest.story.title).toBe("Short Story");
  });
});
