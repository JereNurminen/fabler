import { useCallback, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import api from "../api";
import { translations } from "../i18n";
import type { Problem } from "../types";

/**
 * The export flow, shared by the sidebar button and the File menu.
 *
 * Validates first so a blocked export can name what is wrong. The backend
 * refuses independently; this pre-check exists for the message, not the
 * guarantee.
 *
 * IMPORTANT: validate → filter errors → early return, THEN save() → export.
 * This order is load-bearing, not incidental — do not "simplify" it by
 * asking for a destination first:
 *   - UX: an author should never be asked to pick a destination and then
 *     be told the export is refused.
 *   - Testability: `save()` from `@tauri-apps/plugin-dialog` throws when
 *     there is no Tauri runtime. The end-to-end tests exercise this hook in
 *     a plain browser, so the blocked-export path is only reachable because
 *     it returns before `save()` is ever called. Reordering this would make
 *     the blocked path unreachable from those tests.
 */
export function useExportStory(defaultName = "story") {
  const [blockedProblems, setBlockedProblems] = useState<Problem[] | null>(null);

  const exportStory = useCallback(async () => {
    try {
      const report = await api.validateStory();
      const errors = report.problems.filter((p) => p.severity === "error");
      if (errors.length > 0) {
        setBlockedProblems(errors);
        return;
      }

      const filePath = await save({
        defaultPath: `${defaultName}.fabler`,
        filters: [{ name: "Fabler Story", extensions: ["fabler"] }],
      });
      if (!filePath) return;

      await api.exportBundle(filePath);
      alert(translations.alerts.exportSuccess);
    } catch (error) {
      console.error("Failed to export story:", error);
      alert(translations.alerts.exportFailed);
    }
  }, [defaultName]);

  const dismissBlocked = useCallback(() => setBlockedProblems(null), []);

  return { exportStory, blockedProblems, dismissBlocked };
}
