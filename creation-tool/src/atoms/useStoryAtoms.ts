import { useAtomValue, useSetAtom } from "jotai";
import { storyOutlineAtom, allPagesAtom, storyFlagsAtom } from "./storyAtoms";
import {
  loadStoryAtom,
  getPageAtom,
  patchPageAtom,
  createPageAtom,
  createChoiceAtom,
  deleteChoiceAtom,
  patchChoiceAtom,
  patchStoryAtom,
  createFlagAtom,
  patchFlagAtom,
  deleteFlagAtom,
  setFlagOperationAtom,
  removeFlagOperationAtom,
  setChoiceConditionAtom,
  removeChoiceConditionAtom,
} from "./storyActions";

export const useStoryAtoms = () => {
  const story = useAtomValue(storyOutlineAtom);
  const pages = useAtomValue(allPagesAtom);
  const flags = useAtomValue(storyFlagsAtom);

  // Action setters
  const loadStory = useSetAtom(loadStoryAtom);
  const getPage = useSetAtom(getPageAtom);
  const patchPage = useSetAtom(patchPageAtom);
  const createPage = useSetAtom(createPageAtom);
  const createChoice = useSetAtom(createChoiceAtom);
  const deleteChoice = useSetAtom(deleteChoiceAtom);
  const patchChoice = useSetAtom(patchChoiceAtom);
  const patchStory = useSetAtom(patchStoryAtom);

  // Flag action setters
  const createFlag = useSetAtom(createFlagAtom);
  const patchFlag = useSetAtom(patchFlagAtom);
  const deleteFlag = useSetAtom(deleteFlagAtom);
  const setFlagOperation = useSetAtom(setFlagOperationAtom);
  const removeFlagOperation = useSetAtom(removeFlagOperationAtom);
  const setChoiceCondition = useSetAtom(setChoiceConditionAtom);
  const removeChoiceCondition = useSetAtom(removeChoiceConditionAtom);

  return {
    story,
    pages,
    flags,
    loadStory,
    getPage,
    patchPage,
    createPage,
    createChoice,
    deleteChoice,
    patchChoice,
    patchStory,
    createFlag,
    patchFlag,
    deleteFlag,
    setFlagOperation,
    removeFlagOperation,
    setChoiceCondition,
    removeChoiceCondition,
  };
};
