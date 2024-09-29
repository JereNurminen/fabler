import { commands } from "./bindings";

const api = {
    getStoryList: commands.getStories,
    createStory: commands.addStory,
    getStory: commands.getStory,
    getPage: commands.getPage,
}

export default api
export type { Result } from "./bindings"
