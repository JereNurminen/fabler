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

/**
 * A right-click menu, portalled to the end of `<body>`.
 *
 * The portal is what lets this open from inside the story map, which is a
 * `fixed inset-0 z-50` overlay: a menu rendered in the node's own subtree
 * would be clipped by it.
 *
 * Position is clamped after mount rather than computed up front, because the
 * menu's size is not known until it has rendered — a menu opened near the
 * right or bottom edge would otherwise hang off screen.
 */
export const ContextMenu = ({ x, y, onClose, items }: ContextMenuProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margin = 8;
    setPosition({
      x: Math.min(x, window.innerWidth - width - margin),
      y: Math.min(y, window.innerHeight - height - margin),
    });
  }, [x, y]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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
      className="fixed z-[60] min-w-44 py-1 bg-white rounded-md shadow-lg border border-gray-200"
    >
      {items.map((item) => (
        <button
          key={item.label}
          role="menuitem"
          onClick={() => {
            item.onSelect();
            onClose();
          }}
          className={clsx(
            "block w-full px-3 py-1.5 text-left text-sm",
            "hover:bg-gray-100 transition-colors",
            item.variant === "danger" ? "text-red-600" : "text-gray-900",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
};
