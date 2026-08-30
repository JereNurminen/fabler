import type { Story, Page, PageListItem } from "./types";

const useHttpApi = import.meta.env.VITE_USE_HTTP_API === "true";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function buildHttpApi() {
  const API_BASE =
    import.meta.env.VITE_API_URL || "http://127.0.0.1:3001/api";
  return {
    openProject: async (_path: string) =>
      fetchJson<Story>(`${API_BASE}/story`),
    createProject: async (_path: string, _title: string) => {
      await fetchJson(`${API_BASE}/test/reset`, { method: "POST" });
      return fetchJson<Story>(`${API_BASE}/story`);
    },
    closeProject: async () => {},
    getStory: () => fetchJson<Story>(`${API_BASE}/story`),
    saveStory: (story: Story) =>
      fetchJson<void>(`${API_BASE}/story`, {
        method: "POST",
        body: JSON.stringify(story),
      }),
    listPages: () => fetchJson<PageListItem[]>(`${API_BASE}/pages`),
    getPage: (id: string) => fetchJson<Page>(`${API_BASE}/pages/${id}`),
    savePage: (page: Page) =>
      fetchJson<void>(`${API_BASE}/pages/${page.id}`, {
        method: "POST",
        body: JSON.stringify(page),
      }),
    createPage: (name: string) =>
      fetchJson<Page>(`${API_BASE}/pages`, {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    deletePage: (id: string) =>
      fetchJson<void>(`${API_BASE}/pages/${id}`, { method: "DELETE" }),
    exportBundle: async (_outputPath: string) => {},
    copyAsset: async (_sourcePath: string) => "test-asset.png" as string,
    getProjectAssetsDir: async () => "/tmp/fabler-test-project/assets",
    listAssets: () => fetchJson<string[]>(`${API_BASE}/assets`),
    deleteAsset: async (_filename: string) => {},
    readAssetBase64: async (_filename: string) => "" as string,
  };
}

function buildTauriApi() {
  // Import invoke lazily to avoid errors when not in Tauri context
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
    copyAsset: (sourcePath: string) =>
      invoke<string>("copy_asset", { sourcePath }),
    getProjectAssetsDir: () => invoke<string>("get_project_assets_dir"),
    listAssets: () => invoke<string[]>("list_assets"),
    deleteAsset: (filename: string) =>
      invoke<void>("delete_asset", { filename }),
    readAssetBase64: (filename: string) =>
      invoke<string>("read_asset_base64", { filename }),
  };
}

const api = useHttpApi ? buildHttpApi() : buildTauriApi();

export default api;
