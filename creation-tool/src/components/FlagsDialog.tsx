import { useState, Suspense } from "react";
import styled from "styled-components";
import { Card } from "./Card";
import { useTranslation } from "../i18n";
import { useAtomValue, useSetAtom } from "jotai";
import { currentStoryIdAtom, storyFlagsAtom } from "../atoms/storyAtoms";
import { createFlagAtom, patchFlagAtom, deleteFlagAtom } from "../atoms/storyActions";
import type { Flag } from "../bindings";

type FlagsDialogProps = {
  onClose: () => void;
};

const FlagsDialogContent = ({ onClose }: FlagsDialogProps) => {
  const { t } = useTranslation();
  const storyId = useAtomValue(currentStoryIdAtom);
  const flags = useAtomValue(storyFlagsAtom);
  const createFlag = useSetAtom(createFlagAtom);
  const patchFlag = useSetAtom(patchFlagAtom);
  const deleteFlag = useSetAtom(deleteFlagAtom);

  const [newFlagName, setNewFlagName] = useState("");
  const [newFlagDefaultValue, setNewFlagDefaultValue] = useState(false);
  const [editingFlags, setEditingFlags] = useState<Record<number, { name: string; defaultValue: boolean }>>({});

  const handleCreateFlag = async () => {
    if (!storyId) return;
    if (newFlagName.trim() === "") {
      alert(t.alerts.flagNameEmpty);
      return;
    }

    try {
      await createFlag({
        story_id: storyId,
        name: newFlagName.trim(),
        default_value: newFlagDefaultValue,
      });
      setNewFlagName("");
      setNewFlagDefaultValue(false);
    } catch (error) {
      console.error("Failed to create flag:", error);
    }
  };

  const handleUpdateFlag = async (flag: Flag) => {
    const edited = editingFlags[flag.id];
    if (!edited) return;

    try {
      await patchFlag({
        id: flag.id,
        name: edited.name !== flag.name ? edited.name : null,
        default_value: edited.defaultValue !== flag.default_value ? edited.defaultValue : null,
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

  const handleDeleteFlag = async (id: number) => {
    try {
      await deleteFlag(id);
    } catch (error) {
      console.error("Failed to delete flag:", error);
    }
  };

  const handleFlagChange = (flagId: number, field: "name" | "defaultValue", value: string | boolean) => {
    setEditingFlags((prev) => ({
      ...prev,
      [flagId]: {
        ...prev[flagId],
        [field]: value,
      },
    }));
  };

  const getEditedValue = (flag: Flag) => {
    return editingFlags[flag.id] || { name: flag.name, defaultValue: flag.default_value };
  };

  return (
    <Overlay onClick={onClose}>
      <DialogCard onClick={(e) => e.stopPropagation()}>
        <Title>{t.headings.flags}</Title>

        {flags.length === 0 ? (
          <EmptyState>{t.emptyStates.noFlags}</EmptyState>
        ) : (
          <FlagList>
            {flags.map((flag) => {
              const edited = getEditedValue(flag);
              const hasChanges = editingFlags[flag.id] !== undefined;

              return (
                <FlagItem key={flag.id}>
                  <FlagInputs>
                    <FlagNameInput
                      type="text"
                      value={edited.name}
                      onChange={(e) => handleFlagChange(flag.id, "name", e.target.value)}
                      onBlur={() => hasChanges && handleUpdateFlag(flag)}
                      placeholder={t.placeholders.flagName}
                    />
                    <CheckboxLabel>
                      <input
                        type="checkbox"
                        checked={edited.defaultValue}
                        onChange={(e) => {
                          handleFlagChange(flag.id, "defaultValue", e.target.checked);
                          setEditingFlags((prev) => ({
                            ...prev,
                            [flag.id]: {
                              name: edited.name,
                              defaultValue: e.target.checked,
                            },
                          }));
                          // Auto-save on checkbox change
                          setTimeout(() => {
                            patchFlag({
                              id: flag.id,
                              name: null,
                              default_value: e.target.checked,
                            });
                          }, 0);
                        }}
                      />
                      <span>{t.labels.defaultValue}</span>
                    </CheckboxLabel>
                  </FlagInputs>
                  <DeleteButton onClick={() => handleDeleteFlag(flag.id)}>
                    {t.buttons.delete}
                  </DeleteButton>
                </FlagItem>
              );
            })}
          </FlagList>
        )}

        <Divider />

        <NewFlagSection>
          <SectionLabel>{t.buttons.addFlag}</SectionLabel>
          <FlagInputs>
            <FlagNameInput
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
            <CheckboxLabel>
              <input
                type="checkbox"
                checked={newFlagDefaultValue}
                onChange={(e) => setNewFlagDefaultValue(e.target.checked)}
              />
              <span>{t.labels.defaultValue}</span>
            </CheckboxLabel>
          </FlagInputs>
          <AddButton onClick={handleCreateFlag}>{t.buttons.create}</AddButton>
        </NewFlagSection>

        <ButtonContainer>
          <CloseButton onClick={onClose}>{t.buttons.cancel}</CloseButton>
        </ButtonContainer>
      </DialogCard>
    </Overlay>
  );
};

export const FlagsDialog = (props: FlagsDialogProps) => (
  <Suspense fallback={<div>Loading...</div>}>
    <FlagsDialogContent {...props} />
  </Suspense>
);

// Styled Components
const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const DialogCard = styled(Card)`
  min-width: 500px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: ${(props) => props.theme.fg};
`;

const FlagList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const FlagItem = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-start;
`;

const FlagInputs = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FlagNameInput = styled.input`
  padding: 8px 12px;
  border: 1px solid ${(props) => props.theme.border};
  border-radius: 4px;
  background-color: ${(props) => props.theme.bg};
  color: ${(props) => props.theme.fg};
  font-size: 14px;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.primary};
  }
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: ${(props) => props.theme.fg};
  cursor: pointer;

  input[type="checkbox"] {
    cursor: pointer;
  }
`;

const DeleteButton = styled.button`
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background-color: ${(props) => props.theme.danger || "#dc3545"};
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }
`;

const Divider = styled.div`
  height: 1px;
  background-color: ${(props) => props.theme.border};
  margin: 8px 0;
`;

const NewFlagSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionLabel = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => props.theme.fg};
`;

const AddButton = styled.button`
  align-self: flex-start;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: ${(props) => props.theme.primary};
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 8px;
`;

const CloseButton = styled.button`
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  background-color: ${(props) => props.theme.border};
  color: ${(props) => props.theme.fg};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }
`;

const EmptyState = styled.div`
  padding: 24px;
  text-align: center;
  color: ${(props) => props.theme.fgMuted};
  font-size: 14px;
`;
