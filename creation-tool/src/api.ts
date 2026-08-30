import type { Story, Page, PageListItem, Report, StoryGraph } from "@fabler/types";

const useHttpApi = import.meta.env.VITE_USE_HTTP_API === "true";

function buildHttpApi() {
  const API_BASE =
    import.meta.env.VITE_API_URL || "http://127.0.0.1:3001/api";

  async function call<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(`${API_BASE}/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd, args }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  return {
    openProject: (_path: string) => call<Story>("get_story"),
    createProject: async (_path: string, _title: string) => {
      await call("test_reset");
      return call<Story>("get_story");
    },
    closeProject: async () => {},
    getStory: () => call<Story>("get_story"),
    saveStory: (story: Story) => call<void>("save_story", { story }),
    listPages: () => call<PageListItem[]>("list_pages"),
    getPage: (id: string) => call<Page>("get_page", { id }),
    savePage: (page: Page) => call<void>("save_page", { page }),
    createPage: (name: string) => call<Page>("create_page", { name }),
    deletePage: (id: string) => call<void>("delete_page", { id }),
    exportBundle: (_outputPath: string) => call<void>("export_bundle"),
    validateStory: () => call<Report>("validate_story"),
    getStoryGraph: () => call<StoryGraph>("get_story_graph"),
    copyAsset: async (_sourcePath: string) => "test-asset.png" as string,
    getProjectAssetsDir: () => call<string>("get_project_assets_dir"),
    listAssets: () => call<string[]>("list_assets"),
    deleteAsset: (filename: string) => call<void>("delete_asset", { filename }),
  };
}

function buildTauriApi() {
  const invoke = async <T>(
    cmd: string,
    args?: Record<string, unknown>,
  ): Promise<T> => {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(cmd, args);
  };
  return {
    openProject: (storyJsonPath: string) =>
      invoke<Story>("open_project", { storyJsonPath }),
    createProject: (dirPath: string, title: string) =>
      invoke<Story>("create_project", { dirPath, title }),
    closeProject: () => invoke<void>("close_project"),
    getStory: () => invoke<Story>("get_story"),
    saveStory: (story: Story) => invoke<void>("save_story", { story }),
    listPages: () => invoke<PageListItem[]>("list_pages"),
    getPage: (id: string) => invoke<Page>("get_page", { id }),
    savePage: (page: Page) => invoke<void>("save_page", { page }),
    createPage: (name: string) => invoke<Page>("create_page", { name }),
    deletePage: (id: string) => invoke<void>("delete_page", { id }),
    exportBundle: (outputPath: string) =>
      invoke<void>("export_bundle", { outputPath }),
    validateStory: () => invoke<Report>("validate_story"),
    getStoryGraph: () => invoke<StoryGraph>("get_story_graph"),
    copyAsset: (sourcePath: string) =>
      invoke<string>("copy_asset", { sourcePath }),
    getProjectAssetsDir: () => invoke<string>("get_project_assets_dir"),
    listAssets: () => invoke<string[]>("list_assets"),
    deleteAsset: (filename: string) =>
      invoke<void>("delete_asset", { filename }),
  };
}

const api = useHttpApi ? buildHttpApi() : buildTauriApi();

export default api;
