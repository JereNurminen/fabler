import { useState } from "react";
import styled from "styled-components";
import { useTranslation } from "../i18n";
import type { Flag, FlagOperation } from "../bindings";

type FlagOperationsProps = {
  operations: FlagOperation[];
  availableFlags: Flag[];
  onAdd: (flagId: number, operation: string) => void;
  onRemove: (flagId: number) => void;
};

export const FlagOperations = ({ operations, availableFlags, onAdd, onRemove }: FlagOperationsProps) => {
  const { t } = useTranslation();
  const [selectedFlagId, setSelectedFlagId] = useState<number | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<string>("set_true");

  const handleAdd = () => {
    if (selectedFlagId === null) return;
    onAdd(selectedFlagId, selectedOperation);
    setSelectedFlagId(null);
  };

  // Filter out flags that already have operations
  const usedFlagIds = new Set(operations.map((op) => op.flag_id));
  const availableForAdd = availableFlags.filter((flag) => !usedFlagIds.has(flag.id));

  return (
    <Container>
      {operations.length === 0 ? (
        <EmptyState>{t.emptyStates.noOperations}</EmptyState>
      ) : (
        <OperationsList>
          {operations.map((op) => {
            const flag = availableFlags.find((f) => f.id === op.flag_id);
            return (
              <OperationItem key={op.id}>
                <OperationText>
                  <strong>{flag?.name || `Flag ${op.flag_id}`}</strong>
                  {" → "}
                  <OperationType>{op.operation}</OperationType>
                </OperationText>
                <RemoveButton onClick={() => onRemove(op.flag_id)}>×</RemoveButton>
              </OperationItem>
            );
          })}
        </OperationsList>
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
            value={selectedOperation}
            onChange={(e) => setSelectedOperation(e.target.value)}
          >
            <option value="set_true">set_true</option>
            <option value="set_false">set_false</option>
            <option value="toggle">toggle</option>
          </Select>

          <AddButton onClick={handleAdd} disabled={selectedFlagId === null}>
            {t.buttons.addOperation}
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

const OperationsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const OperationItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background-color: ${(props) => props.theme.bgLight || props.theme.bg};
  border: 1px solid ${(props) => props.theme.border};
  border-radius: 4px;
  font-size: 13px;
`;

const OperationText = styled.span`
  color: ${(props) => props.theme.fg};
`;

const OperationType = styled.span`
  font-family: monospace;
  background-color: ${(props) => props.theme.bgDark || props.theme.bg};
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
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
