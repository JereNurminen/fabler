/**
 * HTTP API implementation for testing
 * Uses fetch to call the test server instead of Tauri commands
 */

import type { Result } from "./bindings";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

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

const httpApi = {
  // Stories
  getStoryList: () => apiCall<any[]>("/stories"),

  createStory: (name: string) =>
    apiCall<number>("/stories", {
      method: "POST",
      body: JSON.stringify(name),
    }),

  getStory: (id: number) => apiCall<any>(`/stories/${id}`),

  getStoryOutline: (id: number) => apiCall<any>(`/stories/${id}/outline`),

  patchStory: (patch: any) =>
    apiCall<void>("/stories/patch", {
      method: "POST",
      body: JSON.stringify(patch),
    }),

  exportStoryToml: (storyId: number) => apiCall<string>(`/stories/${storyId}/export`),

  getTomlSchema: () => apiCall<string>("/schema"),

  // Pages
  getPage: (id: number) => apiCall<any>(`/pages/${id}`),

  patchPage: (patch: any) =>
    apiCall<void>("/pages/patch", {
      method: "POST",
      body: JSON.stringify(patch),
    }),

  createPage: (storyId: number) =>
    apiCall<number>("/pages", {
      method: "POST",
      body: JSON.stringify(storyId),
    }),

  // Choices
  createChoice: (req: any) =>
    apiCall<number>("/choices", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  deleteChoice: (req: any) =>
    apiCall<void>("/choices/delete", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  patchChoice: (req: any) =>
    apiCall<void>("/choices/patch", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  // Flags
  getStoryFlags: (storyId: number) => apiCall<any[]>(`/stories/${storyId}/flags`),

  createFlag: (flag: any) =>
    apiCall<number>("/flags", {
      method: "POST",
      body: JSON.stringify(flag),
    }),

  patchFlag: (patch: any) =>
    apiCall<void>("/flags/patch", {
      method: "POST",
      body: JSON.stringify(patch),
    }),

  deleteFlag: (id: number) =>
    apiCall<void>(`/flags/${id}`, {
      method: "DELETE",
    }),

  // Flag operations
  setFlagOperation: (req: any) =>
    apiCall<void>("/flags/operation", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  removeFlagOperation: (req: any) =>
    apiCall<void>("/flags/operation/remove", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  getChoiceFlagOperations: (choiceId: number) =>
    apiCall<any[]>(`/flags/operations/choice/${choiceId}`),

  getPageFlagOperations: (pageId: number) =>
    apiCall<any[]>(`/flags/operations/page/${pageId}`),

  // Choice conditions
  setChoiceCondition: (req: any) =>
    apiCall<void>("/flags/condition", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  removeChoiceCondition: (req: any) =>
    apiCall<void>("/flags/condition/remove", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  getChoiceConditions: (choiceId: number) =>
    apiCall<any[]>(`/flags/conditions/${choiceId}`),
};

export default httpApi;
