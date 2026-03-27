import { describe, it, expect } from "vitest";
import {
  evaluateConditions,
  applyFlagOperations,
  getAvailableChoices,
  initGameState,
  navigate,
} from "../runtime";
import type {
  FlagState,
  Manifest,
  ManifestChoice,
  ManifestCondition,
  ManifestFlagOperation,
  ManifestPage,
} from "../types";

// -- Helpers --

function makeChoice(
  overrides: Partial<ManifestChoice> = {},
): ManifestChoice {
  return {
    id: "choice-1",
    text: "Go north",
    target: "page-2",
    flag_operations: [],
    conditions: [],
    ...overrides,
  };
}

function makePage(overrides: Partial<ManifestPage> = {}): ManifestPage {
  return {
    id: "page-1",
    name: "Start",
    body: "You are at the start.",
    assets: [],
    flag_operations: [],
    choices: [],
    ...overrides,
  };
}

function makeManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    format_version: 1,
    story: { id: "story-1", title: "Test Story", start_page: "page-1" },
    flags: [],
    pages: [makePage()],
    ...overrides,
  };
}

// -- evaluateConditions --

describe("evaluateConditions", () => {
  it("returns true for empty conditions", () => {
    const flags: FlagState = {};
    expect(evaluateConditions([], flags)).toBe(true);
  });

  it("returns true when all conditions are met", () => {
    const flags: FlagState = { "flag-a": true, "flag-b": false };
    const conditions: ManifestCondition[] = [
      { flag_id: "flag-a", required_value: true },
      { flag_id: "flag-b", required_value: false },
    ];
    expect(evaluateConditions(conditions, flags)).toBe(true);
  });

  it("returns false when any condition is not met", () => {
    const flags: FlagState = { "flag-a": false };
    const conditions: ManifestCondition[] = [
      { flag_id: "flag-a", required_value: true },
    ];
    expect(evaluateConditions(conditions, flags)).toBe(false);
  });

  it("treats missing flags as false", () => {
    const flags: FlagState = {};
    const conditions: ManifestCondition[] = [
      { flag_id: "missing-flag", required_value: false },
    ];
    expect(evaluateConditions(conditions, flags)).toBe(true);
  });

  it("returns false for missing flag required to be true", () => {
    const flags: FlagState = {};
    const conditions: ManifestCondition[] = [
      { flag_id: "missing-flag", required_value: true },
    ];
    expect(evaluateConditions(conditions, flags)).toBe(false);
  });
});

// -- applyFlagOperations --

describe("applyFlagOperations", () => {
  it("returns same state for empty operations", () => {
    const flags: FlagState = { "flag-a": true };
    const result = applyFlagOperations([], flags);
    expect(result).toEqual({ "flag-a": true });
  });

  it("is immutable: does not mutate the original flags", () => {
    const flags: FlagState = { "flag-a": false };
    const ops: ManifestFlagOperation[] = [
      { flag_id: "flag-a", operation: "set_true" },
    ];
    const result = applyFlagOperations(ops, flags);
    expect(flags["flag-a"]).toBe(false);
    expect(result["flag-a"]).toBe(true);
    expect(result).not.toBe(flags);
  });

  it("applies set_true", () => {
    const flags: FlagState = { "flag-a": false };
    const ops: ManifestFlagOperation[] = [
      { flag_id: "flag-a", operation: "set_true" },
    ];
    expect(applyFlagOperations(ops, flags)["flag-a"]).toBe(true);
  });

  it("applies set_false", () => {
    const flags: FlagState = { "flag-a": true };
    const ops: ManifestFlagOperation[] = [
      { flag_id: "flag-a", operation: "set_false" },
    ];
    expect(applyFlagOperations(ops, flags)["flag-a"]).toBe(false);
  });

  it("applies toggle (false -> true)", () => {
    const flags: FlagState = { "flag-a": false };
    const ops: ManifestFlagOperation[] = [
      { flag_id: "flag-a", operation: "toggle" },
    ];
    expect(applyFlagOperations(ops, flags)["flag-a"]).toBe(true);
  });

  it("applies toggle (true -> false)", () => {
    const flags: FlagState = { "flag-a": true };
    const ops: ManifestFlagOperation[] = [
      { flag_id: "flag-a", operation: "toggle" },
    ];
    expect(applyFlagOperations(ops, flags)["flag-a"]).toBe(false);
  });

  it("applies multiple operations in order", () => {
    const flags: FlagState = { "flag-a": false };
    const ops: ManifestFlagOperation[] = [
      { flag_id: "flag-a", operation: "set_true" },
      { flag_id: "flag-a", operation: "toggle" },
    ];
    // set_true -> true, then toggle -> false
    expect(applyFlagOperations(ops, flags)["flag-a"]).toBe(false);
  });

  it("creates entries for flags not previously in state", () => {
    const flags: FlagState = {};
    const ops: ManifestFlagOperation[] = [
      { flag_id: "new-flag", operation: "set_true" },
    ];
    const result = applyFlagOperations(ops, flags);
    expect(result["new-flag"]).toBe(true);
  });

  it("toggles unset flag (treated as false -> true)", () => {
    const flags: FlagState = {};
    const ops: ManifestFlagOperation[] = [
      { flag_id: "new-flag", operation: "toggle" },
    ];
    expect(applyFlagOperations(ops, flags)["new-flag"]).toBe(true);
  });
});

