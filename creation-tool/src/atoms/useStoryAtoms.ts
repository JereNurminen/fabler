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
  deletePageAtom,
} from "./storyActions";

export const useStoryAtoms = () => {
  const story = useAtomValue(storyAtom);
  const pages = useAtomValue(pageListAtom);
  const flags = useAtomValue(storyFlagsAtom);
  const problems = useAtomValue(validationAtom).problems;

  const openProject = useSetAtom(openProjectAtom);
  const createProject = useSetAtom(createProjectAtom);
  const closeProject = useSetAtom(closeProjectAtom);
  const saveStory = useSetAtom(saveStoryAtom);
  const savePage = useSetAtom(savePageAtom);
  const createPage = useSetAtom(createPageAtom);
  const deletePage = useSetAtom(deletePageAtom);

  return {
    story,
    pages,
    flags,
    problems,
    openProject,
    createProject,
    closeProject,
    saveStory,
    savePage,
    createPage,
    deletePage,
  };
};
