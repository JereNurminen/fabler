import { useAtomValue } from "jotai";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { useTranslation } from "../../i18n";
import { useExportStory } from "../../hooks/useExportStory";
import { ExportBlockedDialog } from "../ExportBlockedDialog";
import { useTrackedAction } from "../../hooks/useTrackedAction";
import { trashedPageListAtom } from "../../atoms/storyAtoms";
import api from "../../api";

interface StorySettingsSectionProps {
  storyTitle: string;
  pages: Array<{ id: string; name: string }>;
  startPage: string | null;
}

export const StorySettingsSection = ({
  storyTitle,
  pages,
  startPage,
}: StorySettingsSectionProps) => {
  const { t } = useTranslation();
  const { exportStory, blockedProblems, dismissBlocked } = useExportStory(storyTitle);
  const trashedPages = useAtomValue(trashedPageListAtom);

  /**
   * A start page that is not among the live options. React renders such a
   * `<select>` blank and fires no `onChange`, so the stored `start_page`
   * survives — but the author sees an unexplained empty dropdown. Carrying
   * the value in an extra option keeps it visible and named.
   *
   * Deleting the start page is a supported flow, and this dropdown is where
   * the author lands afterwards to pick a replacement, so "in the trash" is
   * the common case here rather than an edge one — and naming the page is
   * what tells them restoring is the one-step fix. Only a genuinely dangling
   * id, which resolves to no page at all, falls back to the id itself.
   */
  const missingStartPage =
    !!startPage && !pages.some((p) => p.id === startPage) ? startPage : null;
  const trashedStartPage =
    missingStartPage === null
      ? undefined
      : trashedPages.find((p) => p.id === missingStartPage);
  const missingStartPageLabel = trashedStartPage
    ? t.dynamic.pageInTrash(trashedStartPage.name || trashedStartPage.id)
    : missingStartPage;

  const handleStartPageChange = useTrackedAction(async (newStartPage: string) => {
    const currentStory = await api.getStory();
    await api.saveStory({ ...currentStory, start_page: newStartPage });
  });

  return (
    <div className="px-4 py-3 space-y-3">
      <Select
        label={t.labels.startPage}
        value={startPage || ""}
        onChange={(e) => handleStartPageChange(e.target.value)}
      >
        {missingStartPage !== null && (
          <option value={missingStartPage}>{missingStartPageLabel}</option>
        )}
        {pages.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name || p.id}
          </option>
        ))}
      </Select>
      <Button size="sm" onClick={() =>
          void exportStory().catch((error: unknown) => {
            console.error("Failed to export story:", error);
          })
        } className="w-full">
        {t.buttons.exportBundle}
      </Button>
      {blockedProblems && (
        <ExportBlockedDialog problems={blockedProblems} onClose={dismissBlocked} />
      )}
    </div>
  );
};
