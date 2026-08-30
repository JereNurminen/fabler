import { describe, it, expect, afterEach } from "vitest";
import { pageAtomFamily } from "../storyAtoms";
import { invalidateAllCachedPages } from "../storyActions";

describe("invalidateAllCachedPages", () => {
  afterEach(() => {
    // pageAtomFamily is a module-level singleton; leave it clean for other
    // test files even if an assertion above fails mid-test.
    for (const id of [...pageAtomFamily.getParams()]) pageAtomFamily.remove(id);
  });

  // Regression test for a real (silent) data-loss bug: auto-arrange's
  // `clear_editor_positions` clears the position on every page in ONE
  // backend call, which makes every page currently cached in
  // `pageAtomFamily` stale at once — not just the ones on screen. Removing
  // only the visible nodes (or nothing at all) leaves every other cached
  // page ready to be written back over its freshly-cleared position by the
  // next ordinary edit, the same silent clobber as the single-page drag
  // bug, just at story-wide scale.
  it("removes every currently cached page atom, not just ones the caller names", () => {
    // Populate the family the way PageCard/PreviewPanel do just by being
    // mounted and reading a page.
    pageAtomFamily("p1");
    pageAtomFamily("p2");
    pageAtomFamily("p3");
    expect([...pageAtomFamily.getParams()].sort()).toEqual(["p1", "p2", "p3"]);

    invalidateAllCachedPages();

    expect([...pageAtomFamily.getParams()]).toEqual([]);
  });

  it("is a no-op when nothing is cached", () => {
    expect([...pageAtomFamily.getParams()]).toEqual([]);
    expect(() => invalidateAllCachedPages()).not.toThrow();
    expect([...pageAtomFamily.getParams()]).toEqual([]);
  });
});
