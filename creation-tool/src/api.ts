import { invoke } from "@tauri-apps/api/core";
import type { Story, Page, PageListItem } from "./types";

const api = {
  openProject: (storyJsonPath: string) =>
    invoke<Story>("open_project", { storyJsonPath }),

  createProject: (dirPath: string, title: string) =>
    invoke<Story>("create_project", { dirPath, title }),

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

  copyAsset: (sourcePath: string) =>
    invoke<string>("copy_asset", { sourcePath }),

  getProjectAssetsDir: () =>
    invoke<string>("get_project_assets_dir"),
};

export default api;
