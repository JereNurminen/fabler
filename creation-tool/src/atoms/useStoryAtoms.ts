import { useAtomValue, useSetAtom } from "jotai";
import { storyOutlineAtom, allPagesAtom } from "./storyAtoms";
import {
  loadStoryAtom,
  getPageAtom,
  patchPageAtom,
  createPageAtom,
  createChoiceAtom,
  deleteChoiceAtom,
  patchChoiceAtom,
  patchStoryAtom,
} from "./storyActions";

export const useStoryAtoms = () => {
  const story = useAtomValue(storyOutlineAtom);
  const pages = useAtomValue(allPagesAtom);

  // Action setters
  const loadStory = useSetAtom(loadStoryAtom);
  const getPage = useSetAtom(getPageAtom);
  const patchPage = useSetAtom(patchPageAtom);
  const createPage = useSetAtom(createPageAtom);
  const createChoice = useSetAtom(createChoiceAtom);
  const deleteChoice = useSetAtom(deleteChoiceAtom);
  const patchChoice = useSetAtom(patchChoiceAtom);
  const patchStory = useSetAtom(patchStoryAtom);

  return {
    story,
    pages,
    loadStory,
    getPage,
    patchPage,
    createPage,
    createChoice,
    deleteChoice,
    patchChoice,
    patchStory,
  };
};
