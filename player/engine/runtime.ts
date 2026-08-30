import type {
  FlagState,
  GameState,
  Manifest,
  Choice,
  Condition,
  FlagOperation,
  Page,
} from "./types";

export function evaluateConditions(
  conditions: Condition[],
  flags: FlagState,
): boolean {
  // AND logic: all conditions must be met
  // Missing flags treated as false
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(
    (c) => (flags[c.flag_id] ?? false) === c.required_value,
  );
}

export function applyFlagOperations(
  operations: FlagOperation[],
  flags: FlagState,
): FlagState {
  // Returns NEW state (immutable). Supports set_true, set_false, toggle
  if (!operations || operations.length === 0) return flags;
  const result = { ...flags };
  for (const op of operations) {
    const current = result[op.flag_id] ?? false;
    switch (op.operation) {
      case "set_true":
        result[op.flag_id] = true;
        break;
      case "set_false":
        result[op.flag_id] = false;
        break;
      case "toggle":
        result[op.flag_id] = !current;
        break;
    }
  }
  return result;
}

export function getAvailableChoices(
  page: Page,
  flags: FlagState,
): Choice[] {
  return (page.choices || []).filter((c) => evaluateConditions(c.conditions, flags));
}

export function initGameState(manifest: Manifest): GameState {
  const flags: FlagState = {};
  for (const flag of manifest.flags) {
    flags[flag.id] = flag.default_value;
  }
  return {
    currentPageId: manifest.story.start_page,
    flags,
  };
}

/**
 * Outcome of attempting a choice. A choice whose target page is missing from
 * the manifest (typically a page deleted after the choice was authored) fails
 * rather than moving, so the caller can report it and let the reader pick
 * something else.
 */
export type NavigationResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: "missing-target"; target: string };

export function navigate(
  manifest: Manifest,
  state: GameState,
  choice: Choice,
): NavigationResult {
  const targetPage = manifest.pages.find((p) => p.id === choice.target);
  if (!targetPage) {
    // Do not commit a page id that isn't in the manifest: the player would
    // render a "page not found" screen with no choices and no way back,
    // ending the story. Failing atomically — without applying the choice's
    // flag operations — leaves the reader on a page they can still act from.
    return { ok: false, reason: "missing-target", target: choice.target };
  }

  // Choice operations run first, then the target page's.
  let flags = applyFlagOperations(choice.flag_operations || [], state.flags);
  flags = applyFlagOperations(targetPage.flag_operations || [], flags);
  return { ok: true, state: { currentPageId: choice.target, flags } };
}
