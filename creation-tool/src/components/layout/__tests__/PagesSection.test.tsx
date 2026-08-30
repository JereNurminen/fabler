import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { atom } from "jotai";
import { PagesSection } from "../PagesSection";
import { useTrashPage } from "../../TrashPageContext";

vi.mock("../../TrashPageContext", () => ({
  useTrashPage: vi.fn(),
}));

// NewPageButton (rendered by PagesSection) calls the real useStoryAtoms,
// which reads async atoms backed by the Tauri/HTTP api -- that suspends
// forever in jsdom with no Suspense boundary here, leaving the tree
// unrendered. Mocked out since this test is only about the context-menu
// wiring, not page creation. `useValidation` is mocked for the same reason
// -- `TrashSection` (rendered by `PagesSection` since Task 11) reads it too.
vi.mock("../../../atoms/useStoryAtoms", () => ({
  useStoryAtoms: () => ({ createPage: vi.fn() }),
  useValidation: () => ({ problems: [] }),
}));

// `TrashSection`'s own atoms, replaced with synchronous stand-ins for the
// same reason: this test is about the live-page context menu, not the trash,
// and the real `trashedPageListAtom` is async (suspends with no boundary
// here). An empty list means `TrashSection` renders null, leaving the
// existing menu assertions undisturbed.
vi.mock("../../../atoms/storyAtoms", () => ({
  trashedPageListAtom: atom(() => []),
}));

vi.mock("../../../atoms/storyActions", () => ({
  restorePageAtom: atom(null, () => {}),
  deleteTrashedPageAtom: atom(null, () => {}),
  emptyTrashAtom: atom(null, () => {}),
}));

const pages = [
  { id: "aaaaa", name: "Entrance" },
  { id: "bbbbb", name: "Dark Tunnel" },
];

describe("PagesSection", () => {
  it("right-clicking the second row's page opens a menu that trashes THAT row's page, not the first", async () => {
    const requestTrash = vi.fn();
    vi.mocked(useTrashPage).mockReturnValue({ requestTrash });

    render(<PagesSection pages={pages} startPage={null} />);

    fireEvent.contextMenu(screen.getByRole("link", { name: /dark tunnel/i }));

    const item = await screen.findByRole("menuitem", { name: /delete page/i });
    await userEvent.click(item);

    expect(requestTrash).toHaveBeenCalledWith("bbbbb");
    expect(requestTrash).not.toHaveBeenCalledWith("aaaaa");
  });

  it("right-clicking the first row's page trashes that page instead", async () => {
    const requestTrash = vi.fn();
    vi.mocked(useTrashPage).mockReturnValue({ requestTrash });

    render(<PagesSection pages={pages} startPage={null} />);

    fireEvent.contextMenu(screen.getByRole("link", { name: /entrance/i }));

    const item = await screen.findByRole("menuitem", { name: /delete page/i });
    await userEvent.click(item);

    expect(requestTrash).toHaveBeenCalledWith("aaaaa");
    expect(requestTrash).not.toHaveBeenCalledWith("bbbbb");
  });
});
