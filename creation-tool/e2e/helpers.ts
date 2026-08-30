import { APIRequestContext, Page } from "@playwright/test";

const API_BASE = "http://127.0.0.1:3001/api";

export async function resetProject(request: APIRequestContext): Promise<void> {
  await request.post(`${API_BASE}/test/reset`);
}

export async function getStory(request: APIRequestContext) {
  const response = await request.get(`${API_BASE}/story`);
  return response.json();
}

export async function createPageViaApi(
  request: APIRequestContext,
  name: string,
) {
  const response = await request.post(`${API_BASE}/pages`, {
    data: JSON.stringify({ name }),
    headers: { "Content-Type": "application/json" },
  });
  return response.json();
}

export async function getPageViaApi(
  request: APIRequestContext,
  id: string,
) {
  const response = await request.get(`${API_BASE}/pages/${id}`);
  return response.json();
}

export async function savePageViaApi(
  request: APIRequestContext,
  page: any,
) {
  await request.post(`${API_BASE}/pages/${page.id}`, {
    data: JSON.stringify(page),
    headers: { "Content-Type": "application/json" },
  });
}

export async function saveStoryViaApi(
  request: APIRequestContext,
  story: any,
) {
  await request.post(`${API_BASE}/story`, {
    data: JSON.stringify(story),
    headers: { "Content-Type": "application/json" },
  });
}

export async function navigateToEditor(page: Page) {
  await page.goto("/editor", { waitUntil: "networkidle" });
}

export async function navigateToPage(page: Page, pageId: string) {
  await page.goto(`/editor/page/${pageId}`, { waitUntil: "networkidle" });
}

export async function listPagesViaApi(request: APIRequestContext) {
  const response = await request.get(`${API_BASE}/pages`);
  return response.json();
}
