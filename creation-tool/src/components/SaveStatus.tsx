import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import clsx from "clsx";
import { saveStatusAtom } from "../atoms/saveStatus";
import { useTranslation } from "../i18n";

/** How long a successful save stays on screen before fading out. */
const SAVED_VISIBLE_MS = 3000;

export const SaveStatus = () => {
  const status = useAtomValue(saveStatusAtom);
  const { t } = useTranslation();
  const [savedExpired, setSavedExpired] = useState(false);

  useEffect(() => {
    setSavedExpired(false);
    // Only "saved" times out. "failed" persists until the next write
    // succeeds — a message the author can miss is the bug being fixed.
    if (status.state !== "saved") return;
    const id = window.setTimeout(() => setSavedExpired(true), SAVED_VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [status]);

  if (status.state === "idle") return null;
  if (status.state === "saved" && savedExpired) return null;

  const failed = status.state === "failed";

  return (
    <div
      data-testid="save-status"
      role={failed ? "alert" : "status"}
      className={clsx(
        "fixed bottom-4 right-4 z-50 px-3 py-2 rounded-lg border text-xs shadow-sm",
        failed
          ? "bg-red-50 border-red-200 text-red-800"
          : "bg-gray-50 border-gray-200 text-gray-700",
      )}
    >
      {status.state === "saving" && t.saveStatus.saving}
      {status.state === "saved" && t.saveStatus.saved}
      {failed && `${t.saveStatus.failed}: ${status.message}`}
    </div>
  );
};
