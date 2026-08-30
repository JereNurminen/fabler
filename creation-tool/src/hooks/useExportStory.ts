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
