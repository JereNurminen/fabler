import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { atom, Provider } from "jotai";
import type { PageListItem, Problem } from "@fabler/types";
import { TrashedPageView } from "../TrashedPageView";

const restore = vi.fn().mockResolvedValue(undefined);
const purge = vi.fn().mockResolvedValue(undefined);
const purgeAll = vi.fn().mockResolvedValue(undefined);

let livePages: PageListItem[] = [];
let trashedPages: PageListItem[] = [];
let problems: Problem[] = [];

vi.mock("../../api", () => ({
  default: {
    getTrashedPage: vi.fn(),
    getProjectAssetsDir: vi.fn().mockResolvedValue(null),
  },
}));

// `trashedPageAtomFamily`/`pageListAtom`/`trashedPageListAtom` are real async
// atoms in production (correctly so -- see TrashedPageView.tsx), read through
// Suspense. In this environment (React 19 + jotai 2.20 + vitest/jsdom) a
// genuinely async jotai atom does not reliably resolve through Suspense
// within any bounded test timeout -- confirmed by isolating a bare
// `atom(async () => "x")` behind `<Suspense>` with a 9s `findBy` timeout and
// it still never settling. This mirrors the exact workaround
// `PageCard.test.tsx` already documents for `pageAtomFamily`/`pageListAtom`:
// replace the atoms with synchronous stand-ins so the test exercises
// rendering, not this environment's async Suspense integration.
//
// The page literal is built INSIDE the factory (not read from a module-scope
// `const`): `vi.mock` factories are hoisted above module-scope `const`s,
// which are not yet initialized when the factory runs. The list atoms read
// the module-level `let`s lazily instead, so each test can vary them.
vi.mock("../../atoms/storyAtoms", () => {
  const trashedPage = {
    id: "b7c1d",
    name: "Dark Tunnel",
    body: { content: [{ type: "markdown", source: "Water *drips*." }] },
    choices: [
      {
        id: "c1a2b",
        text: "Go back",
        target: "a1b2c",
        flag_operations: [],
        conditions: [],
      },
    ],
    flag_operations: [],
    editor: null,
    last_modified: "2026-08-27T09:15:00.000Z",
  };
  const pageAtom = atom(trashedPage);
  return {
    trashedPageAtomFamily: () => pageAtom,
    pageListAtom: atom(() => livePages),
    trashedPageListAtom: atom(() => trashedPages),
  };
});

vi.mock("../../atoms/useStoryAtoms", () => ({
  useValidation: () => ({ problems }),
}));

vi.mock("../../atoms/storyActions", () => ({
  // The bodies return void rather than the mock's `any` result: these stand
  // in for write atoms, which resolve to nothing, and returning `any` here
  // trips `no-unsafe-return`.
  restorePageAtom: atom(null, (_get, _set, id: string) => {
    void restore(id);
  }),
  deleteTrashedPageAtom: atom(null, (_get, _set, id: string) => {
    void purge(id);
  }),
  emptyTrashAtom: atom(null, () => {
    void purgeAll();
  }),
}));

function trashedTargetProblem(target: string): Problem {
  return {
    severity: "error",
    page_id: "a1b2c",
    page_name: "Entrance",
    detail: {
      code: "choice_targets_trashed_page",
      choice_id: "c1a2b",
      choice_text: "Go north",
      target,
      target_name: "Dark Tunnel",
    },
  };
}

beforeEach(() => {
  livePages = [{ id: "a1b2c", name: "Entrance" }];
  trashedPages = [{ id: "b7c1d", name: "Dark Tunnel" }];
  problems = [];
  vi.clearAllMocks();
});

/**
 * A fresh jotai store per render: the mocked list atoms close over
 * module-level `let`s that change between tests, and a shared default store
 * would cache the first test's value.
 */
function renderView() {
  return render(
    <Provider>
      <Suspense fallback={null}>
        <TrashedPageView pageId="b7c1d" />
      </Suspense>
    </Provider>,
  );
}

