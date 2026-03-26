import { APIRequestContext, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const API_BASE = "http://127.0.0.1:3001/api";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function importStoryViaApi(
  request: APIRequestContext,
  fixtureName: string = "dark-cave",
): Promise<number> {
  const fixturePath = path.join(__dirname, "fixtures", `${fixtureName}.toml`);
  const tomlContent = fs.readFileSync(fixturePath, "utf-8");

  const response = await request.post(`${API_BASE}/stories/import`, {
    data: tomlContent,
    headers: { "Content-Type": "application/json" },
  });

  const json = await response.json();
  if (json.status !== "ok") {
    throw new Error(`Failed to import story: ${json.error}`);
  }
  return json.data;
}

export async function navigateToStory(page: Page, storyId: number) {
  await page.goto(`/story/${storyId}`, { waitUntil: "networkidle" });
}

export async function navigateToPage(
  page: Page,
  storyId: number,
  pageName: string,
) {
  await navigateToStory(page, storyId);
  await page.getByRole("link", { name: pageName }).click();
  await page.waitForTimeout(300);
}
