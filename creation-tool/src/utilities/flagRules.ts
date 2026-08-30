/**
 * Flag operations and choice conditions are both keyed by `flag_id`, and both
 * allow at most one rule per flag. These two helpers were previously inlined
 * across six near-identical handlers in PageCard.
 */

/** Add a rule, replacing any existing rule for the same flag. */
export function upsertFlagRule<T extends { flag_id: string }>(
  list: T[],
  rule: T,
): T[] {
  return [...list.filter((r) => r.flag_id !== rule.flag_id), rule];
}

/** Drop the rule for a flag, if there is one. */
export function removeFlagRule<T extends { flag_id: string }>(
  list: T[],
  flagId: string,
): T[] {
  return list.filter((r) => r.flag_id !== flagId);
}
