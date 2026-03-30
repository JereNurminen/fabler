import { atom } from "jotai";
import { atomFamily } from "jotai-family";
import api from "../api";

export const projectOpenAtom = atom(false);
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

export const pageAtomFamily = atomFamily((pageId: string) =>
  atom(async () => {
    return api.getPage(pageId);
  }),
);

export const storyFlagsAtom = atom(async (get) => {
  const story = await get(storyAtom);
  return story?.flags ?? [];
});
