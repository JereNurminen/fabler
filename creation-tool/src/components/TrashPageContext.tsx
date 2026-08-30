import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useSetAtom } from "jotai";
import api from "../api";
import { trashPageAtom } from "../atoms/storyActions";
import { useTrackedAction } from "../hooks/useTrackedAction";
import { ConfirmTrashPageDialog } from "./ConfirmTrashPageDialog";
import type { DeleteImpact } from "@fabler/types";

interface TrashPageApi {
  requestTrash: (pageId: string) => void;
}

const TrashPageContext = createContext<TrashPageApi | null>(null);

/**
 * Owns the delete flow for the whole editor: fetch the impact, confirm, trash.
 *
 * Mounted above BOTH `MainLayout` and the story-map overlay, so all three
 * triggers — the page editor's button, the sidebar's context menu, and the
 * map's context menu — go through one implementation and cannot drift into
 * showing different warnings or doing different things.
 *
 * `Dialog` portals to the end of `<body>`, so the confirmation paints above
 * the map's `fixed inset-0 z-50` overlay.
 */
export const TrashPageProvider = ({ children }: { children: ReactNode }) => {
  const [impact, setImpact] = useState<DeleteImpact | null>(null);
  const trashPage = useSetAtom(trashPageAtom);

  const requestTrash = useTrackedAction(async (pageId: string) => {
    setImpact(await api.pageDeleteImpact(pageId));
  });

  const confirm = useTrackedAction(async () => {
    if (!impact) return;
    await trashPage(impact.page_id);
    setImpact(null);
  });

  const cancel = useCallback(() => setImpact(null), []);

  return (
    <TrashPageContext.Provider value={{ requestTrash }}>
      {children}
      {impact && (
        <ConfirmTrashPageDialog impact={impact} onConfirm={confirm} onCancel={cancel} />
      )}
    </TrashPageContext.Provider>
  );
};

export function useTrashPage(): TrashPageApi {
  const ctx = useContext(TrashPageContext);
  if (!ctx) {
    throw new Error("useTrashPage must be used inside TrashPageProvider");
  }
  return ctx;
}
