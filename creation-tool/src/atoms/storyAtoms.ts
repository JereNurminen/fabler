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

export const storyFlagsAtom = atom(async (get) => {
  const story = await get(storyAtom);
  return story?.flags ?? [];
});
