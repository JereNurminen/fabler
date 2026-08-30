import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  variant?: "default" | "danger";
}

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  items: ContextMenuItem[];
}

const MARGIN = 8;

/**
 * A right-click menu, portalled to the end of `<body>`.
 *
 * The portal is what lets this open from inside the story map, which is a
 * `fixed inset-0 z-50` overlay: a menu rendered in the node's own subtree
 * would be clipped by it.
 *
 * Position is clamped after mount rather than computed up front, because the
 * menu's size is not known until it has rendered — a menu opened near the
 * right or bottom edge would otherwise hang off screen. It is clamped on
 * both ends: a `Math.max(MARGIN, …)` floor keeps a menu taller/wider than
 * the viewport from landing at a negative coordinate, which would push its
 * first items off the top/left with no way to reach them.
 */
export const ContextMenu = ({ x, y, onClose, items }: ContextMenuProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({ x, y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPosition({
      x: Math.max(MARGIN, Math.min(x, window.innerWidth - width - MARGIN)),
      y: Math.max(MARGIN, Math.min(y, window.innerHeight - height - MARGIN)),
    });
  }, [x, y]);

  // Move keyboard focus into the menu on open, and hand it back to whatever
  // held it when the menu closes via Escape — otherwise a keyboard user's
  // focus is silently dropped into the menu with no way back, and the menu
  // opens with nothing reachable at all if focus never enters it.
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    itemRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    const focusableItems = () =>
      itemRefs.current.filter((el): el is HTMLButtonElement => el !== null);

    const moveFocus = (direction: 1 | -1) => {
      const focusable = focusableItems();
      if (focusable.length === 0) return;
      const currentIndex = focusable.indexOf(document.activeElement as HTMLButtonElement);
      const nextIndex =
        currentIndex === -1
          ? 0
          : (currentIndex + direction + focusable.length) % focusable.length;
      focusable[nextIndex]?.focus();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        previouslyFocusedRef.current?.focus();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveFocus(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveFocus(-1);
      }
    };
    // `true` for scroll: it does not bubble, so the menu would otherwise
    // stay pinned to a stale position while the list moved under it.
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      data-testid="context-menu"
      style={{ left: position.x, top: position.y }}
      className="fixed z-[60] min-w-44 py-1 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-600"
    >
      {items.map((item, index) => (
        <button
          key={item.label}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          role="menuitem"
          onClick={() => {
            item.onSelect();
            onClose();
          }}
          className={clsx(
            "block w-full px-3 py-1.5 text-left text-sm",
            "hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
            item.variant === "danger" ? "text-danger" : "text-gray-900 dark:text-gray-100",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
};
