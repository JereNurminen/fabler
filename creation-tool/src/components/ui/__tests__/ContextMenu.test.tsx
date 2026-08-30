import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ContextMenu, type ContextMenuItem } from "../ContextMenu";

const ORIGINAL_INNER_WIDTH = window.innerWidth;
const ORIGINAL_INNER_HEIGHT = window.innerHeight;

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
}

afterEach(() => {
  setViewport(ORIGINAL_INNER_WIDTH, ORIGINAL_INNER_HEIGHT);
  vi.restoreAllMocks();
});

function items(onSelect: () => void = vi.fn()): ContextMenuItem[] {
  return [
    { label: "Rename", onSelect },
    { label: "Delete", onSelect: vi.fn(), variant: "danger" },
  ];
}

describe("ContextMenu", () => {
  it("renders into document.body via a portal, not inside its parent container", () => {
    const { container } = render(
      <ContextMenu x={10} y={10} onClose={vi.fn()} items={items()} />,
    );
    const menu = screen.getByTestId("context-menu");
    expect(container.contains(menu)).toBe(false);
    expect(document.body.contains(menu)).toBe(true);
  });

  it("clicking an item calls that item's onSelect and then onClose", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <ContextMenu
        x={0}
        y={0}
        onClose={onClose}
        items={[{ label: "Rename", onSelect }]}
      />,
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking inside the menu does not call onClose", () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} onClose={onClose} items={items()} />);
    fireEvent.pointerDown(screen.getByTestId("context-menu"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clicking outside the menu calls onClose", () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} onClose={onClose} items={items()} />);
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape calls onClose", () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} onClose={onClose} items={items()} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a non-bubbling scroll event on a scrollable ancestor calls onClose (proves capture-phase registration)", () => {
    // Real `scroll` events don't bubble. If the window listener were
    // registered without the capture flag, this event would never reach it.
    const scrollable = document.createElement("div");
    document.body.appendChild(scrollable);
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} onClose={onClose} items={items()} />);

    act(() => {
      scrollable.dispatchEvent(new Event("scroll", { bubbles: false }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    document.body.removeChild(scrollable);
  });

  it("clamps the menu back on screen when opened near the bottom-right edge", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 200,
      height: 100,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      x: 0,
      y: 0,
      toJSON: () => "",
    } as DOMRect);
    setViewport(300, 300);

    render(<ContextMenu x={290} y={290} onClose={vi.fn()} items={items()} />);
    const menu = screen.getByTestId("context-menu");

    // margin (8) floor/ceiling: max x = 300 - 200 - 8 = 92
    expect(menu.style.left).toBe("92px");
    expect(menu.style.top).toBe("192px"); // 300 - 100 - 8
  });

  it("floors the clamp so a menu larger than the viewport is not pushed to a negative coordinate", () => {
    // Finding 4 regression: viewport 300x300, menu 500x500, opened near the
    // top-left. Without a `Math.max` floor this lands at a negative offset
    // and the first items are unreachable above/left of the viewport.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 500,
      height: 500,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      x: 0,
      y: 0,
      toJSON: () => "",
    } as DOMRect);
    setViewport(300, 300);

    render(<ContextMenu x={50} y={50} onClose={vi.fn()} items={items()} />);
    const menu = screen.getByTestId("context-menu");

    expect(menu.style.left).toBe("8px");
    expect(menu.style.top).toBe("8px");
  });

  it("removes its listeners on unmount", () => {
    const onClose = vi.fn();
    const scrollable = document.createElement("div");
    document.body.appendChild(scrollable);
    const { unmount } = render(
      <ContextMenu x={0} y={0} onClose={onClose} items={items()} />,
    );

    unmount();

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerDown(document.body);
    act(() => {
      scrollable.dispatchEvent(new Event("scroll", { bubbles: false }));
    });

    expect(onClose).not.toHaveBeenCalled();
    document.body.removeChild(scrollable);
  });

  it("focuses the first menu item on mount", () => {
    render(<ContextMenu x={0} y={0} onClose={vi.fn()} items={items()} />);
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Rename" }),
    );
  });

  it("ArrowDown/ArrowUp move focus between items and wrap at both ends", () => {
    render(<ContextMenu x={0} y={0} onClose={vi.fn()} items={items()} />);
    const rename = screen.getByRole("menuitem", { name: "Rename" });
    const del = screen.getByRole("menuitem", { name: "Delete" });

    expect(document.activeElement).toBe(rename);

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(document.activeElement).toBe(del);

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(document.activeElement).toBe(rename); // wraps past the last item

    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(document.activeElement).toBe(del); // wraps past the first item
  });

  it("Escape returns focus to whatever had it before the menu opened", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    render(<ContextMenu x={0} y={0} onClose={vi.fn()} items={items()} />);
    expect(document.activeElement).not.toBe(trigger);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);

    document.body.removeChild(trigger);
  });
});
