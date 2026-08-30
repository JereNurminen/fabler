import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { savePageAtom } from "../atoms/storyActions";
import { useTrackedAction } from "./useTrackedAction";
import { generateId } from "../utilities/id";
import type { Choice, Page } from "@fabler/types";

/**
 * Every write PageCard performs, in one place.
 *
 * Callers pass a patch; this saves the whole entity, because the backend save
 * API takes a complete `Page`. Built on useTrackedAction so a failed write is
 * reported once here rather than swallowed at twelve call sites.
 */
export function usePageMutations(page: Page | null) {
  const savePage = useSetAtom(savePageAtom);

  const save = useTrackedAction(async (next: Page) => {
    await savePage(next);
  });

  const updatePage = useCallback(
    (patch: Partial<Page>) => {
      if (!page) return;
      save({ ...page, ...patch });
    },
    [page, save],
  );

  const updateChoice = useCallback(
    (choiceId: string, patch: Partial<Choice>) => {
      if (!page) return;
      save({
        ...page,
        choices: page.choices.map((c) =>
          c.id === choiceId ? { ...c, ...patch } : c,
        ),
      });
    },
    [page, save],
  );

  // The default target is passed in rather than read from `pageListAtom`.
  // That atom is async, so reading it here would make this hook suspend —
  // which breaks `renderHook` and would force a Suspense boundary on every
  // consumer for no benefit. PageCard already has the page list to hand.
  const addChoice = useCallback(
    (defaultTarget: string) => {
      if (!page) return;
      save({
        ...page,
        choices: [
          ...page.choices,
          {
            id: generateId(),
            text: "",
            target: defaultTarget,
            flag_operations: [],
            conditions: [],
          },
        ],
      });
    },
    [page, save],
  );

  const removeChoice = useCallback(
    (choiceId: string) => {
      if (!page) return;
      save({ ...page, choices: page.choices.filter((c) => c.id !== choiceId) });
    },
    [page, save],
  );

  return { updatePage, updateChoice, addChoice, removeChoice };
}
