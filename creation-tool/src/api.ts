import { commands } from "./bindings";
import httpApi from "./api-http";

// Use HTTP API if VITE_USE_HTTP_API is set (for testing)
const useHttpApi = import.meta.env.VITE_USE_HTTP_API === "true";

const tauriApi = {
  getStoryList: commands.getStories,
  createStory: commands.addStory,
  getStory: commands.getStory,
  getStoryOutline: commands.getStoryOutline,
  patchStory: commands.patchStory,
  exportStoryToml: commands.exportStoryToml,
  importStoryToml: commands.importStoryToml,
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

const api = useHttpApi ? httpApi : tauriApi;

export default api;
export type { Result } from "./bindings";
