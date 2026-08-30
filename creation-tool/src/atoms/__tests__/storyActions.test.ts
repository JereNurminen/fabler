import { describe, it, expect, afterEach, vi } from "vitest";
import { createStore } from "jotai";
import { pageAtomFamily, refreshAtom, trashedPageAtomFamily } from "../storyAtoms";
import {
  invalidateAllCachedPagesAtom,
  trashPageAtom,
  restorePageAtom,
  deleteTrashedPageAtom,
  emptyTrashAtom,
} from "../storyActions";
import api from "../../api";

vi.mock("../../api", () => ({
  default: {
    trashPage: vi.fn().mockResolvedValue(undefined),
    restorePage: vi.fn().mockResolvedValue(undefined),
    deleteTrashedPage: vi.fn().mockResolvedValue(undefined),
    emptyTrash: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("invalidateAllCachedPagesAtom", () => {
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

    createStore().set(invalidateAllCachedPagesAtom);

    expect([...pageAtomFamily.getParams()]).toEqual([]);
  });

  it("is a no-op when nothing is cached", () => {
    expect([...pageAtomFamily.getParams()]).toEqual([]);
    expect(() => createStore().set(invalidateAllCachedPagesAtom)).not.toThrow();
    expect([...pageAtomFamily.getParams()]).toEqual([]);
  });
});

describe("invalidateAllCachedPagesAtom refresh signal", () => {
  // The half that actually reaches the screen. `pageAtomFamily.remove()` is
  // inert for an already-mounted PageCard — it keeps holding the old atom
  // instance — so removing family entries alone invalidates nothing the
  // author can see. Bumping `refreshAtom` is what recomputes `pageListAtom`,
  // re-renders PageCard, and makes it mint a fresh family atom. Assert the
  // signal, not just the removal, or a future edit can quietly drop the bump
  // and leave every existing test green while auto-arrange's cleared
  // positions get clobbered by the next ordinary edit.
  it("bumps refreshAtom so a mounted PageCard actually re-reads", () => {
    const store = createStore();
    const before = store.get(refreshAtom);

    store.set(invalidateAllCachedPagesAtom);

    expect(store.get(refreshAtom)).toBe(before + 1);
  });

  it("bumps the signal even when no page was cached", () => {
    // Nothing to remove is not the same as nothing to do: a PageCard can be
    // mounted and holding a page it read before the family was last flushed.
    const store = createStore();
    expect([...pageAtomFamily.getParams()]).toEqual([]);

    store.set(invalidateAllCachedPagesAtom);

    expect(store.get(refreshAtom)).toBe(1);
  });
});

describe("trash write atoms", () => {
  afterEach(() => {
    for (const id of [...pageAtomFamily.getParams()]) pageAtomFamily.remove(id);
    for (const id of [...trashedPageAtomFamily.getParams()]) trashedPageAtomFamily.remove(id);
    vi.clearAllMocks();
  });

  it("trashing a page invalidates both page families and refreshes", async () => {
    const store = createStore();
    pageAtomFamily("a1b2c");
    trashedPageAtomFamily("a1b2c");

    await store.set(trashPageAtom, "a1b2c");

    expect(api.trashPage).toHaveBeenCalledWith("a1b2c");
    // A page moves BETWEEN the two families and can round-trip, so both the
    // live entry and any stale trashed entry must go — invalidating only the
    // source family leaves the other holding a copy from the last visit.
    expect(pageAtomFamily.getParams()).not.toContain("a1b2c");
    expect(trashedPageAtomFamily.getParams()).not.toContain("a1b2c");
    expect(store.get(refreshAtom)).toBeGreaterThan(0);
  });

  it("restoring a page invalidates both page families and refreshes", async () => {
    const store = createStore();
    pageAtomFamily("a1b2c");
    trashedPageAtomFamily("a1b2c");

    await store.set(restorePageAtom, "a1b2c");

    expect(api.restorePage).toHaveBeenCalledWith("a1b2c");
    expect(pageAtomFamily.getParams()).not.toContain("a1b2c");
    expect(trashedPageAtomFamily.getParams()).not.toContain("a1b2c");
    expect(store.get(refreshAtom)).toBeGreaterThan(0);
  });

  it("permanently deleting a trashed page invalidates and refreshes", async () => {
    const store = createStore();
    trashedPageAtomFamily("a1b2c");

    await store.set(deleteTrashedPageAtom, "a1b2c");

    expect(api.deleteTrashedPage).toHaveBeenCalledWith("a1b2c");
    expect(trashedPageAtomFamily.getParams()).not.toContain("a1b2c");
    expect(store.get(refreshAtom)).toBeGreaterThan(0);
  });

  it("emptying the trash clears every cached trashed page", async () => {
    const store = createStore();
    // Instantiate two family entries so the flush has something to remove.
    trashedPageAtomFamily("a1b2c");
    trashedPageAtomFamily("d4e5f");

    await store.set(emptyTrashAtom);

    expect(api.emptyTrash).toHaveBeenCalled();
    expect([...trashedPageAtomFamily.getParams()]).toHaveLength(0);
    expect(store.get(refreshAtom)).toBeGreaterThan(0);
  });
});
