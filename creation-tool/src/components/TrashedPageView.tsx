import { useAtomValue, useSetAtom } from "jotai";
import { useLocation } from "wouter";
import { trashedPageAtomFamily, storyAtom } from "../atoms/storyAtoms";
import { restorePageAtom, deleteTrashedPageAtom } from "../atoms/storyActions";
import { useTrackedAction } from "../hooks/useTrackedAction";
import { Button } from "./ui/Button";
import { useTranslation } from "../i18n";
import { getLinkToPage } from "../utilities/routing";

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
  const [, setLocation] = useLocation();
  const page = useAtomValue(trashedPageAtomFamily(pageId));
  const story = useAtomValue(storyAtom);
  const restore = useSetAtom(restorePageAtom);
  const purge = useSetAtom(deleteTrashedPageAtom);

  const onRestore = useTrackedAction(async () => {
    await restore(pageId);
  });

  // Permanent deletion leaves nothing to show, so this view has to go
  // somewhere. Trashing does NOT need an equivalent redirect: the route flips
  // to this view on its own when a page being edited is trashed.
  const onPurge = useTrackedAction(async () => {
    await purge(pageId);
    if (story?.start_page) setLocation(getLinkToPage(story.start_page));
  });

  const markdown = page.body.content?.[0];
  const source = markdown?.type === "markdown" ? markdown.source : "";

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
          <Button variant="danger" size="sm" onClick={onPurge}>
            {t.buttons.deletePermanently}
          </Button>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-gray-900">{page.name || page.id}</h2>
      <pre className="mt-3 p-3 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded whitespace-pre-wrap font-sans">
        {source}
      </pre>

      {page.choices.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-900 mb-2">{t.labels.choices}</h3>
          <ul className="space-y-1">
            {page.choices.map((choice) => (
              <li key={choice.id} className="text-sm text-gray-700">
                {choice.text} → {choice.target}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