// -- getAvailableChoices --

describe("getAvailableChoices", () => {
  it("returns all choices when none have conditions", () => {
    const choice1 = makeChoice({ id: "c1", text: "Option 1" });
    const choice2 = makeChoice({ id: "c2", text: "Option 2" });
    const page = makePage({ choices: [choice1, choice2] });
    expect(getAvailableChoices(page, {})).toEqual([choice1, choice2]);
  });

  it("filters out choices whose conditions are not met", () => {
    const lockedChoice = makeChoice({
      id: "locked",
      conditions: [{ flag_id: "key", required_value: true }],
    });
    const openChoice = makeChoice({ id: "open" });
    const page = makePage({ choices: [lockedChoice, openChoice] });
    const flags: FlagState = { key: false };
    const result = getAvailableChoices(page, flags);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("open");
  });

  it("returns different choices based on different flag states", () => {
    const choiceA = makeChoice({
      id: "a",
      conditions: [{ flag_id: "flag", required_value: true }],
    });
    const choiceB = makeChoice({
      id: "b",
      conditions: [{ flag_id: "flag", required_value: false }],
    });
    const page = makePage({ choices: [choiceA, choiceB] });

    expect(getAvailableChoices(page, { flag: true })[0].id).toBe("a");
    expect(getAvailableChoices(page, { flag: false })[0].id).toBe("b");
  });

  it("returns empty array when all choices are filtered out", () => {
    const choice = makeChoice({
      conditions: [{ flag_id: "flag", required_value: true }],
    });
    const page = makePage({ choices: [choice] });
    expect(getAvailableChoices(page, { flag: false })).toEqual([]);
  });
});

// -- initGameState --

describe("initGameState", () => {
  it("initializes with the correct start page", () => {
    const manifest = makeManifest();
    const state = initGameState(manifest);
    expect(state.currentPageId).toBe("page-1");
  });

  it("initializes flags from manifest defaults", () => {
    const manifest = makeManifest({
      flags: [
        { id: "flag-a", name: "Flag A", default_value: true },
        { id: "flag-b", name: "Flag B", default_value: false },
      ],
    });
    const state = initGameState(manifest);
    expect(state.flags["flag-a"]).toBe(true);
    expect(state.flags["flag-b"]).toBe(false);
  });

  it("initializes with empty flags when manifest has no flags", () => {
    const manifest = makeManifest({ flags: [] });
    const state = initGameState(manifest);
    expect(state.flags).toEqual({});
  });
});

// -- navigate --

describe("navigate", () => {
  it("moves to the target page", () => {
    const page2 = makePage({ id: "page-2" });
    const manifest = makeManifest({
      pages: [makePage({ id: "page-1" }), page2],
    });
    const state = { currentPageId: "page-1", flags: {} };
    const choice = makeChoice({ target: "page-2" });
    const newState = navigate(manifest, state, choice);
    expect(newState.currentPageId).toBe("page-2");
  });

  it("applies choice flag operations", () => {
    const manifest = makeManifest({
      pages: [makePage({ id: "page-1" }), makePage({ id: "page-2" })],
    });
    const state = { currentPageId: "page-1", flags: { "flag-a": false } };
    const choice = makeChoice({
      target: "page-2",
      flag_operations: [{ flag_id: "flag-a", operation: "set_true" }],
    });
    const newState = navigate(manifest, state, choice);
    expect(newState.flags["flag-a"]).toBe(true);
  });

  it("applies target page flag operations after choice flag operations", () => {
    const page2 = makePage({
      id: "page-2",
      flag_operations: [{ flag_id: "flag-b", operation: "set_true" }],
    });
    const manifest = makeManifest({
      pages: [makePage({ id: "page-1" }), page2],
    });
    const state = {
      currentPageId: "page-1",
      flags: { "flag-a": false, "flag-b": false },
    };
    const choice = makeChoice({
      target: "page-2",
      flag_operations: [{ flag_id: "flag-a", operation: "set_true" }],
    });
    const newState = navigate(manifest, state, choice);
    expect(newState.flags["flag-a"]).toBe(true);
    expect(newState.flags["flag-b"]).toBe(true);
  });

  it("is immutable: does not mutate original state", () => {
    const page2 = makePage({ id: "page-2" });
    const manifest = makeManifest({
      pages: [makePage({ id: "page-1" }), page2],
    });
    const state = { currentPageId: "page-1", flags: { "flag-a": false } };
    const choice = makeChoice({
      target: "page-2",
      flag_operations: [{ flag_id: "flag-a", operation: "set_true" }],
    });
    navigate(manifest, state, choice);
    expect(state.currentPageId).toBe("page-1");
    expect(state.flags["flag-a"]).toBe(false);
  });
});
