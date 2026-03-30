import { useState } from "react";
import { Dialog } from "./ui/Dialog";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Button } from "./ui/Button";
import { useTranslation } from "../i18n";

type StorySettingsDialogProps = {
  initialTitle: string;
  initialStartPage: string | null;
  pages: Array<{ id: string; name: string }>;
  onConfirm: (title: string, startPage: string) => void;
  onCancel: () => void;
};

export const StorySettingsDialog = ({
  initialTitle,
  initialStartPage,
  pages,
  onConfirm,
  onCancel,
}: StorySettingsDialogProps) => {
  const [title, setTitle] = useState(initialTitle);
  const [startPage, setStartPage] = useState<string>(
    initialStartPage ?? pages[0]?.id ?? ""
  );
  const { t } = useTranslation();

  const handleConfirm = () => {
    if (title.trim() === "") {
      alert(t.alerts.storyTitleEmpty);
      return;
    }
    if (!startPage) {
      alert(t.alerts.selectStartPage);
      return;
    }
    onConfirm(title, startPage);
  };

  return (
    <Dialog open={true} onClose={onCancel} title={t.headings.storySettings} maxWidth="lg">
      <div className="space-y-4">
        <Input
          label={t.labels.storyTitle}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.placeholders.storyTitleLong}
          autoFocus
        />

        <Select
          label={t.labels.startPage}
          value={startPage}
          onChange={(e) => setStartPage(e.target.value)}
        >
          {pages.map((page) => (
            <option key={page.id} value={page.id}>
              {page.name || page.id}
            </option>
          ))}
        </Select>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleConfirm} className="flex-1">
            {t.buttons.save}
          </Button>
          <Button onClick={onCancel} variant="secondary" className="flex-1">
            {t.buttons.cancel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
