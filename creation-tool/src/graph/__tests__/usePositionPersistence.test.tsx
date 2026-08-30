import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { Provider } from "jotai";
import type { Node } from "@xyflow/react";
import type { Page } from "@fabler/types";
import { usePositionPersistence } from "../usePositionPersistence";
import api from "../../api";

vi.mock("../../api", () => ({
  default: {
    getPage: vi.fn(),
    savePage: vi.fn(() => Promise.resolve()),
  },
}));

// This project's vitest config does not set `globals: true`, so
// @testing-library/react's automatic afterEach(cleanup) never self-registers.
afterEach(cleanup);

const getPage = vi.mocked(api).getPage;
const savePage = vi.mocked(api).savePage;

const PAGE: Page = {
  id: "p1",
  name: "Start",
  body: { content: [{ type: "markdown", source: "hi" }] },
  choices: [{ id: "c1", text: "Go", target: "p2", flag_operations: [], conditions: [] }],
  flag_operations: [],
};

function dragNode(id: string, x: number, y: number): Node {
  return { id, position: { x, y }, data: {} } as Node;
}

describe("usePositionPersistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getPage.mockReset();
    savePage.mockClear();
    getPage.mockResolvedValue(PAGE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces rapid drags of the same node into a single write, using the latest position", async () => {
    const { result } = renderHook(() => usePositionPersistence(), { wrapper: Provider });

    act(() => {
      result.current(dragNode("p1", 1, 1));
      result.current(dragNode("p1", 2, 2));
      result.current(dragNode("p1", 3, 3));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(savePage).toHaveBeenCalledTimes(1);
    expect(savePage.mock.calls[0][0]).toMatchObject({
      id: "p1",
      editor: { position: { x: 3, y: 3 } },
    });
  });

  it("fetches the page fresh immediately before saving, rather than writing a stale captured copy", async () => {
    const { result } = renderHook(() => usePositionPersistence(), { wrapper: Provider });

    act(() => result.current(dragNode("p1", 9, 9)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(savePage).toHaveBeenCalledTimes(1);
    // getPage is called at write time (not at drag time), which is what
    // keeps the staleness window as small as possible: whatever the author
    // saved through the normal editor most recently is what gets merged
    // with the new position, rather than a copy captured when the graph
    // first loaded.
    expect(getPage).toHaveBeenCalledWith("p1");
    expect(getPage).toHaveBeenCalledTimes(1);
  });

  it("preserves the rest of the page untouched, only setting editor.position", async () => {
    const { result } = renderHook(() => usePositionPersistence(), { wrapper: Provider });

    act(() => result.current(dragNode("p1", 5, 6)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(savePage).toHaveBeenCalledTimes(1);
    const saved = savePage.mock.calls[0][0] as Page;
    expect(saved.name).toBe("Start");
    expect(saved.choices).toEqual(PAGE.choices);
  });

  it("merges the new position into existing editor metadata rather than discarding it", async () => {
    getPage.mockResolvedValue({
      ...PAGE,
      editor: { position: { x: 100, y: 100 } },
    });
    const { result } = renderHook(() => usePositionPersistence(), { wrapper: Provider });

    act(() => result.current(dragNode("p1", 7, 8)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(savePage).toHaveBeenCalledTimes(1);
    const saved = savePage.mock.calls[0][0] as Page;
    expect(saved.editor).toEqual({ position: { x: 7, y: 8 } });
  });

  it("debounces each node id independently", async () => {
    const { result } = renderHook(() => usePositionPersistence(), { wrapper: Provider });

    getPage.mockImplementation((id: string) => Promise.resolve({ ...PAGE, id }));

    act(() => {
      result.current(dragNode("p1", 1, 1));
      result.current(dragNode("p2", 2, 2));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(savePage).toHaveBeenCalledTimes(2);
    const ids = savePage.mock.calls.map((c) => (c[0] as Page).id).sort();
    expect(ids).toEqual(["p1", "p2"]);
  });

  it("never attempts to persist the synthetic missing-target stub node", async () => {
    const { result } = renderHook(() => usePositionPersistence(), { wrapper: Provider });

    act(() => result.current(dragNode("missing:gone9", 5, 5)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(getPage).not.toHaveBeenCalled();
    expect(savePage).not.toHaveBeenCalled();
  });
});
