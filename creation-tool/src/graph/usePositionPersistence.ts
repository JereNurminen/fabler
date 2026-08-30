import { useCallback, useRef } from "react";
import type { Node } from "@xyflow/react";
import api from "../api";
import { useTrackedAction } from "../hooks/useTrackedAction";
import { MISSING_NODE_PREFIX } from "./missingNode";

/** Coalesce rapid drags of the same node into one write. */
const DEBOUNCE_MS = 500;

/**
 * Save a node's position back onto its page.
 *
 * Positions are cosmetic — losing one is an annoyance, not data loss — so
 * this is debounced and fire-and-forget. It still reports failure through
 * the shared save-status indicator like any other write, but nothing blocks
 * on a drag and no dialog interrupts it.
 *
 * Clobber avoidance: `savePage` persists a whole `Page`, so writing a copy
 * captured when the graph loaded (potentially minutes earlier, while the
 * author kept editing the page's body/choices elsewhere) would revert any
 * text they saved in between. To avoid that, the page is re-fetched with
 * `api.getPage` at write time — right before the save, not at drag time —
 * so only `editor.position` is ever stale; everything else reflects the
 * most recent on-disk state. A perfect fix would need a lock the backend
 * doesn't have; re-fetching immediately before writing shrinks the unsafe
 * window from "however long the graph has been open" to one round trip.
 */
export function usePositionPersistence() {
  const timers = useRef(new Map<string, number>());

  const persist = useTrackedAction(async (pageId: string, x: number, y: number) => {
    const page = await api.getPage(pageId);
    await api.savePage({
      ...page,
      editor: { ...(page.editor ?? {}), position: { x, y } },
    });
  });

  return useCallback(
    (node: Node) => {
      // The synthetic "missing target" stub has no backing page — nothing
      // to fetch or save.
      if (node.id.startsWith(MISSING_NODE_PREFIX)) return;

      const existing = timers.current.get(node.id);
      if (existing) window.clearTimeout(existing);
      timers.current.set(
        node.id,
        window.setTimeout(() => {
          timers.current.delete(node.id);
          persist(node.id, node.position.x, node.position.y);
        }, DEBOUNCE_MS),
      );
    },
    [persist],
  );
}
