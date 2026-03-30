import { invoke } from "@tauri-apps/api/core";
import type { Story, Page, PageListItem } from "./types";

const api = {
  openProject: (path: string) =>
    invoke<Story>("open_project", { path }),

  createProject: (path: string, title: string) =>
    invoke<Story>("create_project", { path, title }),

  closeProject: () =>
    invoke<void>("close_project"),

  getStory: () =>
    invoke<Story>("get_story"),

  saveStory: (story: Story) =>
    invoke<void>("save_story", { story }),

  listPages: () =>
    invoke<PageListItem[]>("list_pages"),

  getPage: (id: string) =>
    invoke<Page>("get_page", { id }),

  savePage: (page: Page) =>
    invoke<void>("save_page", { page }),

  createPage: (name: string) =>
    invoke<Page>("create_page", { name }),

  deletePage: (id: string) =>
    invoke<void>("delete_page", { id }),

  exportBundle: (outputPath: string) =>
    invoke<void>("export_bundle", { outputPath }),
};

export default api;
