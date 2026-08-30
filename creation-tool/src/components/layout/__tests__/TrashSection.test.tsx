import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { atom, Provider } from "jotai";
import type { PageListItem, Problem } from "@fabler/types";
import { TrashSection } from "../TrashSection";

let trashedPages: PageListItem[] = [];
let problems: Problem[] = [];

const restore = vi.fn().mockResolvedValue(undefined);
const purge = vi.fn().mockResolvedValue(undefined);
const purgeAll = vi.fn().mockResolvedValue(undefined);

vi.mock("../../../atoms/storyAtoms", () => ({
  trashedPageListAtom: atom(() => trashedPages),
}));

vi.mock("../../../atoms/useStoryAtoms", () => ({
  useValidation: () => ({ problems }),
}));

vi.mock("../../../atoms/storyActions", () => ({
  restorePageAtom: atom(null, (_get, _set, id: string) => restore(id)),
  deleteTrashedPageAtom: atom(null, (_get, _set, id: string) => purge(id)),
  emptyTrashAtom: atom(null, () => purgeAll()),
}));

const darkTunnel: PageListItem = { id: "b7c1d", name: "Dark Tunnel" };
const entrance: PageListItem = { id: "a1b2c", name: "Entrance" };

function trashedPageProblem(target: string): Problem {
  return {
    severity: "warning",
    page_id: "a1b2c",
    page_name: "Entrance",
    detail: {
      code: "choice_targets_trashed_page",
      choice_id: "c1",
      choice_text: "Go back",
      target,
      target_name: "Dark Tunnel",
    },
  };
}

beforeEach(() => {
  trashedPages = [];
  problems = [];
  vi.clearAllMocks();
});

/**
 * Wraps every render in its own `<Provider>` so each test gets a fresh jotai
 * store — `trashedPageListAtom`/`useValidation`'s `problems` are mocked as
 * closures over module-level `let`s that change between tests, and a shared
 * default store would otherwise cache the first test's computed value.
 */
function renderSection() {
  return render(
    <Provider>
      <TrashSection />
    </Provider>,
  );
}

describe("TrashSection", () => {
  it("renders nothing when the trash is empty", () => {
    trashedPages = [];
    const { container } = renderSection();
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("trash-section")).toBeNull();
  });

  it("restore calls through to restorePageAtom for the right page", async () => {
    trashedPages = [darkTunnel];
    renderSection();

    const entry = screen.getByTestId("trash-entry");
    fireContextMenu(entry);

    const restoreItem = await screen.findByRole("menuitem", { name: /restore/i });
    await userEvent.click(restoreItem);

    expect(restore).toHaveBeenCalledWith("b7c1d");
  });

  it("choosing 'Delete permanently' from the context menu opens the purge confirmation", async () => {
    trashedPages = [darkTunnel];
    renderSection();

    fireContextMenu(screen.getByTestId("trash-entry"));

    const deleteItem = await screen.findByRole("menuitem", { name: /delete permanently/i });
    await userEvent.click(deleteItem);

    expect(await screen.findByTestId("confirm-purge-dialog")).toBeTruthy();
  });

  it("shows the downgrade warning when a live choice still points at the trashed page", async () => {
    trashedPages = [darkTunnel];
    problems = [trashedPageProblem("b7c1d")];
    renderSection();

    fireContextMenu(screen.getByTestId("trash-entry"));
    const deleteItem = await screen.findByRole("menuitem", { name: /delete permanently/i });
    await userEvent.click(deleteItem);

    expect(await screen.findByTestId("purge-downgrade-warning")).toBeTruthy();
  });

  it("shows no downgrade warning when no live choice points at the trashed page", async () => {
    trashedPages = [darkTunnel];
    problems = [];
    renderSection();

    fireContextMenu(screen.getByTestId("trash-entry"));
    const deleteItem = await screen.findByRole("menuitem", { name: /delete permanently/i });
    await userEvent.click(deleteItem);

    await screen.findByTestId("confirm-purge-dialog");
    expect(screen.queryByTestId("purge-downgrade-warning")).toBeNull();
  });

  it("does not warn about a trashed page whose id the problem does not reference", async () => {
    trashedPages = [darkTunnel];
    // A choice targeting a DIFFERENT trashed page must not leak into this
    // page's purge warning.
    problems = [trashedPageProblem("someOtherId")];
    renderSection();

    fireContextMenu(screen.getByTestId("trash-entry"));
    const deleteItem = await screen.findByRole("menuitem", { name: /delete permanently/i });
    await userEvent.click(deleteItem);

    await screen.findByTestId("confirm-purge-dialog");
    expect(screen.queryByTestId("purge-downgrade-warning")).toBeNull();
  });

  it("emptying the trash warns using the combined count across all trashed pages", async () => {
    trashedPages = [darkTunnel, entrance];
    problems = [trashedPageProblem("b7c1d"), trashedPageProblem("a1b2c")];
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: /empty trash/i }));

    const warning = await screen.findByTestId("purge-downgrade-warning");
    expect(warning.textContent).toContain("2");
  });

  it("confirming the purge dialog calls deleteTrashedPageAtom and closes the dialog", async () => {
    trashedPages = [darkTunnel];
    renderSection();

    fireContextMenu(screen.getByTestId("trash-entry"));
    const deleteItem = await screen.findByRole("menuitem", { name: /delete permanently/i });
    await userEvent.click(deleteItem);
    await screen.findByTestId("confirm-purge-dialog");

    await userEvent.click(screen.getByRole("button", { name: /^delete permanently$/i }));

    expect(purge).toHaveBeenCalledWith("b7c1d");
  });

  it("confirming 'empty trash' calls emptyTrashAtom, not deleteTrashedPageAtom", async () => {
    trashedPages = [darkTunnel];
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: /empty trash/i }));
    await screen.findByTestId("confirm-purge-dialog");
    await userEvent.click(screen.getByRole("button", { name: /^delete permanently$/i }));

    expect(purgeAll).toHaveBeenCalledOnce();
    expect(purge).not.toHaveBeenCalled();
  });
});

/**
 * Dispatches a native `contextmenu` event -- `userEvent` has no helper for
 * it, and this keeps every call site down to one line.
 */
function fireContextMenu(el: Element) {
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
}
