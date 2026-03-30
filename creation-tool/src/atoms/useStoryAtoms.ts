import { useAtomValue, useSetAtom } from "jotai";
import { storyAtom, pageListAtom, storyFlagsAtom } from "./storyAtoms";
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
    openProject,
    createProject,
    closeProject,
    saveStory,
    savePage,
    createPage,
    deletePage,
  };
};
