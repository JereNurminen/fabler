import { atom } from "jotai";
import api from "../api";
import type { Story, Page } from "@fabler/types";
import { projectOpenAtom, refreshAtom, pageAtomFamily } from "./storyAtoms";

export const openProjectAtom = atom(null, async (_get, set, path: string) => {
  const story = await api.openProject(path);
  set(projectOpenAtom, true);
  set(refreshAtom, (c) => c + 1);
  return story;
});

export const createProjectAtom = atom(
  null,
  async (_get, set, args: { path: string; title: string }) => {
    const story = await api.createProject(args.path, args.title);
    set(projectOpenAtom, true);
    set(refreshAtom, (c) => c + 1);
    return story;
  },
);

export const closeProjectAtom = atom(null, async (_get, set) => {
  await api.closeProject();
  set(projectOpenAtom, false);
});

export const saveStoryAtom = atom(null, async (_get, set, story: Story) => {
  await api.saveStory(story);
  set(refreshAtom, (c) => c + 1);
});

export const savePageAtom = atom(null, async (_get, set, page: Page) => {
  await api.savePage(page);
  pageAtomFamily.remove(page.id);
  set(refreshAtom, (c) => c + 1);
});

export const createPageAtom = atom(null, async (_get, set, name: string) => {
  const page = await api.createPage(name);
  set(refreshAtom, (c) => c + 1);
  return page;
});

/**
 * Invalidate every currently-cached page atom, then force mounted consumers
 * to re-read.
 *
 * For a single-page write, `savePageAtom`/`trashPageAtom` already handle
 * just that page. But some backend operations rewrite a field on every page
 * in one call — auto-arrange's `clear_editor_positions` is the one that
 * exists today — and after that, every page this session has cached is
 * stale, not just whichever ones happen to be on screen. This invalidates
 * the lot so no editor write can later save a stale copy back over a field
 * the backend already changed out from under it.
 *
 * BOTH halves are load-bearing, and the second one is the one that actually
 * moves the needle. `pageAtomFamily.remove()` only drops the family's
 * cached entry; a component that is already mounted still holds the old
 * atom instance, so removing the entry on its own changes nothing on
 * screen. What forces the re-read is bumping `refreshAtom`: that recomputes
 * `pageListAtom`, which `PageCard` subscribes to, which re-renders it, and
 * only then does it ask the family for the page again — getting a fresh
 * atom because the stale entry was removed. Drop the `refreshAtom` bump and
 * this function silently does nothing for a mounted editor.
 *
 * A write-atom (rather than a plain function) for exactly that reason: the
 * bump needs a store to write to, and this is the same shape as every other
 * mutation in this file, so there is one idiom to learn instead of two.
 *
 * The removal loop is driven by `pageAtomFamily.getParams()`, which returns
 * the family's currently-instantiated param keys. That's a plain, stable
 * part of jotai-family's `AtomFamily` interface (only `unstable_listen`
 * carries an explicit "may change" caveat) — so this needs no help from
 * `pageListAtom` (which would require an async read, and would "invalidate"
 * ids that were never cached in the first place) and no `setShouldRemove`
 * predicate (which is stateful and meant for ongoing eviction policies, not
 * a one-off flush).
 *
 * Params are copied into an array before removing: `remove()` mutates the
 * family's backing `Map` mid-iteration, which `Map`'s own iterator tolerates
 * for already-produced keys, but there's no reason to depend on that.
 */
export const invalidateAllCachedPagesAtom = atom(null, (_get, set) => {
  for (const id of [...pageAtomFamily.getParams()]) {
    pageAtomFamily.remove(id);
  }
  set(refreshAtom, (c) => c + 1);
});
