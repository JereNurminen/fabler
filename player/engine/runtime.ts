import type {
  FlagState,
  GameState,
  Manifest,
  ManifestChoice,
  ManifestCondition,
  ManifestFlagOperation,
  ManifestPage,
} from "./types";

export function evaluateConditions(
  conditions: ManifestCondition[],
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
  operations: ManifestFlagOperation[],
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
  page: ManifestPage,
  flags: FlagState,
): ManifestChoice[] {
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

export function navigate(
  manifest: Manifest,
  state: GameState,
  choice: ManifestChoice,
): GameState {
  // Apply choice flag operations first, then target page flag operations
  let flags = applyFlagOperations(choice.flag_operations || [], state.flags);
  const targetPage = manifest.pages.find((p) => p.id === choice.target);
  if (targetPage) {
    flags = applyFlagOperations(targetPage.flag_operations || [], flags);
  }
  return { currentPageId: choice.target, flags };
}
