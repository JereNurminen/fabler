import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { useTranslation } from "../i18n";
import type { DeleteImpact } from "@fabler/types";

interface ConfirmTrashPageDialogProps {
  impact: DeleteImpact;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The one confirmation for trashing a page, wherever the delete was triggered.
 *
 * Shows only the two things a delete actually breaks: the story losing its
 * entry point, and choices on OTHER pages left pointing at nothing. This
 * page's own choices leave with it and are not damage to warn about.
 */
export const ConfirmTrashPageDialog = ({
  impact,
  onConfirm,
  onCancel,
}: ConfirmTrashPageDialogProps) => {
  const { t } = useTranslation();

  return (
    <Dialog open onClose={onCancel} title={t.trash.confirmTitle} maxWidth="lg">
      <div data-testid="confirm-trash-dialog">
        <p className="text-sm text-gray-700">{t.trash.confirmIntro(impact.page_name)}</p>

        {impact.is_start_page && (
          <p
            data-testid="trash-start-page-warning"
            className="mt-3 p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded"
          >
            {t.trash.startPageWarning}
          </p>
        )}

        {impact.incoming.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-medium text-gray-900">
              {t.trash.strandedIntro(impact.incoming.length)}
            </p>
            <ul className="mt-2 max-h-56 overflow-y-auto space-y-1">
              {impact.incoming.map((ref) => (
                <li
                  key={`${ref.page_id}:${ref.choice_id}`}
                  data-testid="trash-stranded-choice"
                  className="text-sm text-gray-700"
                >
                  {t.trash.strandedItem(ref.page_name, ref.choice_text)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex gap-2 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            {t.buttons.cancel}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {t.buttons.moveToTrash}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
