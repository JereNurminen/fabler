/**
 * HTTP API implementation for testing.
 * Signatures must match the Tauri command bindings in bindings.ts.
 * Field names are converted from camelCase (frontend) to snake_case (Rust server).
 */

import type { Result } from "./bindings";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:3001/api";

async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<Result<T, string>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (data.status === "ok") {
      return { status: "ok", data: data.data };
    } else {
      return { status: "error", error: data.error || "Unknown error" };
    }
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

function post(body: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(body) };
}

const httpApi = {
  // Stories
  getStoryList: () => apiCall<any[]>("/stories"),

  createStory: (name: string) => apiCall<number>("/stories", post(name)),

  getStory: (id: number) => apiCall<any>(`/stories/${id}`),

  getStoryOutline: (id: number) => apiCall<any>(`/stories/${id}/outline`),

  patchStory: (patch: { id: number; title?: string | null; start_page?: number | null }) =>
    apiCall<void>("/stories/patch", post(patch)),

  exportStoryToml: (storyId: number) => apiCall<string>(`/stories/${storyId}/export`),

  exportStoryBundle: (storyId: number) => apiCall<number[]>(`/stories/${storyId}/export-bundle`),

  importStoryToml: (tomlContent: string) => apiCall<number>("/stories/import", post(tomlContent)),

  getTomlSchema: () => apiCall<string>("/schema"),

  // Pages
  getPage: (id: number) => apiCall<any>(`/pages/${id}`),

  patchPage: (patch: { id: number; name?: string | null; body?: string | null }) =>
    apiCall<void>("/pages/patch", post(patch)),

  createPage: (storyId: number) => apiCall<number>("/pages", post(storyId)),

  // Choices — Tauri binding: createChoice(pageId, text, targetPageId)
  createChoice: (pageId: number, text: string, targetPageId: number) =>
    apiCall<number>("/choices", post({
      page_id: pageId,
      text,
      target_page_id: targetPageId,
    })),

  // Tauri binding: deleteChoice(id)
  deleteChoice: (id: number) =>
    apiCall<void>("/choices/delete", post({ id })),

  // Tauri binding: patchChoice(patch: ChoicePatch)
  patchChoice: (patch: { id: number; text?: string | null; target_page?: number | null }) =>
    apiCall<void>("/choices/patch", post(patch)),

  // Flags
  getStoryFlags: (storyId: number) => apiCall<any[]>(`/stories/${storyId}/flags`),

  // Tauri binding: createFlag(create: CreateFlag)
  createFlag: (create: { story_id: number; name: string; default_value: boolean }) =>
    apiCall<number>("/flags", post(create)),

  // Tauri binding: patchFlag(patch: FlagPatch)
  patchFlag: (patch: { id: number; name?: string | null; default_value?: boolean | null }) =>
    apiCall<void>("/flags/patch", post(patch)),

  deleteFlag: (id: number) =>
    apiCall<void>(`/flags/${id}`, { method: "DELETE" }),

  // Flag operations — Tauri binding: setFlagOperation(op: SetFlagOperation)
  setFlagOperation: (op: { choice_id: number | null; page_id: number | null; flag_id: number; operation: string }) =>
    apiCall<number>("/flags/operation", post(op)),

  // Tauri binding: removeFlagOperation(choiceId, pageId, flagId)
  removeFlagOperation: (choiceId: number | null, pageId: number | null, flagId: number) =>
    apiCall<void>("/flags/operation/remove", post({
      choice_id: choiceId,
      page_id: pageId,
      flag_id: flagId,
    })),

  getChoiceFlagOperations: (choiceId: number) =>
    apiCall<any[]>(`/flags/operations/choice/${choiceId}`),

  getPageFlagOperations: (pageId: number) =>
    apiCall<any[]>(`/flags/operations/page/${pageId}`),

  // Choice conditions — Tauri binding: setChoiceCondition(cond: SetChoiceCondition)
  setChoiceCondition: (cond: { choice_id: number; flag_id: number; required_value: boolean }) =>
    apiCall<number>("/flags/condition", post(cond)),

  // Tauri binding: removeChoiceCondition(choiceId, flagId)
  removeChoiceCondition: (choiceId: number, flagId: number) =>
    apiCall<void>("/flags/condition/remove", post({
      choice_id: choiceId,
      flag_id: flagId,
    })),

  getChoiceConditions: (choiceId: number) =>
    apiCall<any[]>(`/flags/conditions/${choiceId}`),
};

export default httpApi;
