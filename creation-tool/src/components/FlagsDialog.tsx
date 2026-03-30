import { useState, Suspense } from "react";
import { Dialog } from "./ui/Dialog";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { useTranslation, translations } from "../i18n";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { generateId } from "../utilities/id";
import type { Flag } from "../types";

type FlagsDialogProps = {
  onClose: () => void;
};

const FlagsDialogContent = ({ onClose }: FlagsDialogProps) => {
  const { t } = useTranslation();
  const { story, flags, saveStory } = useStoryAtoms();

  const [newFlagName, setNewFlagName] = useState("");
  const [newFlagDefaultValue, setNewFlagDefaultValue] = useState(false);
  const [editingFlags, setEditingFlags] = useState<
    Record<string, { name: string; defaultValue: boolean }>
  >({});

  const handleCreateFlag = async () => {
    if (!story) return;
    if (newFlagName.trim() === "") {
      alert(t.alerts.flagNameEmpty);
      return;
    }

    try {
      await saveStory({
        ...story,
        flags: [
          ...story.flags,
          { id: generateId(), name: newFlagName.trim(), default_value: newFlagDefaultValue },
        ],
      });
      setNewFlagName("");
      setNewFlagDefaultValue(false);
    } catch (error) {
      console.error("Failed to create flag:", error);
    }
  };

  const handleUpdateFlag = async (flag: Flag) => {
    if (!story) return;
    const edited = editingFlags[flag.id];
    if (!edited) return;

    try {
      await saveStory({
        ...story,
        flags: story.flags.map((f) =>
          f.id === flag.id
            ? { ...f, name: edited.name, default_value: edited.defaultValue }
            : f
        ),
      });
      setEditingFlags((prev) => {
        const next = { ...prev };
        delete next[flag.id];
        return next;
      });
    } catch (error) {
      console.error("Failed to update flag:", error);
    }
  };

  const handleDeleteFlag = async (id: string) => {
    if (!story) return;
    try {
      await saveStory({
        ...story,
        flags: story.flags.filter((f) => f.id !== id),
      });
    } catch (error) {
      console.error("Failed to delete flag:", error);
    }
  };

  const handleFlagChange = (
    flagId: string,
    field: "name" | "defaultValue",
    value: string | boolean,
  ) => {
    setEditingFlags((prev) => ({
      ...prev,
      [flagId]: {
        ...prev[flagId],
        [field]: value,
      },
    }));
  };

  const getEditedValue = (flag: Flag) => {
    return (
      editingFlags[flag.id] || {
        name: flag.name,
        defaultValue: flag.default_value,
      }
    );
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title={t.headings.flags}
      maxWidth="2xl"
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto flag-creation-dialog">
        {flags.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            {t.emptyStates.noFlags}
          </div>
        ) : (
          <div className="space-y-3">
            {flags.map((flag) => {
              const edited = getEditedValue(flag);
              const hasChanges = editingFlags[flag.id] !== undefined;

              return (
                <div key={flag.id} className="flex gap-3 items-start">
                  <div className="flex-1 space-y-2">
                    <Input
                      type="text"
                      value={edited.name}
                      onChange={(e) =>
                        handleFlagChange(flag.id, "name", e.target.value)
                      }
                      onBlur={() => hasChanges && handleUpdateFlag(flag)}
                      placeholder={t.placeholders.flagName}
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={edited.defaultValue}
                        onChange={(e) => {
                          handleFlagChange(
                            flag.id,
                            "defaultValue",
                            e.target.checked,
                          );
                          if (!story) return;
                          // Auto-save on checkbox change
                          saveStory({
                            ...story,
                            flags: story.flags.map((f) =>
                              f.id === flag.id
                                ? { ...f, default_value: e.target.checked }
                                : f
                            ),
                          });
                        }}
                        className="cursor-pointer"
                      />
                      <span>{t.labels.defaultValue}</span>
                    </label>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteFlag(flag.id)}
                  >
                    {t.buttons.delete}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="font-semibold text-sm text-gray-900 mb-3">
            {t.buttons.addFlag}
          </div>
          <div className="space-y-3">
            <Input
              type="text"
              value={newFlagName}
              onChange={(e) => setNewFlagName(e.target.value)}
              placeholder={t.placeholders.flagName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateFlag();
                }
              }}
            />
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newFlagDefaultValue}
                onChange={(e) => setNewFlagDefaultValue(e.target.checked)}
                className="cursor-pointer"
              />
              <span>{t.labels.defaultValue}</span>
            </label>
            <Button onClick={handleCreateFlag} className="w-full">
              {t.buttons.create}
            </Button>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <Button onClick={onClose} variant="secondary" className="w-full">
            {t.buttons.close}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export const FlagsDialog = (props: FlagsDialogProps) => (
  <Suspense
    fallback={
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500">{translations.status.loading}</p>
      </div>
    }
  >
    <FlagsDialogContent {...props} />
  </Suspense>
);
