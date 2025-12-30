import { useState } from "react";
import styled from "styled-components";
import { useTranslation } from "../i18n";
import type { Flag, ChoiceCondition } from "../bindings";

type ChoiceConditionsProps = {
  conditions: ChoiceCondition[];
  availableFlags: Flag[];
  onAdd: (flagId: number, requiredValue: boolean) => void;
  onRemove: (flagId: number) => void;
};

export const ChoiceConditions = ({ conditions, availableFlags, onAdd, onRemove }: ChoiceConditionsProps) => {
  const { t } = useTranslation();
  const [selectedFlagId, setSelectedFlagId] = useState<number | null>(null);
  const [requiredValue, setRequiredValue] = useState<boolean>(true);

  const handleAdd = () => {
    if (selectedFlagId === null) return;
    onAdd(selectedFlagId, requiredValue);
    setSelectedFlagId(null);
  };

  // Filter out flags that already have conditions
  const usedFlagIds = new Set(conditions.map((cond) => cond.flag_id));
  const availableForAdd = availableFlags.filter((flag) => !usedFlagIds.has(flag.id));

  return (
    <Container>
      {conditions.length === 0 ? (
        <EmptyState>{t.emptyStates.noConditions}</EmptyState>
      ) : (
        <ConditionsList>
          {conditions.map((cond) => {
            const flag = availableFlags.find((f) => f.id === cond.flag_id);
            return (
              <ConditionItem key={cond.id}>
                <ConditionText>
                  <strong>{flag?.name || `Flag ${cond.flag_id}`}</strong>
                  {" must be "}
                  <RequiredValue isTrue={cond.required_value}>
                    {cond.required_value ? "true" : "false"}
                  </RequiredValue>
                </ConditionText>
                <RemoveButton onClick={() => onRemove(cond.flag_id)}>×</RemoveButton>
              </ConditionItem>
            );
          })}
        </ConditionsList>
      )}

      {availableForAdd.length > 0 && (
        <AddSection>
          <Select
            value={selectedFlagId ?? ""}
            onChange={(e) => setSelectedFlagId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t.labels.flag}...</option>
            {availableForAdd.map((flag) => (
              <option key={flag.id} value={flag.id}>
                {flag.name}
              </option>
            ))}
          </Select>

          <Select
            value={requiredValue ? "true" : "false"}
            onChange={(e) => setRequiredValue(e.target.value === "true")}
          >
            <option value="true">must be true</option>
            <option value="false">must be false</option>
          </Select>

          <AddButton onClick={handleAdd} disabled={selectedFlagId === null}>
            {t.buttons.addCondition}
          </AddButton>
        </AddSection>
      )}
    </Container>
  );
};

// Styled Components
const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ConditionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ConditionItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background-color: ${(props) => props.theme.bgLight || props.theme.bg};
  border: 1px solid ${(props) => props.theme.border};
  border-radius: 4px;
  font-size: 13px;
`;

const ConditionText = styled.span`
  color: ${(props) => props.theme.fg};
`;

const RequiredValue = styled.span<{ isTrue: boolean }>`
  font-family: monospace;
  background-color: ${(props) => props.isTrue
    ? props.theme.success || "#28a745"
    : props.theme.danger || "#dc3545"};
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 500;
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  color: ${(props) => props.theme.danger || "#dc3545"};
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${(props) => props.theme.bgLight || props.theme.bg};
  }
`;

const AddSection = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 4px;
`;

const Select = styled.select`
  padding: 6px 10px;
  border: 1px solid ${(props) => props.theme.border};
  border-radius: 4px;
  background-color: ${(props) => props.theme.bg};
  color: ${(props) => props.theme.fg};
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.primary};
  }
`;

const AddButton = styled.button`
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background-color: ${(props) => props.theme.primary};
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.8;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  padding: 12px;
  text-align: center;
  color: ${(props) => props.theme.fgMuted};
  font-size: 12px;
  font-style: italic;
`;
