import { atom } from "jotai";

/**
 * Status of the most recent write, wherever in the app it originated.
 *
 * This is global rather than local to the page editor on purpose: asset
 * uploads, flag edits and page saves all report here, so one indicator can
 * show all of them.
 */
export type SaveStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved" }
  | { state: "failed"; message: string };

export const saveStatusAtom = atom<SaveStatus>({ state: "idle" });
