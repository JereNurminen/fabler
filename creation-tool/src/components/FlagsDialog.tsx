import { useState, Suspense } from "react";
import { Dialog } from "./ui/Dialog";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { useTranslation, translations } from "../i18n";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { generateId } from "../utilities/id";
import { useTrackedAction } from "../hooks/useTrackedAction";
import type { Flag, Story } from "../types";

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

  // Each tracked action below wraps only the write itself. Guards and
  // validation run in the plain function that calls it, so an early return
  // (nothing open, nothing changed, an empty name) never reaches
  // useTrackedAction and never reports a "saved" that didn't happen.

  const createFlag = useTrackedAction(
    async (s: Story, name: string, defaultValue: boolean) => {
      await saveStory({
        ...s,
        flags: [
          ...s.flags,
          { id: generateId(), name, default_value: defaultValue },
        ],
      });
      setNewFlagName("");
      setNewFlagDefaultValue(false);
    },
  );

  const handleCreateFlag = () => {
    if (!story) return;
    const trimmed = newFlagName.trim();
    if (trimmed === "") {
      alert(t.alerts.flagNameEmpty);
      return;
    }
    createFlag(story, trimmed, newFlagDefaultValue);
  };

  const updateFlag = useTrackedAction(
    async (
      s: Story,
      flag: Flag,
      edited: { name: string; defaultValue: boolean },
    ) => {
      await saveStory({
        ...s,
        flags: s.flags.map((f) =>
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
    },
  );

  const handleUpdateFlag = (flag: Flag) => {
    if (!story) return;
    const edited = editingFlags[flag.id];
    if (!edited) return;
    updateFlag(story, flag, edited);
  };

  const deleteFlag = useTrackedAction(async (s: Story, id: string) => {
    await saveStory({
      ...s,
      flags: s.flags.filter((f) => f.id !== id),
    });
  });

  const handleDeleteFlag = (id: string) => {
    if (!story) return;
    deleteFlag(story, id);
  };

  const toggleDefaultValue = useTrackedAction(
    async (s: Story, flagId: string, checked: boolean) => {
      await saveStory({
        ...s,
        flags: s.flags.map((f) =>
          f.id === flagId ? { ...f, default_value: checked } : f
        ),
      });
    },
  );

  const handleToggleDefaultValue = (flagId: string, checked: boolean) => {
    if (!story) return;
    toggleDefaultValue(story, flagId, checked);
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
                          // Auto-save on checkbox change
                          handleToggleDefaultValue(flag.id, e.target.checked);
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
