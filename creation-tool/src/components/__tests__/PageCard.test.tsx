import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, atom } from "jotai";
import PageCard from "../PageCard";
import { useTrashPage } from "../TrashPageContext";
import type { Page } from "@fabler/types";

vi.mock("../TrashPageContext", () => ({
  useTrashPage: vi.fn(),
}));

vi.mock("../../atoms/useStoryAtoms", () => ({
  useStoryAtoms: () => ({ flags: [], createPage: vi.fn(), story: null }),
}));

// pageAtomFamily/pageListAtom are normally async (they call the Tauri/HTTP
// api), which would force this test through Suspense for no benefit -- this
// test is only about the delete button's wiring, not data loading. Swapped
// for plain synchronous atoms instead.
//
// The atom instances are built INSIDE the factory closure (not from an
// outer module-scope const) and returned from the SAME closure variable on
// every call: an atomFamily normally caches by key, and a mock that instead
// built a fresh atom on every `pageAtomFamily(id)` call would make every
// render see a "new" atom, which jotai treats as a change -- an infinite
// render loop that OOM-crashed the worker the first time this was tried
// (referencing an outer `const` here also breaks: jotai's `atom` import is
// live and safe to use inside the factory, but a module-scope `const`
// declared in this file is not yet initialized when the factory runs).
vi.mock("../../atoms/storyAtoms", () => {
  const pageAtom = atom<Page>({
    id: "p1",
    name: "Start",
    body: { content: [{ type: "markdown", source: "hi" }] },
    choices: [],
    flag_operations: [],
  });
  const pageListAtom = atom<Array<{ id: string; name: string }>>([]);
  const trashedPageListAtom = atom<Array<{ id: string; name: string }>>([]);
  return {
    pageAtomFamily: () => pageAtom,
    pageListAtom,
    trashedPageListAtom,
  };
});

vi.mock("../../api", () => ({
  default: {
    getProjectAssetsDir: vi.fn().mockResolvedValue(null),
  },
}));

describe("PageCard", () => {
  it("delete button calls requestTrash with this page's id", async () => {
    const requestTrash = vi.fn();
    vi.mocked(useTrashPage).mockReturnValue({ requestTrash });

    render(
      <Provider>
        <PageCard pageId="p1" />
      </Provider>,
    );

    await userEvent.click(await screen.findByTestId("delete-page-button"));

    expect(requestTrash).toHaveBeenCalledWith("p1");
  });
});
