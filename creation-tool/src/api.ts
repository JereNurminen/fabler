import { commands } from "./bindings";

const api = {
  getStoryList: commands.getStories,
  createStory: commands.addStory,
  getStory: commands.getStory,
  getStoryOutline: commands.getStoryOutline,
  patchStory: commands.patchStory,
  exportStoryToml: commands.exportStoryToml,
  getTomlSchema: commands.getTomlSchema,
  getPage: commands.getPage,
  patchPage: commands.patchPage,
  createPage: commands.createPage,
  createChoice: commands.createChoice,
  deleteChoice: commands.deleteChoice,
  patchChoice: commands.patchChoice,
  // Flag CRUD
  getStoryFlags: commands.getStoryFlags,
  createFlag: commands.createFlag,
  patchFlag: commands.patchFlag,
  deleteFlag: commands.deleteFlag,
  // Flag operations
  setFlagOperation: commands.setFlagOperation,
  removeFlagOperation: commands.removeFlagOperation,
  getChoiceFlagOperations: commands.getChoiceFlagOperations,
  getPageFlagOperations: commands.getPageFlagOperations,
  // Choice conditions
  setChoiceCondition: commands.setChoiceCondition,
  removeChoiceCondition: commands.removeChoiceCondition,
  getChoiceConditions: commands.getChoiceConditions,
};

export default api;
export type { Result } from "./bindings";
