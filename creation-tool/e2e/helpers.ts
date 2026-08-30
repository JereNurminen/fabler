import { APIRequestContext, Page } from "@playwright/test";

const API_BASE = "http://127.0.0.1:3001/api";

async function invoke<T = any>(request: APIRequestContext, cmd: string, args: Record<string, any> = {}): Promise<T> {
  const response = await request.post(`${API_BASE}/invoke`, {
    data: JSON.stringify({ cmd, args }),
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok()) {
    throw new Error(`invoke ${cmd} failed: ${response.status()}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function resetProject(request: APIRequestContext): Promise<void> {
  await invoke(request, "test_reset");
}

export async function getStory(request: APIRequestContext) {
  return invoke(request, "get_story");
}

export async function createPageViaApi(request: APIRequestContext, name: string) {
  return invoke(request, "create_page", { name });
}

export async function getPageViaApi(request: APIRequestContext, id: string) {
  return invoke(request, "get_page", { id });
}

export async function savePageViaApi(request: APIRequestContext, page: any) {
  await invoke(request, "save_page", { page });
}

export async function saveStoryViaApi(request: APIRequestContext, story: any) {
  await invoke(request, "save_story", { story });
}

export async function listPagesViaApi(request: APIRequestContext) {
  return invoke<any[]>(request, "list_pages");
}

export async function navigateToEditor(page: Page) {
  await page.goto("/editor", { waitUntil: "networkidle" });
}

export async function navigateToPage(page: Page, pageId: string) {
  await page.goto(`/editor/page/${pageId}`, { waitUntil: "networkidle" });
}
