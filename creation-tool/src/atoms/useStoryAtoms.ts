import { useAtomValue, useSetAtom } from "jotai";
import { storyOutlineAtom, allPagesAtom } from "./storyAtoms";
import {
  loadStoryAtom,
  getPageAtom,
  patchPageAtom,
  createPageAtom,
} from "./storyActions";

export const useStoryAtoms = () => {
  const story = useAtomValue(storyOutlineAtom);
  const pages = useAtomValue(allPagesAtom);

  // Action setters
  const loadStory = useSetAtom(loadStoryAtom);
  const getPage = useSetAtom(getPageAtom);
  const patchPage = useSetAtom(patchPageAtom);
  const createPage = useSetAtom(createPageAtom);

  return {
    story,
    pages,
    loadStory,
    getPage,
    patchPage,
    createPage,
  };
};
