import { atom } from "jotai";
import { atomFamily } from "jotai-family";
import api from "../api";

export const currentStoryIdAtom = atom<number | null>(null);

export const storyRefreshAtom = atom(0);

export const storyOutlineAtom = atom(async (get) => {
  const storyId = get(currentStoryIdAtom);
  get(storyRefreshAtom);

  if (storyId === null) return null;

  const result = await api.getStoryOutline(storyId);
  if (result.status !== "ok") throw new Error(result.error);

  return result.data;
});

export const pageAtomFamily = atomFamily((pageId: number) =>
  atom(async () => {
    const result = await api.getPage(pageId);
    if (result.status !== "ok") throw new Error(result.error);

    return result.data;
  }),
);

export const allPagesAtom = atom(async (get) => {
  const outline = await get(storyOutlineAtom);
  if (!outline) return [];

  return outline.pages;
});

export const storyFlagsAtom = atom(async (get) => {
  const storyId = get(currentStoryIdAtom);
  get(storyRefreshAtom);

  if (storyId === null) return [];

  const result = await api.getStoryFlags(storyId);
  if (result.status !== "ok") throw new Error(result.error);

  return result.data;
});