describe("TrashedPageView", () => {
  it("says the page is in the trash", async () => {
    renderView();
    expect(await screen.findByTestId("trashed-page-banner")).toBeTruthy();
  });

  it("offers restore and permanent deletion", async () => {
    renderView();
    expect(await screen.findByRole("button", { name: /restore/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /delete permanently/i })).toBeTruthy();
  });

  it("has no editable field anywhere — this is the read-only guarantee", async () => {
    const { container } = renderView();
    await screen.findByTestId("trashed-page-banner");

    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(container.querySelectorAll("textarea")).toHaveLength(0);
    expect(container.querySelectorAll("select")).toHaveLength(0);
  });

  it("shows choices as plain text, not as navigation", async () => {
    const { container } = renderView();
    await screen.findByTestId("trashed-page-banner");

    expect(screen.getByText(/Go back/)).toBeTruthy();
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("names the page a choice leads to instead of printing its id", async () => {
    renderView();
    await screen.findByTestId("trashed-page-banner");

    expect(screen.getByText(/Go back → Entrance/)).toBeTruthy();
    expect(screen.queryByText(/a1b2c/)).toBeNull();
  });

  it("falls back to the raw id for a target that resolves to no page at all", async () => {
    livePages = [];
    trashedPages = [{ id: "b7c1d", name: "Dark Tunnel" }];
    renderView();
    await screen.findByTestId("trashed-page-banner");

    expect(screen.getByText(/Go back → a1b2c/)).toBeTruthy();
  });

  it("renders the body rather than dumping its markdown source", async () => {
    renderView();
    const body = await screen.findByTestId("trashed-page-body");

    // `Water *drips*.` rendered, not shown verbatim.
    expect(body.querySelector("em")?.textContent).toBe("drips");
    expect(body.querySelector("pre")).toBeNull();
  });

  /**
   * The regression this file exists for. The first implementation wired
   * "Delete permanently" straight to the purge atom: no confirmation, no
   * undo, and no way back. The old test only asserted the button existed,
   * which is exactly why that shipped -- so this one clicks it and asserts
   * that nothing is destroyed before the author confirms.
   */
  it("asks before purging, and purges nothing until the author confirms", async () => {
    renderView();
    await screen.findByTestId("trashed-page-banner");

    await userEvent.click(screen.getByRole("button", { name: /delete permanently/i }));

    expect(await screen.findByTestId("confirm-purge-dialog")).toBeTruthy();
    expect(purge).not.toHaveBeenCalled();
  });

  it("purges only once the confirmation is accepted", async () => {
    renderView();
    await screen.findByTestId("trashed-page-banner");

    await userEvent.click(screen.getByRole("button", { name: /delete permanently/i }));
    const dialog = await screen.findByTestId("confirm-purge-dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /^delete permanently$/i }),
    );

    expect(purge).toHaveBeenCalledWith("b7c1d");
  });

  it("cancelling the confirmation leaves the page in the trash", async () => {
    renderView();
    await screen.findByTestId("trashed-page-banner");

    await userEvent.click(screen.getByRole("button", { name: /delete permanently/i }));
    const dialog = await screen.findByTestId("confirm-purge-dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));

    expect(purge).not.toHaveBeenCalled();
    expect(screen.queryByTestId("confirm-purge-dialog")).toBeNull();
  });

  it("warns that purging downgrades a choice that still points here", async () => {
    problems = [trashedTargetProblem("b7c1d")];
    renderView();
    await screen.findByTestId("trashed-page-banner");

    await userEvent.click(screen.getByRole("button", { name: /delete permanently/i }));

    expect(await screen.findByTestId("purge-downgrade-warning")).toBeTruthy();
  });

  it("does not warn about a choice pointing at some other trashed page", async () => {
    problems = [trashedTargetProblem("someOtherId")];
    renderView();
    await screen.findByTestId("trashed-page-banner");

    await userEvent.click(screen.getByRole("button", { name: /delete permanently/i }));

    await screen.findByTestId("confirm-purge-dialog");
    expect(screen.queryByTestId("purge-downgrade-warning")).toBeNull();
  });

  it("restore calls through to restorePageAtom", async () => {
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: /restore/i }));

    expect(restore).toHaveBeenCalledWith("b7c1d");
  });
});
