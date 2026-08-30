import { useAtomValue, useSetAtom } from "jotai";
import {
  storyAtom,
  pageListAtom,
  storyFlagsAtom,
  validationAtom,
} from "./storyAtoms";
import {
  openProjectAtom,
  createProjectAtom,
  closeProjectAtom,
  saveStoryAtom,
  savePageAtom,
  createPageAtom,
} from "./storyActions";

export const useStoryAtoms = () => {
  const story = useAtomValue(storyAtom);
  const pages = useAtomValue(pageListAtom);
  const flags = useAtomValue(storyFlagsAtom);

  const openProject = useSetAtom(openProjectAtom);
  const createProject = useSetAtom(createProjectAtom);
  const closeProject = useSetAtom(closeProjectAtom);
  const saveStory = useSetAtom(saveStoryAtom);
  const savePage = useSetAtom(savePageAtom);
  const createPage = useSetAtom(createPageAtom);

  return {
    story,
    pages,
    flags,
    openProject,
    createProject,
    closeProject,
    saveStory,
    savePage,
    createPage,
  };
};

/**
 * Reads the live validation report on its own, so consumers that don't need
 * it (most of `useStoryAtoms`'s callers) don't suspend on a full
 * re-validation — which re-reads every page file — after every mutation.
 */
export const useValidation = () => {
  const problems = useAtomValue(validationAtom).problems;
  return { problems };
};
