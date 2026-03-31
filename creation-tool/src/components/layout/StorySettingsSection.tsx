import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { useTranslation } from "../../i18n";
import { save } from "@tauri-apps/plugin-dialog";
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

  const handleExportBundle = async () => {
    try {
      const filePath = await save({
        defaultPath: `${storyTitle}.fabler`,
        filters: [{ name: "Fabler Story", extensions: ["fabler"] }],
      });

      if (filePath) {
        await api.exportBundle(filePath);
        alert(t.alerts.exportSuccess);
      }
    } catch (error) {
      console.error("Failed to export bundle:", error);
      alert(t.alerts.exportFailed);
    }
  };

  const handleStartPageChange = async (newStartPage: string) => {
    try {
      const currentStory = await api.getStory();
      await api.saveStory({ ...currentStory, start_page: newStartPage });
    } catch (error) {
      console.error("Failed to update start page:", error);
    }
  };

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
      <Button size="sm" onClick={handleExportBundle} className="w-full">
        {t.buttons.exportBundle}
      </Button>
    </div>
  );
};
