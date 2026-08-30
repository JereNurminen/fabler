import { useAtomValue, useSetAtom } from "jotai";
import { ContentRenderer } from "@fabler/player/ui/ContentRenderer";
import {
  trashedPageAtomFamily,
  pageListAtom,
  trashedPageListAtom,
} from "../atoms/storyAtoms";
import { restorePageAtom } from "../atoms/storyActions";
import { useTrackedAction } from "../hooks/useTrackedAction";
import { useProjectAssets } from "../hooks/useProjectAssets";
import { usePurgeConfirmation } from "./usePurgeConfirmation";
import { Button } from "./ui/Button";
import { useTranslation } from "../i18n";

/**
 * A trashed page, shown so the author can confirm what they are about to
 * restore — not a second way to browse the story.
 *
 * A separate component rather than a `readOnly` mode on `PageCard`: threading
 * the flag through PageCard, Input, MarkdownEditor, ChoiceEditor,
 * FlagOperations and SelectWithCreate would leave six places a future edit
 * could forget it and reopen a write path. Here there is no write path to
 * forget — the component renders no editable control at all.
 */
export const TrashedPageView = ({ pageId }: { pageId: string }) => {
  const { t } = useTranslation();
  const page = useAtomValue(trashedPageAtomFamily(pageId));
  const pages = useAtomValue(pageListAtom);
  const trashed = useAtomValue(trashedPageListAtom);
  const restore = useSetAtom(restorePageAtom);
  const assets = useProjectAssets();
  // Permanent deletion is confirmed here exactly as it is in the trash list:
  // both offer the same button, so both go through one flow.
  //
  // Purging leaves nothing for this route to show, but this view does not
  // redirect: `StoryEditorPage` has a single guard that sends any routed id
  // which is neither live nor trashed somewhere sensible. That covers this
  // purge, a purge from the sidebar, and "Empty trash" alike — and, unlike a
  // redirect here, it cannot send the author back to the very page they just
  // destroyed when that page was also the start page.
  const { requestPurge, purgeDialog } = usePurgeConfirmation();

  const onRestore = useTrackedAction(async () => {
    await restore(pageId);
  });

  /**
   * A choice's destination, by name. Live pages first, then the trash (a
   * trashed page can point at another trashed page), then the raw id — which
   * is what a genuinely dangling target has to fall back to.
   */
  const targetName = (target: string) => {
    const live = pages.find((p) => p.id === target);
    if (live) return live.name || live.id;
    const inTrash = trashed.find((p) => p.id === target);
    if (inTrash) return t.dynamic.pageInTrash(inTrash.name || inTrash.id);
    return target;
  };

  return (
    <div className="p-6 max-w-3xl">
      <div
        data-testid="trashed-page-banner"
        className="p-3 mb-4 bg-amber-50 border border-amber-200 rounded"
      >
        <p className="text-sm font-medium text-amber-900">{t.trash.bannerTitle}</p>
        <p className="text-sm text-amber-800">{t.trash.bannerBody}</p>
        <div className="mt-3 flex gap-2">
          <Button variant="primary" size="sm" onClick={onRestore}>
            {t.buttons.restore}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => requestPurge(page.id, page.name)}
          >
            {t.buttons.deletePermanently}
          </Button>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-gray-900">{page.name || page.id}</h2>
      <div
        className="mt-3"
        data-testid="trashed-page-body"
        data-theme="light"
        data-font-size="medium"
      >
        <ContentRenderer document={page.body} assets={assets} />
      </div>

      {page.choices.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-900 mb-2">{t.labels.choices}</h3>
          <ul className="space-y-1">
            {page.choices.map((choice) => (
              <li key={choice.id} className="text-sm text-gray-700">
                {t.dynamic.choiceLeadsTo(choice.text, targetName(choice.target))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {purgeDialog}
    </div>
  );
};
