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

export const deletePageAtom = atom(null, async (_get, set, id: string) => {
  await api.deletePage(id);
  pageAtomFamily.remove(id);
  set(refreshAtom, (c) => c + 1);
});

/**
 * Invalidate every currently-cached page atom.
 *
 * For a single-page write, `savePageAtom`/`deletePageAtom` already remove
 * just that page's entry. But some backend operations rewrite a field on
 * every page in one call — auto-arrange's `clear_editor_positions` is the
 * one that exists today — and after that, every page this session has
 * cached is stale, not just whichever ones happen to be on screen. This
 * invalidates the lot so no editor write can later save a stale copy back
 * over a field the backend already changed out from under it.
 *
 * Driven by `pageAtomFamily.getParams()`, which returns the family's
 * currently-instantiated param keys. That's a plain, stable part of
 * jotai-family's `AtomFamily` interface (only `unstable_listen` carries an
 * explicit "may change" caveat) — so this needs no help from `pageListAtom`
 * (which would require an async read from a non-atom call site, and would
 * "invalidate" ids that were never cached in the first place) and no
 * `setShouldRemove` predicate (which is stateful and meant for ongoing
 * eviction policies, not a one-off flush).
 *
 * Copied into an array before removing: `remove()` mutates the family's
 * backing `Map` mid-iteration, which `Map`'s own iterator tolerates for
 * already-produced keys, but there's no reason to depend on that.
 */
export function invalidateAllCachedPages(): void {
  for (const id of [...pageAtomFamily.getParams()]) {
    pageAtomFamily.remove(id);
  }
}
