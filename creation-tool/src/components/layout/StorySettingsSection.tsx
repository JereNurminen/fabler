import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { useTranslation } from "../../i18n";
import { useExportStory } from "../../hooks/useExportStory";
import { ExportBlockedDialog } from "../ExportBlockedDialog";
import { useTrackedAction } from "../../hooks/useTrackedAction";
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
