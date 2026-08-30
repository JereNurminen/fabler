import { atom } from "jotai";
import { atomFamily } from "jotai-family";
import api from "../api";

// In HTTP test mode, the project is always open on the server
const isTestMode = import.meta.env.VITE_USE_HTTP_API === "true";
export const projectOpenAtom = atom(isTestMode);
export const refreshAtom = atom(0);

export const storyAtom = atom(async (get) => {
  if (!get(projectOpenAtom)) return null;
  get(refreshAtom);
  return api.getStory();
});

export const pageListAtom = atom(async (get) => {
  if (!get(projectOpenAtom)) return [];
  get(refreshAtom);
  return api.listPages();
});

export const trashedPageListAtom = atom(async (get) => {
  if (!get(projectOpenAtom)) return [];
  get(refreshAtom);
  return api.listTrashedPages();
});

export const validationAtom = atom(async (get) => {
  if (!get(projectOpenAtom)) return { problems: [] };
  get(refreshAtom);
  return api.validateStory();
});

export const pageAtomFamily = atomFamily((pageId: string) =>
  atom(async () => {
    return api.getPage(pageId);
  }),
);

/**
 * Full trashed pages, for the read-only view.
 *
 * A separate family from `pageAtomFamily` rather than a flag on it: the two
 * are fetched by different commands (`get_page` vs `get_trashed_page`), and
 * keeping them apart means a stale live copy can never be served for a page
 * that has since been trashed.
 */
export const trashedPageAtomFamily = atomFamily((pageId: string) =>
  atom(async () => {
    return api.getTrashedPage(pageId);
  }),
);

export const storyFlagsAtom = atom(async (get) => {
  const story = await get(storyAtom);
  return story?.flags ?? [];
});
