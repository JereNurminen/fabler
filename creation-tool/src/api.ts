import { commands } from "./bindings";

const api = {
  getStoryList: commands.getStories,
  createStory: commands.addStory,
  getStory: commands.getStory,
  getStoryOutline: commands.getStoryOutline,
  getPage: commands.getPage,
  patchPage: commands.patchPage,
  createPage: commands.createPage,
  createChoice: commands.createChoice,
  deleteChoice: commands.deleteChoice,
  patchChoice: commands.patchChoice,
};

export default api;
export type { Result } from "./bindings";
