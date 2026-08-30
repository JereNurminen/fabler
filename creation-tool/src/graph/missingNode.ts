/**
 * Prefix for the synthetic node id standing in for a dangling edge's
 * (nonexistent) target. Namespaced so it can never collide with a real
 * page id, and checked by `usePositionPersistence` to skip persisting a
 * drag of a stub that has no backing page.
 *
 * Lives in its own module (rather than in `StoryGraphView.tsx`, which is
 * where it is re-exported from) so that `usePositionPersistence.ts` can
 * import it without a circular dependency between the two files.
 */
export const MISSING_NODE_PREFIX = "missing:";

/** The synthetic node id standing in for a dangling edge's missing target. */
export function missingNodeId(target: string): string {
  return `${MISSING_NODE_PREFIX}${target}`;
}
