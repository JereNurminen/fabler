import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
import { Provider } from "jotai";
import type { Page } from "../../types";
import { usePageMutations } from "../usePageMutations";
import api from "../../api";

vi.mock("../../api", () => ({
  default: {
    savePage: vi.fn(() => Promise.resolve()),
  },
}));

// This project's vitest config does not set `globals: true`, so
// @testing-library/react's automatic afterEach(cleanup) never self-registers.
// `renderHook` mounts a component just like `render` does, so without this,
// trees from earlier tests in this file stay mounted.
afterEach(cleanup);

const PAGE: Page = {
  id: "p1",
  name: "Start",
  body: { content: [{ type: "markdown", source: "hi" }] },
  choices: [
    { id: "c1", text: "Go", target: "p2", flag_operations: [], conditions: [] },
  ],
  flag_operations: [],
};

const savePage = vi.mocked(api).savePage;

describe("usePageMutations", () => {
  beforeEach(() => savePage.mockClear());

  it("merges a page patch and saves the whole page", async () => {
    const { result } = renderHook(() => usePageMutations(PAGE), {
      wrapper: Provider,
    });

    act(() => result.current.updatePage({ name: "Renamed" }));

    await waitFor(() => expect(savePage).toHaveBeenCalledTimes(1));
    const saved = savePage.mock.calls[0][0] as Page;
    expect(saved.name).toBe("Renamed");
    // Unpatched fields must survive — the backend takes a whole Page.
    expect(saved.choices).toHaveLength(1);
    expect(saved.id).toBe("p1");
  });

  it("patches only the named choice", async () => {
    const { result } = renderHook(() => usePageMutations(PAGE), {
      wrapper: Provider,
    });

    act(() => result.current.updateChoice("c1", { text: "Changed" }));

    await waitFor(() => expect(savePage).toHaveBeenCalledTimes(1));
    const saved = savePage.mock.calls[0][0] as Page;
    expect(saved.choices[0].text).toBe("Changed");
    expect(saved.choices[0].target).toBe("p2");
  });

  it("removes a choice by id", async () => {
    const { result } = renderHook(() => usePageMutations(PAGE), {
      wrapper: Provider,
    });

    act(() => result.current.removeChoice("c1"));

    await waitFor(() => expect(savePage).toHaveBeenCalledTimes(1));
    expect((savePage.mock.calls[0][0] as Page).choices).toHaveLength(0);
  });

  it("does nothing when there is no page", () => {
    const { result } = renderHook(() => usePageMutations(null), {
      wrapper: Provider,
    });
    act(() => result.current.updatePage({ name: "x" }));
    expect(savePage).not.toHaveBeenCalled();
  });
});
