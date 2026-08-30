import { useLocation } from "wouter";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { ProblemList } from "./ProblemList";
import { useTranslation } from "../i18n";
import { getLinkToPage } from "../utilities/routing";
import type { Problem } from "@fabler/types";

interface ExportBlockedDialogProps {
  problems: Problem[];
  onClose: () => void;
}

export const ExportBlockedDialog = ({ problems, onClose }: ExportBlockedDialogProps) => {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  return (
    <Dialog
      open
      onClose={onClose}
      title={t.problems.exportBlockedTitle}
      maxWidth="2xl"
    >
      <div data-testid="export-blocked-dialog">
        <p className="text-sm text-gray-700 mb-3">{t.problems.exportBlockedIntro}</p>
        <div className="max-h-[50vh] overflow-y-auto">
          <ProblemList
            problems={problems}
            onNavigate={(pageId) => {
              setLocation(getLinkToPage(pageId));
              onClose();
            }}
          />
        </div>
        <Button onClick={onClose} variant="secondary" className="w-full mt-4">
          {t.problems.close}
        </Button>
      </div>
    </Dialog>
  );
};
