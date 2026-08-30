import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useContextMenu } from "../useContextMenu";

function fakeEvent(x: number, y: number) {
  let defaultPrevented = false;
  return {
    clientX: x,
    clientY: y,
    preventDefault: () => {
      defaultPrevented = true;
    },
    get defaultPrevented() {
      return defaultPrevented;
    },
  } as unknown as ReactMouseEvent & { defaultPrevented: boolean };
}

describe("useContextMenu", () => {
  it("starts closed", () => {
    const { result } = renderHook(() => useContextMenu<string>());
    expect(result.current.menu).toBeNull();
  });

  it("opens at the pointer and remembers the target", () => {
    const { result } = renderHook(() => useContextMenu<string>());
    const event = fakeEvent(120, 340);

    act(() => result.current.openAt(event, "a1b2c"));

    expect(result.current.menu).toEqual({ x: 120, y: 340, target: "a1b2c" });
  });

  it("suppresses the browser's own context menu", () => {
    const { result } = renderHook(() => useContextMenu<string>());
    const event = fakeEvent(1, 2);

    act(() => result.current.openAt(event, "a1b2c"));

    // Without preventDefault the native menu covers ours.
    expect((event as unknown as { defaultPrevented: boolean }).defaultPrevented).toBe(true);
  });

  it("closes", () => {
    const { result } = renderHook(() => useContextMenu<string>());
    act(() => result.current.openAt(fakeEvent(1, 2), "a1b2c"));
    act(() => result.current.close());
    expect(result.current.menu).toBeNull();
  });

  it("reopening on another target replaces the first menu", () => {
    const { result } = renderHook(() => useContextMenu<string>());
    act(() => result.current.openAt(fakeEvent(1, 2), "a1b2c"));
    act(() => result.current.openAt(fakeEvent(9, 9), "d4e5f"));
    expect(result.current.menu?.target).toBe("d4e5f");
  });
});
