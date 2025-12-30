import { useState } from "react";
import { Dialog } from "./ui/Dialog";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { useTranslation } from "../i18n";

export const NewStoryDialog = ({
  onConfirm,
  onCancel,
}: {
  onConfirm: (title: string) => void;
  onCancel: () => void;
}) => {
  const [title, setTitle] = useState("");
  const { t } = useTranslation();

  return (
    <Dialog open={true} onClose={onCancel} title={t.headings.createNewStory}>
      <div className="space-y-4">
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.placeholders.storyTitle}
          autoFocus
        />
        <div className="flex gap-3">
          <Button onClick={() => onConfirm(title)} className="flex-1">
            {t.buttons.create}
          </Button>
          <Button onClick={onCancel} variant="secondary" className="flex-1">
            {t.buttons.cancel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
