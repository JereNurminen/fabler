import { atom } from "jotai";
import api from "../api";
import {
  currentStoryIdAtom,
  pageAtomFamily,
  storyRefreshAtom,
} from "./storyAtoms";
import type {
  PagePatch,
  ChoicePatch,
  CreateFlag,
  FlagPatch,
  SetFlagOperation,
  SetChoiceCondition,
} from "../bindings";

export const loadStoryAtom = atom(null, (_get, set, storyId: number) => {
  set(currentStoryIdAtom, storyId);
});

export const getPageAtom = atom(null, (_get, _set, pageId: number) => {
  return pageAtomFamily(pageId);
});

export const patchPageAtom = atom(null, async (_get, set, patch: PagePatch) => {
  const result = await api.patchPage(patch);
  if (result.status !== "ok") throw new Error(result.error);

  pageAtomFamily.remove(patch.id);

  if (patch.name !== null) {
    set(storyRefreshAtom, (c) => c + 1);
  }

  return result;
});

export const createPageAtom = atom(null, async (get, set) => {
  const storyId = get(currentStoryIdAtom);
  if (!storyId) throw new Error("No story loaded");

  const result = await api.createPage(storyId);
  if (result.status !== "ok") throw new Error(result.error);

  set(storyRefreshAtom, (c) => c + 1);

  return result.data;
});

export const createChoiceAtom = atom(
  null,
  async (_get, _set, args: { pageId: number; text: string; targetPageId: number }) => {
    const result = await api.createChoice(args.pageId, args.text, args.targetPageId);
    if (result.status !== "ok") throw new Error(result.error);

    // Invalidate the page cache to refresh choices
    pageAtomFamily.remove(args.pageId);

    return result.data;
  }
);

export const deleteChoiceAtom = atom(
  null,
  async (_get, _set, args: { choiceId: number; pageId: number }) => {
    const result = await api.deleteChoice(args.choiceId);
    if (result.status !== "ok") throw new Error(result.error);

    // Invalidate the page cache to refresh choices
    pageAtomFamily.remove(args.pageId);

    return result;
  }
);

export const patchChoiceAtom = atom(
  null,
  async (_get, _set, args: { patch: ChoicePatch; pageId: number }) => {
    const result = await api.patchChoice(args.patch);
    if (result.status !== "ok") throw new Error(result.error);

    // Invalidate the page cache to refresh choices
    pageAtomFamily.remove(args.pageId);

    return result;
  }
);

export const patchStoryAtom = atom(
  null,
  async (_get, set, patch: { id: number; title?: string; start_page?: number }) => {
    const result = await api.patchStory({
      id: patch.id,
      title: patch.title ?? null,
      start_page: patch.start_page ?? null,
    });

    if (result.status !== "ok") {
      throw new Error(result.error);
    }

    // Refresh story outline to reflect changes
    set(storyRefreshAtom, (c) => c + 1);
    return result;
  }
);

// ===== Flag Actions =====

export const createFlagAtom = atom(null, async (_get, set, create: CreateFlag) => {
  const result = await api.createFlag(create);
  if (result.status !== "ok") throw new Error(result.error);
  set(storyRefreshAtom, (c) => c + 1);
  return result.data;
});

export const patchFlagAtom = atom(null, async (_get, set, patch: FlagPatch) => {
  const result = await api.patchFlag(patch);
  if (result.status !== "ok") throw new Error(result.error);
  set(storyRefreshAtom, (c) => c + 1);
  return result;
});

export const deleteFlagAtom = atom(null, async (_get, set, id: number) => {
  const result = await api.deleteFlag(id);
  if (result.status !== "ok") throw new Error(result.error);
  set(storyRefreshAtom, (c) => c + 1);
  return result;
});

export const setFlagOperationAtom = atom(
  null,
  async (_get, _set, args: { op: SetFlagOperation; pageId: number }) => {
    const result = await api.setFlagOperation(args.op);
    if (result.status !== "ok") throw new Error(result.error);

    // Invalidate the page cache to refresh operations
    pageAtomFamily.remove(args.pageId);

    return result.data;
  }
);

export const removeFlagOperationAtom = atom(
  null,
  async (_get, _set, args: { choiceId?: number; pageId: number; flagId: number }) => {
    const result = await api.removeFlagOperation(args.choiceId ?? null, args.pageId ?? null, args.flagId);
    if (result.status !== "ok") throw new Error(result.error);

    // Invalidate the page cache to refresh operations
    pageAtomFamily.remove(args.pageId);

    return result;
  }
);

export const setChoiceConditionAtom = atom(
  null,
  async (_get, _set, args: { cond: SetChoiceCondition; pageId: number }) => {
    const result = await api.setChoiceCondition(args.cond);
    if (result.status !== "ok") throw new Error(result.error);

    // Invalidate the page cache to refresh conditions
    pageAtomFamily.remove(args.pageId);

    return result.data;
  }
);

export const removeChoiceConditionAtom = atom(
  null,
  async (_get, _set, args: { choiceId: number; pageId: number; flagId: number }) => {
    const result = await api.removeChoiceCondition(args.choiceId, args.flagId);
    if (result.status !== "ok") throw new Error(result.error);

    // Invalidate the page cache to refresh conditions
    pageAtomFamily.remove(args.pageId);

    return result;
  }
);
