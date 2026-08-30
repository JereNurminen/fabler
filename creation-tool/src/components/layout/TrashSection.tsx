import { useAtomValue, useSetAtom } from "jotai";
import { Link } from "wouter";
import { TrashIcon } from "@heroicons/react/24/outline";
import { trashedPageListAtom } from "../../atoms/storyAtoms";
import { restorePageAtom } from "../../atoms/storyActions";
import { useTrackedAction } from "../../hooks/useTrackedAction";
import { useContextMenu } from "../../hooks/useContextMenu";
import { ContextMenu } from "../ui/ContextMenu";
import { usePurgeConfirmation } from "../usePurgeConfirmation";
import { useTranslation } from "../../i18n";
import { getLinkToPage } from "../../utilities/routing";

interface TrashSectionProps {
  /**
   * Called when a trash row navigates, so the portrait bottom bar can close
   * the modal it was tapped in — the same callback `PagesSection` threads
   * into `PageLink`. Without it the modal stays open on top of the view it
   * just navigated to.
   */
  onPageClick?: () => void;
}

/**
 * The trash, rendered inside `PagesSection` so the landscape sidebar and the
 * portrait bottom bar both get it from one implementation.
 *
 * Hidden entirely when empty — an author who has never deleted anything
 * should not carry a permanent empty section in their sidebar.
 */
export const TrashSection = ({ onPageClick }: TrashSectionProps) => {
  const { t } = useTranslation();
  const trashed = useAtomValue(trashedPageListAtom);
  const restore = useSetAtom(restorePageAtom);
  const { menu, openAt, close } = useContextMenu<{ id: string; name: string }>();
  // Shared with `TrashedPageView`, so the two places that offer permanent
  // deletion cannot drift into confirming differently.
  const { requestPurge, requestEmptyTrash, purgeDialog } = usePurgeConfirmation();

  const onRestore = useTrackedAction(async (id: string) => {
    await restore(id);
  });

  if (trashed.length === 0) return null;

  return (
    <div className="p-2 border-t border-gray-200" data-testid="trash-section">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
          <TrashIcon className="w-4 h-4" />
          {t.headings.trash} ({trashed.length})
        </span>
        <button
          onClick={() => requestEmptyTrash(trashed.length)}
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
            onClick={onPageClick}
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
              onSelect: () => requestPurge(menu.target.id, menu.target.name),
            },
          ]}
        />
      )}

      {purgeDialog}
    </div>
  );
};
