import { useCallback, useState, type ReactNode } from "react";
import { useSetAtom } from "jotai";
import { deleteTrashedPageAtom, emptyTrashAtom } from "../atoms/storyActions";
import { useValidation } from "../atoms/useStoryAtoms";
import { useTrackedAction } from "../hooks/useTrackedAction";
import { ConfirmPurgeDialog } from "./ConfirmPurgeDialog";
import { useTranslation } from "../i18n";

type Pending =
  | { kind: "page"; id: string; name: string }
  | { kind: "all"; count: number };

interface PurgeConfirmation {
  /** Ask to permanently delete one trashed page. */
  requestPurge: (id: string, name: string) => void;
  /** Ask to permanently delete every trashed page. */
  requestEmptyTrash: (count: number) => void;
  /** The dialog itself — render it; it is `null` while nothing is pending. */
  purgeDialog: ReactNode;
}

/**
 * The one permanent-deletion flow, shared by the trash list and the
 * read-only trashed-page view.
 *
 * Both places offer "Delete permanently", and both must confirm it
 * identically — same wording, same downgrade warning, same irreversible
 * outcome. Keeping the flow here is the same principle `TrashPageContext`
 * applies to the delete flow: a second copy is a second thing to forget, and
 * the way this shipped the first time was a copy that simply never asked.
 *
 * A hook rather than a provider because, unlike trashing, purging has no
 * trigger outside the trash UI itself — the two consumers each render their
 * own dialog instance, and never both at once.
 */
export function usePurgeConfirmation(): PurgeConfirmation {
  const { t } = useTranslation();
  const { problems } = useValidation();
  const purge = useSetAtom(deleteTrashedPageAtom);
  const purgeAll = useSetAtom(emptyTrashAtom);
  const [pending, setPending] = useState<Pending | null>(null);

  const requestPurge = useCallback(
    (id: string, name: string) => setPending({ kind: "page", id, name }),
    [],
  );
  const requestEmptyTrash = useCallback(
    (count: number) => setPending({ kind: "all", count }),
    [],
  );

  const confirmPurge = useTrackedAction(async () => {
    if (!pending) return;
    if (pending.kind === "page") await purge(pending.id);
    else await purgeAll();
    setPending(null);
  });

  /**
   * How many live choices still point into the trash — at one page, or at
   * any of them.
   *
   * Read off the validation report rather than by calling
   * `page_delete_impact` again: the report is already loaded for the Problems
   * panel, `choice_targets_trashed_page` is by definition exactly this set,
   * and one call answers the "empty the whole trash" case that N impact calls
   * would otherwise need. One source, so the warning can never disagree with
   * the problem list the author is looking at.
   */
  const stillReferenced = (targetId?: string) =>
    problems.filter(
      (p) =>
        p.detail.code === "choice_targets_trashed_page" &&
        (targetId === undefined || p.detail.target === targetId),
    ).length;

  const referenced =
    pending === null
      ? 0
      : pending.kind === "page"
        ? stillReferenced(pending.id)
        : stillReferenced();

  const purgeDialog = pending ? (
    <ConfirmPurgeDialog
      title={pending.kind === "all" ? t.trash.emptyTrashTitle : t.trash.purgeTitle}
      intro={
        pending.kind === "all"
          ? t.trash.emptyTrashIntro(pending.count)
          : t.trash.purgeIntro(pending.name)
      }
      warning={referenced > 0 ? t.trash.purgeDowngradeWarning(referenced) : undefined}
      onConfirm={confirmPurge}
      onCancel={() => setPending(null)}
    />
  ) : null;

  return { requestPurge, requestEmptyTrash, purgeDialog };
}
