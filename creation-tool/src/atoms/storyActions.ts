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
