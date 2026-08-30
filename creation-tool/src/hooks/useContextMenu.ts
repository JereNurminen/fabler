import { useCallback, useState, type MouseEvent as ReactMouseEvent } from "react";

export interface ContextMenuState<T> {
  x: number;
  y: number;
  target: T;
}

/**
 * Right-click menu state: where it is, and what it was opened on.
 *
 * Generic in the target so each call site keeps its own type — a page id in
 * the sidebar, a graph node id in the map — instead of stringly-typed state.
 */
export function useContextMenu<T>() {
  const [menu, setMenu] = useState<ContextMenuState<T> | null>(null);

  const openAt = useCallback((event: ReactMouseEvent, target: T) => {
    // Without this the OS/browser menu opens on top of ours.
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, target });
  }, []);

  const close = useCallback(() => setMenu(null), []);

  return { menu, openAt, close };
}
