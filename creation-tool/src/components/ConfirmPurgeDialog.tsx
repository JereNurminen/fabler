import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { useTranslation } from "../i18n";

interface ConfirmPurgeDialogProps {
  title: string;
  intro: string;
  /** Shown when live choices still point at what is being purged. */
  warning?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation for the two irreversible actions: purging one trashed page,
 * and emptying the trash.
 *
 * No impact analysis, but `warning` carries the consequence that is easy to
 * miss: a live page can still hold a choice pointing at a trashed page, and
 * purging downgrades that problem from "which is in the trash" (fixable by
 * restoring) to "which doesn't exist" (fixable only by retargeting).
 */
export const ConfirmPurgeDialog = ({
  title,
  intro,
  warning,
  onConfirm,
  onCancel,
}: ConfirmPurgeDialogProps) => {
  const { t } = useTranslation();

  return (
    <Dialog open onClose={onCancel} title={title} maxWidth="lg">
      <div data-testid="confirm-purge-dialog">
        <p className="text-sm text-gray-700">{intro}</p>
        {warning && (
          <p
            data-testid="purge-downgrade-warning"
            className="mt-3 p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded"
          >
            {warning}
          </p>
        )}
        <div className="mt-4 flex gap-2 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            {t.buttons.cancel}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {t.buttons.deletePermanently}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
