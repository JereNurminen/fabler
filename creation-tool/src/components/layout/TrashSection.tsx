import { useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Link } from "wouter";
import { TrashIcon } from "@heroicons/react/24/outline";
import { trashedPageListAtom } from "../../atoms/storyAtoms";
import { useValidation } from "../../atoms/useStoryAtoms";
import {
  restorePageAtom,
  deleteTrashedPageAtom,
  emptyTrashAtom,
} from "../../atoms/storyActions";
import { useTrackedAction } from "../../hooks/useTrackedAction";
import { useContextMenu } from "../../hooks/useContextMenu";
import { ContextMenu } from "../ui/ContextMenu";
import { ConfirmPurgeDialog } from "../ConfirmPurgeDialog";
import { useTranslation } from "../../i18n";
import { getLinkToPage } from "../../utilities/routing";

type Pending =
  | { kind: "page"; id: string; name: string }
  | { kind: "all"; count: number };

/**
 * The trash, rendered inside `PagesSection` so the landscape sidebar and the
 * portrait bottom bar both get it from one implementation.
 *
 * Hidden entirely when empty — an author who has never deleted anything
 * should not carry a permanent empty section in their sidebar.
 */
export const TrashSection = () => {
  const { t } = useTranslation();
  const trashed = useAtomValue(trashedPageListAtom);
  const { problems } = useValidation();
  const restore = useSetAtom(restorePageAtom);
  const purge = useSetAtom(deleteTrashedPageAtom);
  const purgeAll = useSetAtom(emptyTrashAtom);
  const { menu, openAt, close } = useContextMenu<{ id: string; name: string }>();
  const [pending, setPending] = useState<Pending | null>(null);

  const onRestore = useTrackedAction(async (id: string) => {
    await restore(id);
  });

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

  if (trashed.length === 0) return null;

  return (
    <div className="p-2 border-t border-gray-200" data-testid="trash-section">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
          <TrashIcon className="w-4 h-4" />
          {t.headings.trash} ({trashed.length})
        </span>
        <button
          onClick={() => setPending({ kind: "all", count: trashed.length })}
          className="text-xs text-red-600 hover:underline"
        >
          {t.buttons.emptyTrash}
        </button>
      </div>

      <div className="space-y-1">
        {trashed.map((page) => (
          <Link
            key={page.id}
            to={getLinkToPage(page.id)}
            data-testid="trash-entry"
            onContextMenu={(event) => openAt(event, { id: page.id, name: page.name })}
            className="block no-underline p-2 rounded text-sm text-gray-500 italic bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            {page.name || page.id}
          </Link>
        ))}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={close}
          items={[
            { label: t.buttons.restore, onSelect: () => onRestore(menu.target.id) },
            {
              label: t.buttons.deletePermanently,
              variant: "danger",
              onSelect: () =>
                setPending({ kind: "page", id: menu.target.id, name: menu.target.name }),
            },
          ]}
        />
      )}

      {pending && (
        <ConfirmPurgeDialog
          title={pending.kind === "all" ? t.trash.emptyTrashTitle : t.trash.purgeTitle}
          intro={
            pending.kind === "all"
              ? t.trash.emptyTrashIntro(pending.count)
              : t.trash.purgeIntro(pending.name)
          }
          warning={((count) =>
            count > 0 ? t.trash.purgeDowngradeWarning(count) : undefined)(
            pending.kind === "page" ? stillReferenced(pending.id) : stillReferenced(),
          )}
          onConfirm={confirmPurge}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
};
